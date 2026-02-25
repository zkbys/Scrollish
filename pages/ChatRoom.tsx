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
  const [viewingNote, setViewingNote] = useState<CulturalNote[] | null>(null)
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

  // 追踪折叠分支状态
  const [expandedThreads, setExpandedThreads] = useState<
    Record<string, boolean>
  >({})

  // --- Refs ---
  const touchStartRef = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bgPressTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Context Menu & Focus
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

  // 2. Fetch Data
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
    fetchOp()
    fetchComments(postId)
  }, [postId, fetchComments])

  // 3. Build Message Tree (Including Folding Logic)
  const allComments = getComments(postId)
  const messages = useMessageTree(
    postId,
    opPostData,
    allComments,
    focusCommentId,
    expandedThreads,
    getDisplayAuthor
  )

  // 4. Auto Scroll
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

  // --- Actions ---
  const handleWordClick = async (word: string, context: string) => {
    if (navigator.vibrate) navigator.vibrate(20)
    const result = await triggerAnalysis(word, context)
    if (result) {
      useVocabularyStore.getState().registerWordLookup(result, context)
    }
    setViewingWord(word)
    setViewingWordContext(context)
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

  // Navigation
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

  // 9. 背景长按 (翻译Peek模式 -> 切换模式)
  const handleBgTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('input') || contextMenu) return
    touchStartRef.current = e.touches[0].clientY
    setIsDragging(true)

    bgPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50)
      setShowGlobalTranslation((prev) => !prev)
    }, 200)
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

  // 10. 气泡长按 (菜单)
  const handleBubbleLongPress = (e: any, msg: Comment) => {
    if (navigator.vibrate) navigator.vibrate(50)
    if (bgPressTimerRef.current) clearTimeout(bgPressTimerRef.current)

    if (msg.isLocalAi) {
      setQuotedMessage({ id: msg.id, author: 'Dopa', content: msg.content })
      setIsAiMode(true)
    } else {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      setContextMenu({ x: clientX, y: clientY, msg })
    }
  }

  // Menu Actions
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

      {viewingNote && (
        <CulturalNoteOverlay
          notes={viewingNote}
          onClose={() => setViewingNote(null)}
        />
      )}

      <ChatRoomHeader
        onBack={onBack}
        onSettings={() => setShowSettings(true)}
        responsesCount={messages.length - 1}
      />

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

        {/* [新增] 顶部多媒体封面图区域 */}
        {postImage && (
          <div className="w-full aspect-video rounded-2xl overflow-hidden mb-6 shadow-2xl relative border border-white/10 group">
            <img
              src={postImage}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              alt="Post cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
            {/* <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur px-2 py-1 rounded-lg border border-white/10">
              <span className="text-[10px] text-white/80 font-bold uppercase">
                Cover Image
              </span>
            </div> */}
          </div>
        )}

        {messages.map((msg, index) => {
          // 渲染折叠/展开按钮
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

          // [新增] 渲染收起按钮
          if (msg.isCollapseButton) {
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-center my-4">
                <button
                  onClick={() => {
                    setExpandedThreads((p) => ({ ...p, [msg.parentId]: false }))
                    // 可选：收起时滚动回到父评论位置，提升体验
                    // document.getElementById(`msg-${msg.parentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
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
          const isRoot = index === 1 // 位于OP之后的第一条评论（注意：有了封面图后 index 逻辑不变，因为图片不是 message）
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
                  className={`flex flex-col gap-1.5 max-w-[85%] overflow-visible ${isUser ? 'items-end' : ''}`}>
                  <span className="text-[11px] font-black text-gray-400 dark:text-white/30 uppercase">
                    {msg.isLocalAi ? 'Dopa' : getDisplayAuthor(msg.author)}
                  </span>
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

                  <MessageBubble
                    comment={msg}
                    isUser={isUser}
                    onWordClick={(w, ctx) => {
                      handleWordClick(w, ctx)
                    }}
                    onLongPress={handleBubbleLongPress}
                    onNoteClick={setViewingNote}
                    showTranslation={
                      showGlobalTranslation || expandedTranslations[msg.id]
                    }
                    highlightedId={highlightedId}
                    difficulty={difficulty}
                  />

                  {!isOP && (
                    <div
                      className={`flex items-center gap-3 mt-0.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                      <MiniReactionButton upvotes={msg.upvotes || 0} />
                      <button
                        onClick={() => handleQuote(msg)}
                        className="text-[10px] text-gray-400 dark:text-white/40 font-bold uppercase flex items-center gap-0.5 hover:text-orange-500 transition-colors">
                        <span className="material-symbols-outlined text-[14px]">
                          reply
                        </span>
                        Reply
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </React.Fragment>
          )
        })}
      </main>

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
