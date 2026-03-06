import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import { useCommentStore } from '../store/useCommentStore'
import { useDictionaryStore } from '../store/useDictionaryStore'
import { useUserStore } from '../store/useUserStore'
import { useVocabularyStore } from '../store/useVocabularyStore'
import { Comment, CulturalNote } from '../types'
import { getAssetPath, IMAGES } from '../constants'
import WordDetailOverlay from '../components/WordDetailOverlay'
import MessageBubble from '../components/MessageBubble'
import ChatRoomHeader from '../components/ChatRoomHeader'
import DifficultySettings, { DifficultyLevel } from '../components/DifficultySettings'
import CulturalNoteOverlay from '../components/CulturalNoteOverlay'
import MessageContextMenu from '../components/MessageContextMenu'
import MiniReactionButton from '../components/MiniReactionButton'
import { useMessageTree } from '../hooks/useMessageTree'
import SpeakingAvatarOverlay from '../components/SpeakingAvatarOverlay'

const AI_MODEL = 'deepseek-ai/DeepSeek-V2.5'

interface ChatRoomProps {
  postId: string
  postImage?: string
  focusCommentId?: string | null
  onBack: () => void
}


// 气泡底部的轻量级表情互动区
const TypewriterText = ({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState('')

  useEffect(() => {
    if (!text) {
      setDisplayedText('')
      return
    }
    let i = 0
    setDisplayedText('')
    const timer = setInterval(() => {
      setDisplayedText(text.substring(0, i + 1))
      i++
      if (i >= text.length) {
        clearInterval(timer)
      }
    }, 40)
    return () => clearInterval(timer)
  }, [text])

  return <>{displayedText}</>
}

const ChatRoom: React.FC<ChatRoomProps> = ({
  postId,
  postImage,
  focusCommentId,
  onBack,
}) => {
  const { getComments, fetchComments, addLocalComment, deleteLocalComment } =
    useCommentStore()
  const { getDefinition, triggerAnalysis } = useDictionaryStore()
  const { profile } = useUserStore()
  const { registerWordLookup } = useVocabularyStore()

  const getDisplayAuthor = (name: string) => {
    if (!name) return '??'
    if (name === 'You' || name === 'Me') return profile?.display_name || 'You'
    return name
  }

  const getInitials = (name: string) => {
    const displayName = getDisplayAuthor(name)
    return displayName.substring(0, 2).toUpperCase()
  }

  // --- State ---
  const [opPostData, setOpPostData] = useState<{
    content: string
    content_cn: string
    author: string
    sentence_segments?: any[]
    cultural_notes?: any[]
  } | null>(null)
  const [inputText, setInputText] = useState('')
  const [quotedMessage, setQuotedMessage] = useState<Comment | null>(null)
  const [viewingWord, setViewingWord] = useState<string | null>(null)
  const [viewingWordContext, setViewingWordContext] = useState<string>('')
  const [showGlobalTranslation, setShowGlobalTranslation] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    msg: Comment
  } | null>(null)
  const [expandedTranslations, setExpandedTranslations] = useState<
    Record<string, boolean>
  >({})
  const [isAiMode, setIsAiMode] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Original')
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [returnToId, setReturnToId] = useState<string | null>(null)
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null)
  const [pullY, setPullY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [expandedThreads, setExpandedThreads] = useState<
    Record<string, boolean>
  >({})

  const [subtreeVibes, setSubtreeVibes] = useState<
    Record<string, { tag: string; summary: string }>
  >({})
  const [punchlines, setPunchlines] = useState<string[]>([])
  const [dopaStates, setDopaStates] = useState<
    Record<string, { loading: boolean; content: string | null }>
  >({})
  const [expandedDopaId, setExpandedDopaId] = useState<string | null>(null)
  const [expandedVibeId, setExpandedVibeId] = useState<string | null>(null)

  // [新增] 顶部 Header Vibe 展开状态
  const [isHeaderVibeExpanded, setIsHeaderVibeExpanded] = useState(false)
  const [viewingNote, setViewingNote] = useState<CulturalNote[] | null>(null)

  // --- Refs ---
  const touchStartRef = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bgPressTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleContextMenu = (e: Event) => {
      e.preventDefault()
      return false
    }
    window.addEventListener('contextmenu', handleContextMenu, { capture: true })
    return () =>
      window.removeEventListener('contextmenu', handleContextMenu, {
        capture: true,
      })
  }, [])

  useEffect(() => {
    if (quotedMessage && inputRef.current)
      setTimeout(() => inputRef.current?.focus(), 100)
  }, [quotedMessage])

  useEffect(() => {
    const fetchOp = async () => {
      const { data } = await supabase
        .from('production_posts')
        .select(
          'content_en, content_cn, title_en, title_cn, author, subreddit, sentence_segments, cultural_notes',
        )
        .eq('id', postId)
        .single()
      if (data)
        setOpPostData({
          content: data.content_en || data.title_en,
          content_cn: data.content_cn || data.title_cn,
          author: data.author || data.subreddit || 'OP',
          sentence_segments: data.sentence_segments,
          cultural_notes: data.cultural_notes,
        })
    }

    const fetchDopaMetadata = async () => {
      try {
        // 1. 从 subtree_vibes 表里同时查出 vibe_tag 和 punchline_comment_ids
        const { data: vibeData } = await supabase
          .from('subtree_vibes')
          .select(
            'root_comment_id, vibe_tag, dopa_summary, punchline_comment_ids',
          )
          .eq('post_id', postId)

        if (vibeData) {
          const vibesMap: Record<string, { tag: string; summary: string }> = {}
          let allPunchlines: string[] = [] // 用来收集这个帖子里所有的梗节点 ID

          vibeData.forEach((v) => {
            // 组装 Vibe 标签字典
            vibesMap[v.root_comment_id] = {
              tag: v.vibe_tag,
              summary: v.dopa_summary,
            }

            // 顺便解析并收集当前子树的 Punchline IDs
            if (v.punchline_comment_ids) {
              let parsedIds: any[] = []
              if (typeof v.punchline_comment_ids === 'string') {
                try {
                  parsedIds = JSON.parse(v.punchline_comment_ids)
                } catch {
                  parsedIds = []
                }
              } else if (Array.isArray(v.punchline_comment_ids)) {
                parsedIds = v.punchline_comment_ids
              }
              // 追加到总列表里
              allPunchlines = [
                ...allPunchlines,
                ...parsedIds.map((id) => String(id).trim()),
              ]
            }
          })

          setSubtreeVibes(vibesMap)
          setPunchlines(allPunchlines) // ✅ 正确设置红点触发列表
        }
      } catch (e) {
        console.warn('Dopa metadata not yet available on backend', e)
      }
    }

    fetchOp()
    fetchComments(postId)
    fetchDopaMetadata()
  }, [postId, fetchComments])

  const allComments = getComments(postId)
  const messages = useMessageTree(
    postId,
    opPostData,
    allComments,
    focusCommentId,
    expandedThreads,
    getDisplayAuthor
  )

  // [新增] 提取 ChatRoom 的主题氛围
  const roomVibe = focusCommentId ? subtreeVibes[focusCommentId] : null

  useEffect(() => {
    const lastMsg = messages[messages.length - 1]
    if (!lastMsg) return

    const shouldScroll =
      (lastMsg.isLocal &&
        !lastMsg.isLocalAi &&
        lastMsg.id !== flashMessageId) ||
      (lastMsg.isLocalAi && lastMsg.id !== flashMessageId)

    if (shouldScroll) {
      setFlashMessageId(lastMsg.id)
      setTimeout(() => {
        const el = document.getElementById(`msg-${lastMsg.id}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        } else {
          scrollContainerRef.current?.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'smooth',
          })
        }
      }, 150)
    }
  }, [messages, flashMessageId])

  const handleWordClick = async (word: string, context: string) => {
    if (navigator.vibrate) navigator.vibrate(20)
    const result = await triggerAnalysis(word, context)
    if (result) {
      useVocabularyStore.getState().registerWordLookup(result, context)
    }
    setViewingWord(word)
    setViewingWordContext(context)
  }

  const handleToggleDopa = async (commentId: string) => {
    if (navigator.vibrate) navigator.vibrate(20)
    // [新增核心修复]：阅后即焚逻辑
    // 如果这个评论带红点，只要用户点了一次，就把它从红点名单里永远踢出去
    if (punchlines.includes(commentId)) {
      setPunchlines((prev) => prev.filter((id) => id !== commentId))
    }
    if (expandedDopaId === commentId) {
      setExpandedDopaId(null)
      return
    }

    setExpandedDopaId(commentId)

    if (!dopaStates[commentId]?.content) {
      setDopaStates((prev) => ({
        ...prev,
        [commentId]: { loading: true, content: null },
      }))

      const targetMsg = messages.find((m) => m.id === commentId)
      const parentMsg = targetMsg?.parent_id
        ? messages.find((m) => m.id === targetMsg.parent_id)
        : null
      const opContentText = opPostData?.content || ''

      try {
        const { data, error } = await supabase.functions.invoke(
          'get-dopa-explanation',
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: {
              comment_id: commentId,
              commentId: commentId,
              targetContent: targetMsg?.content || '',
              parentContent: parentMsg?.content || '',
              opContent: opContentText,
            },
          },
        )
        if (error) throw error
        setDopaStates((prev) => ({
          ...prev,
          [commentId]: {
            loading: false,
            content: data?.explanation || 'Dopa还需要再研究一下这段话的意思。',
          },
        }))
      } catch (e) {
        setDopaStates((prev) => ({
          ...prev,
          [commentId]: {
            loading: false,
            content: '糟糕，连接到Dopa的神经元失败了。',
          },
        }))
      }
    }
  }

  const handleSend = async () => {
    if (!inputText.trim()) return
    if (isAiMode && quotedMessage) {
      const question = inputText
      setInputText('')
      setIsAiLoading(true)
      const userMsgId = `local-q-${Date.now()}`
      const userMsg: Comment = {
        id: userMsgId,
        post_id: postId,
        author: profile?.display_name || 'You',
        content: question,
        content_cn: '',
        depth: (quotedMessage.depth || 0) + 1,
        parent_id: quotedMessage.id,
        upvotes: 0,
        created_at: new Date().toISOString(),
        isLocal: true,
        isQuestion: true,
        replyToName: quotedMessage.author,
        replyText: quotedMessage.content,
      }
      addLocalComment(postId, userMsg)

      const loadingMsgId = `loading-${Date.now()}`
      addLocalComment(postId, {
        ...userMsg,
        id: loadingMsgId,
        isLocalAi: true,
        isLoading: true,
        author: quotedMessage.author,
        content: 'Replying...',
        replyToName: userMsg.author,
        replyText: userMsg.content,
      })

      setQuotedMessage(null)
      setIsAiMode(false)
      setHighlightedId(userMsgId)
      setTimeout(() => setHighlightedId(null), 2000)

      try {
        const { data, error } = await supabase.functions.invoke('chat', {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: {
            model: AI_MODEL,
            messages: [
              {
                role: 'system',
                content: `Simulate Reddit user "${quotedMessage.author}". Context: "${quotedMessage.content}". Q: "${question}". Concise.`,
              },
              { role: 'user', content: question },
            ],
          },
        })
        if (error) throw error
        deleteLocalComment(postId, loadingMsgId)
        addLocalComment(postId, {
          ...userMsg,
          id: `ai-${Date.now()}`,
          isLocalAi: true,
          author: quotedMessage.author,
          content: data.choices?.[0]?.message?.content || '...',
          depth: userMsg.depth + 1,
          parent_id: userMsgId,
          replyToName: userMsg.author,
          replyText: userMsg.content,
        })
      } catch (e) {
        console.error(e)
      } finally {
        setIsAiLoading(false)
      }
    } else {
      setInputText('')
    }
  }

  const handleJumpToWithReturn = (
    targetId: string | null,
    currentId: string,
  ) => {
    if (!targetId) return
    setReturnToId(currentId)
    const el = document.getElementById(`msg-${targetId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedId(targetId)
    setTimeout(() => setHighlightedId(null), 1500)
  }

  const handleBgTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('input') || contextMenu) return
    touchStartRef.current = e.touches[0].clientY
    setIsDragging(true)

    bgPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50)
      setShowGlobalTranslation((prev) => !prev)
    }, 400)
  }

  const handleBgTouchEnd = () => {
    if (bgPressTimerRef.current) clearTimeout(bgPressTimerRef.current)
    setIsDragging(false)
    setPullY(0)
  }

  const handleBgTouchMove = (e: React.TouchEvent) => {
    if (Math.abs(e.touches[0].clientY - touchStartRef.current) > 10) {
      if (bgPressTimerRef.current) clearTimeout(bgPressTimerRef.current)
    }
  }

  const handleBubbleLongPress = (e: any, msg: Comment) => {
    if (navigator.vibrate) navigator.vibrate(50)
    if (bgPressTimerRef.current) clearTimeout(bgPressTimerRef.current)
    setShowGlobalTranslation(false)

    if (msg.isLocalAi) {
      setQuotedMessage({ id: msg.id, author: 'Dopa', content: msg.content })
      setIsAiMode(true)
    } else {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      setContextMenu({ x: clientX, y: clientY, msg })
    }
  }

  const toggleSingleTranslation = (msgId: string) => {
    setExpandedTranslations((p) => ({ ...p, [msgId]: !p[msgId] }))
    setContextMenu(null)
  }
  const handleQuote = (msg: Comment) => {
    setQuotedMessage(msg)
    setIsAiMode(true)
    setContextMenu(null)
  }
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setContextMenu(null)
  }
  const handleBookmark = (msg: Comment) => {
    if (navigator.vibrate) navigator.vibrate(50)
    setContextMenu(null)
  }

  const DROPLET_SHAPE = '50% 50% 50% 50% / 60% 60% 43% 43%'

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[#FDFCFB] dark:bg-[#0B0A09] max-w-[100vw] overflow-x-hidden select-none overscroll-x-none !overscroll-x-none"
      onTouchStart={handleBgTouchStart}
      onTouchMove={handleBgTouchMove}
      onTouchEnd={handleBgTouchEnd}
      onContextMenu={(e) => e.preventDefault()}>
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-[-50%] bg-cover bg-center blur-[120px] opacity-20 animate-pulse-slow"
          style={{ backgroundImage: `url("${postImage}")` }}
        />
      </div>

      {viewingWord && (
        <WordDetailOverlay
          word={viewingWord}
          definition={getDefinition(viewingWord, viewingWordContext)}
          context={viewingWordContext}
          onClose={() => setViewingWord(null)}
        />
      )}

      {/* [新增] 顶部下拉 Vibe 提示面板 */}
      <AnimatePresence>
        {isHeaderVibeExpanded && roomVibe && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHeaderVibeExpanded(false)}
              className="fixed inset-0 z-[65] bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed left-4 right-4 z-[66] bg-gradient-to-br from-orange-50 to-amber-50 dark:from-[#1A1612] dark:to-[#1f1a14] border border-orange-200/60 dark:border-orange-500/20 rounded-2xl p-4 shadow-2xl"
              style={{ top: 'calc(5rem + env(safe-area-inset-top))' }}>
              <div className="flex gap-3 items-start">
                <span className="material-symbols-outlined text-[18px] text-orange-500 shrink-0">
                  info
                </span>
                <p className="text-[13px] leading-relaxed font-medium text-orange-900 dark:text-orange-200/90">
                  {roomVibe.summary}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGlobalTranslation && (
          <motion.div
            key="translation-mode-indicator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1 rounded-full text-white/80 text-xs font-bold z-50 backdrop-blur">
            Translation Mode
          </motion.div>
        )}

        {showSettings && (
          <DifficultySettings
            key="difficulty-settings-panel"
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            onClose={() => setShowSettings(false)}
          />
        )}

        {returnToId && (
          <motion.button
            key="return-to-id-btn"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={() => {
              handleJumpToWithReturn(returnToId, '')
              setReturnToId(null)
            }}
            className="fixed bottom-24 right-4 z-[80] bg-white/10 backdrop-blur border border-white/20 text-white p-3 rounded-full shadow-lg">
            <span className="material-symbols-outlined">u_turn_left</span>
          </motion.button>
        )}
        {contextMenu && (
          <MessageContextMenu
            key={`context-menu-${contextMenu.msg.id}`}
            x={contextMenu.x}
            y={contextMenu.y}
            msg={contextMenu.msg}
            isExpanded={!!expandedTranslations[contextMenu.msg.id]}
            onClose={() => setContextMenu(null)}
            onQuote={handleQuote}
            onToggleTranslation={toggleSingleTranslation}
            onCopy={handleCopy}
            onBookmark={handleBookmark}
            onDelete={(id) => {
              deleteLocalComment(postId, id)
              setContextMenu(null)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingNote && (
          <CulturalNoteOverlay
            notes={viewingNote}
            onClose={() => setViewingNote(null)}
          />
        )}
      </AnimatePresence>

      <div
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-5 bg-orange-500/90 dark:bg-black/40 backdrop-blur-3xl border-b border-orange-600/20 dark:border-white/5 z-[70]"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(4.5rem + env(safe-area-inset-top))',
        }}>
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-2xl shrink-0"
          style={{ borderRadius: DROPLET_SHAPE }}>
          <span className="material-symbols-outlined text-white">
            keyboard_arrow_down
          </span>
        </button>

        {/* [升级] 中部标题替换为房间主题 Vibe Tag */}
        <div className="flex flex-col items-center flex-1 mx-2">
          {roomVibe ? (
            <div
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(20)
                setIsHeaderVibeExpanded(!isHeaderVibeExpanded)
              }}
              className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-orange-400 animate-pulse">
                  auto_awesome
                </span>
                <span className="text-white font-black text-sm drop-shadow-md line-clamp-1 text-center">
                  {roomVibe.tag}
                </span>
                <span className="material-symbols-outlined text-[14px] text-white/60">
                  {isHeaderVibeExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </div>
              <span className="text-white/50 text-[9px] uppercase font-bold mt-0.5 tracking-wider">
                {messages.length - 1} RESPONSES
              </span>
            </div>
          ) : (
            <>
              <span className="text-white font-black text-sm">
                Thread Discussion
              </span>
              <span className="text-white/30 text-[10px] uppercase font-bold">
                {messages.length - 1} RESPONSES
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-2xl"
            style={{ borderRadius: DROPLET_SHAPE }}>
            <span className="material-symbols-outlined text-white text-[20px]">
              settings
            </span>
          </button>
        </div>
      </div>

      <div
        className="shrink-0"
        style={{ height: 'calc(4.5rem + env(safe-area-inset-top))' }}
      />

      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-5 py-6 pb-[90px] space-y-8 no-scrollbar relative z-10 overflow-x-visible overscroll-contain overscroll-x-none !overscroll-x-none touch-pan-y !touch-pan-y">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-4" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Loading Discussion...
            </span>
          </div>
        )}

        {postImage && (
          <div className="w-full aspect-video rounded-2xl overflow-hidden mb-6 shadow-2xl relative border border-white/10 group">
            <img
              src={postImage}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              alt="Post cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
          </div>
        )}

        {
          messages.map((msg, index) => {
            if (msg.isExpandButton) {
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center my-2">
                  <button
                    onClick={() =>
                      setExpandedThreads((p) => ({ ...p, [msg.parentId]: true }))
                    }
                    className="flex items-center gap-2 px-5 py-2 rounded-full bg-gray-100/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 active:scale-95 transition-transform">
                    <span className="material-symbols-outlined text-sm text-orange-500">
                      forum
                    </span>
                    <span className="text-[11px] font-black tracking-wide text-gray-500 dark:text-gray-400">
                      {msg.hiddenCount} MORE REPLIES ...
                    </span>
                  </button>
                </motion.div>
              )
            }

            if (msg.isCollapseButton) {
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center my-4">
                  <button
                    onClick={() =>
                      setExpandedThreads((p) => ({ ...p, [msg.parentId]: false }))
                    }
                    className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 active:scale-95 transition-transform">
                    <span className="material-symbols-outlined text-sm text-gray-400">
                      expand_less
                    </span>
                    <span className="text-[10px] font-bold tracking-wide text-gray-400 uppercase">
                      Collapse Replies
                    </span>
                  </button>
                </motion.div>
              )
            }

            const isOP = msg.id === 'op-message'
            const isRoot = index === 1
            const isUser = msg.isLocal && !msg.isLocalAi

            return (
              <React.Fragment key={msg.id || `msg-${index}`}>
                {isRoot && (
                  <div className="flex items-center justify-center gap-3 my-10 opacity-80 pointer-events-none">
                    <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-orange-500/40"></div>
                    <div className="flex items-center gap-1.5 text-orange-500">
                      <span className="material-symbols-outlined text-[14px]">
                        local_fire_department
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Hot Discussion
                      </span>
                      <span className="material-symbols-outlined text-[14px]">
                        local_fire_department
                      </span>
                    </div>
                    <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-orange-500/40"></div>
                  </div>
                )}

                <motion.div
                  id={`msg-${msg.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 overflow-visible ${isUser ? 'flex-row-reverse' : ''} ${highlightedId === msg.id ? 'bg-orange-500/10 -mx-3 px-3 py-2 rounded-2xl' : ''}`}>
                  <div className="shrink-0">
                    <div
                      className={`w-9 h-9 ${isOP ? 'rounded-xl' : 'rounded-full'} flex items-center justify-center border shadow-sm ${isOP ? 'bg-orange-500 text-white border-orange-600' : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/10 text-gray-400 overflow-hidden'}`}>
                      {isOP ? (
                        'OP'
                      ) : msg.isLocalAi ? (
                        <img
                          src={getAssetPath(IMAGES.aiDopa)}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : isUser ? (
                        <img
                          src={getAssetPath(IMAGES.avatarProfile)}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        getInitials(getDisplayAuthor(msg.author))
                      )}
                    </div>
                  </div>
                  <div
                    className={`flex flex-col gap-1.5 w-[85%] overflow-visible ${isUser ? 'items-end' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-gray-400 dark:text-white/30 uppercase">
                        {msg.isLocalAi ? 'Dopa' : getDisplayAuthor(msg.author)}
                      </span>
                    </div>

                    {msg.replyText && !isOP && !isRoot && (
                      <div
                        onClick={() =>
                          handleJumpToWithReturn(msg.parent_id, msg.id)
                        }
                        className="text-[10px] text-gray-400 border-l-2 border-orange-500/30 pl-2 mb-1 cursor-pointer line-clamp-1">
                        @{getDisplayAuthor(msg.replyToName || '')}:{' '}
                        {msg.replyText}
                      </div>
                    )}

                    {/* [更新] 对于非根评论的子树，依然在气泡上方显示氛围标签 */}
                    {subtreeVibes[msg.id] && msg.id !== focusCommentId && (
                      <div className="flex flex-col items-start w-full">
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => {
                            if (navigator.vibrate) navigator.vibrate(20)
                            setExpandedVibeId(
                              expandedVibeId === msg.id ? null : msg.id,
                            )
                          }}
                          className={`w-fit flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full cursor-pointer hover:shadow-[0_2px_12px_rgba(249,115,22,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all mb-1 border z-10 relative ${expandedVibeId === msg.id ? 'shadow-[0_2px_8px_rgba(249,115,22,0.5)] border-orange-200/50' : 'shadow-[0_2px_8px_rgba(249,115,22,0.3)] border-white/20'}`}>
                          <span className="material-symbols-outlined text-[12px] text-white animate-pulse">
                            auto_awesome
                          </span>
                          <span className="text-[10px] font-black text-white tracking-widest uppercase">
                            {subtreeVibes[msg.id].tag}
                          </span>
                        </motion.div>

                        <AnimatePresence>
                          {expandedVibeId === msg.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden w-[95%]">
                              <div className="mb-2 mt-1 p-3 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-[#1A1612] dark:to-[#1f1a14] border border-orange-200/60 dark:border-orange-500/20 rounded-xl relative before:content-[''] before:absolute before:-top-1.5 before:left-6 before:w-3 before:h-3 before:bg-orange-50 dark:before:bg-[#1A1612] before:border-l before:border-t before:border-orange-200/60 dark:before:border-orange-500/20 before:rotate-45 shadow-sm">
                                <div className="flex gap-2 items-start">
                                  <span className="material-symbols-outlined text-[14px] text-orange-500 shrink-0 mt-0.5">
                                    info
                                  </span>
                                  <p className="text-[12px] leading-relaxed font-medium text-orange-900 dark:text-orange-200/80">
                                    {subtreeVibes[msg.id].summary}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <MessageBubble
                      comment={msg}
                      isUser={isUser}
                      isOpCard={isOP}
                      onWordClick={(w, ctx) => {
                        handleWordClick(w, ctx)
                      }}
                      onLongPress={handleBubbleLongPress}
                      showTranslation={
                        showGlobalTranslation || expandedTranslations[msg.id]
                      }
                      highlightedId={highlightedId}
                      difficulty={difficulty}
                    />

                    {!isOP && (
                      <div className="flex flex-col gap-1 w-full relative">
                        <div
                          className={`flex items-center gap-3 mt-0.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                          <MiniReactionButton upvotes={msg.upvotes || 0} />

                          <button
                            onClick={() => handleToggleDopa(msg.id)}
                            className={`text-[10px] font-bold uppercase flex items-center gap-1 transition-colors ${expandedDopaId === msg.id ? 'text-orange-500' : 'text-gray-400 dark:text-white/40 hover:text-orange-500'}`}>
                            <div className="relative inline-flex items-center justify-center">
                              <img
                                src={getAssetPath(IMAGES.aiDopa)}
                                className="w-[18px] h-[18px] rounded-full object-cover shadow-sm border border-orange-200 dark:border-white/10"
                              />
                            </div>
                            Dopa
                          </button>

                          <button
                            onClick={() => {
                              if (navigator.share)
                                navigator.share({
                                  title: 'Scrollish',
                                  text: msg.content,
                                })
                            }}
                            className="text-[10px] text-gray-400 dark:text-white/40 font-bold uppercase flex items-center gap-0.5 hover:text-orange-500 transition-colors">
                            <span className="material-symbols-outlined text-[14px]">
                              ios_share
                            </span>
                          </button>
                        </div>

                        <AnimatePresence>
                          {expandedDopaId === msg.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden w-full">
                              <div className="mt-2 p-3.5 bg-orange-50 dark:bg-[#1A1612] border border-orange-200 dark:border-orange-500/20 rounded-2xl flex gap-3 items-start relative before:content-[''] before:absolute before:-top-1.5 before:left-14 before:w-3 before:h-3 before:bg-orange-50 dark:before:bg-[#1A1612] before:border-l before:border-t before:border-orange-200 dark:before:border-orange-500/20 before:rotate-45">
                                <img
                                  src={getAssetPath(IMAGES.aiDopa)}
                                  className="w-7 h-7 rounded-full shrink-0 shadow-sm border border-orange-200 dark:border-orange-500/30"
                                />
                                <div className="flex-1 text-[13px] leading-relaxed font-medium text-gray-800 dark:text-gray-300 pt-0.5 whitespace-pre-wrap">
                                  {dopaStates[msg.id]?.loading ? (
                                    <div className="flex gap-1.5 items-center h-5 opacity-60">
                                      <span
                                        className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"
                                        style={{ animationDelay: '0ms' }}
                                      />
                                      <span
                                        className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"
                                        style={{ animationDelay: '150ms' }}
                                      />
                                      <span
                                        className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"
                                        style={{ animationDelay: '300ms' }}
                                      />
                                    </div>
                                  ) : (
                                    <TypewriterText
                                      text={dopaStates[msg.id]?.content || ''}
                                    />
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </motion.div>
              </React.Fragment>
            )
          })
        }

        {
          messages.length > 0 && (
            <div className="flex items-center justify-center gap-3 pt-8 pb-4 opacity-50 pointer-events-none select-none">
              <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-gray-400/40"></div>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400">
                到底啦！
              </span>
              <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-gray-400/40"></div>
            </div>
          )
        }
      </main >

      <div className="fixed bottom-6 left-4 right-4 z-50 pointer-events-auto">
        <div
          className={`p-2 rounded-[2rem] backdrop-blur-3xl transition-all ${isAiMode ? 'bg-white/90 dark:bg-white/10 border border-orange-500/50 shadow-2xl' : 'bg-gray-100/50 dark:bg-white/5 border-0 opacity-60'}`}>
          {quotedMessage && (
            <div className="flex justify-between items-center px-3 py-1 mb-2 bg-orange-500/10 rounded-full">
              <span className="text-[10px] text-orange-600 font-bold truncate">
                ✨ Ask {getDisplayAuthor(quotedMessage.author)}
              </span>
              <button
                onClick={() => {
                  setQuotedMessage(null)
                  setIsAiMode(false)
                }}>
                <span className="material-symbols-outlined text-sm text-gray-500">
                  close
                </span>
              </button>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!isAiMode}
              placeholder={
                isAiMode ? 'Ask Dopa...' : 'Select a sentence to ask'
              }
              className="flex-1 bg-transparent px-4 h-10 outline-none border-none focus:outline-none focus:ring-0 text-sm dark:text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={!isAiMode}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${isAiMode ? 'bg-orange-500 shadow-lg' : 'bg-gray-300 dark:bg-white/10'}`}>
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
          </div>
        </div>
      </div>
      <style>{`.menu-item { @apply w-full text-left px-4 py-2 text-sm hover:bg-white/10 flex items-center gap-2; }`}</style>
      <SpeakingAvatarOverlay />
    </div >
  )
}

export default ChatRoom
