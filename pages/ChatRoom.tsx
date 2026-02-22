import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import { useCommentStore } from '../store/useCommentStore'
import { useDictionaryStore } from '../store/useDictionaryStore'
import { useUserStore } from '../store/useUserStore'
import { Comment, CulturalNote } from '../types'
import { getAssetPath, IMAGES } from '../constants'
import WordDetailOverlay from '../components/WordDetailOverlay'
import MessageBubble from '../components/MessageBubble'

const AI_MODEL = 'deepseek-ai/DeepSeek-V2.5'

interface ChatRoomProps {
  postId: string
  postImage?: string
  focusCommentId?: string | null
  onBack: () => void
}

type DifficultyLevel =
  | 'Original'
  | 'Mixed'
  | 'Basic'
  | 'Intermediate'
  | 'Expert'

// 气泡底部的轻量级表情互动区
const MiniReactionButton = ({ upvotes }: { upvotes: number }) => {
  const [isLiked, setIsLiked] = useState(false)
  const [count, setCount] = useState(upvotes)

  const bubbleVariants = {
    initial: { opacity: 0, scale: 0, x: 0, y: 0 },
    animate: (i: number) => {
      const angle = (i / 15) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
      const distance = 15 + Math.random() * 15
      return {
        opacity: [0, 1, 1, 0],
        scale: [0, 1 + Math.random() * 0.3, 0.4, 0],
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        transition: { duration: 0.6 + Math.random() * 0.4, ease: 'circOut' },
      }
    },
  }

  const handleLike = () => {
    if (navigator.vibrate) navigator.vibrate(20)
    setIsLiked(!isLiked)
    setCount((c) => (isLiked ? c - 1 : c + 1))
  }

  return (
    <div className="relative flex items-center">
      <div className="absolute top-1/2 left-3 -translate-y-1/2 w-0 h-0 pointer-events-none z-0">
        {isLiked &&
          [...Array(15)].map((_, i) => (
            <motion.div
              key={`p-${i}`}
              custom={i}
              variants={bubbleVariants}
              initial="initial"
              animate="animate"
              className="absolute w-1 h-1 rounded-full bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.6)]"
            />
          ))}
      </div>
      <motion.button
        whileTap={{ scale: 0.8 }}
        onClick={handleLike}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors z-10 ${isLiked ? 'bg-orange-500/10' : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}>
        <motion.span
          animate={isLiked ? { scale: [0.8, 1.3, 1] } : { scale: 1 }}
          className={`material-symbols-outlined text-[14px] ${isLiked ? 'text-orange-500 fill-[1]' : 'text-gray-400'}`}>
          favorite
        </motion.span>
        <span
          className={`text-[11px] font-black ${isLiked ? 'text-orange-500' : 'text-gray-400'}`}>
          {count}
        </span>
      </motion.button>
    </div>
  )
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
  const { profile, registerWordLookup } = useUserStore()

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
  const messages = useMemo(() => {
    if (!opPostData || !allComments.length || !focusCommentId) return []
    const opMessage: Comment = {
      id: 'op-message',
      post_id: postId,
      author: opPostData.author,
      content: opPostData.content,
      content_cn: opPostData.content_cn,
      upvotes: 0,
      depth: -1,
      parent_id: null,
      created_at: new Date().toISOString(),
      enrichment: {
        sentence_segments: opPostData.sentence_segments,
        cultural_notes: opPostData.cultural_notes || [],
      } as any,
    }
    const rootComment = allComments.find((c) => c.id === focusCommentId)
    if (!rootComment) return [opMessage]

    const childrenMap = new Map<string, Comment[]>()
    const opChildren: Comment[] = []
    allComments.forEach((c) => {
      if (c.parent_id === 'op-message') opChildren.push(c)
      else if (c.parent_id) {
        if (!childrenMap.has(c.parent_id)) childrenMap.set(c.parent_id, [])
        childrenMap.get(c.parent_id)?.push(c)
      }
    })

    const countDescendants = (pid: string): number => {
      const children = childrenMap.get(pid) || []
      return (
        children.length +
        children.reduce((acc, c) => acc + countDescendants(c.id), 0)
      )
    }

    const result: any[] = [opMessage]

    // 递归遍历加入 currentDepth 参数，控制折叠
    const traverse = (parentId: string, currentDepth: number) => {
      const children = childrenMap.get(parentId) || []
      if (children.length === 0) return

      // [核心折叠逻辑] 如果相对深度 >= 2 且未被用户显式展开，则显示展开按钮
      if (currentDepth >= 2 && !expandedThreads[parentId]) {
        result.push({
          id: `expand-btn-${parentId}`,
          isExpandButton: true, // 标记为展开按钮
          parentId: parentId,
          hiddenCount: countDescendants(parentId),
        })
        return
      }

      children.sort((a, b) => {
        if (a.isLocal && !b.isLocal) return -1
        if (!a.isLocal && b.isLocal) return 1
        return (b.upvotes || 0) - (a.upvotes || 0)
      })

      children.forEach((child) => {
        const parentNode =
          allComments.find((p) => p.id === parentId) ||
          (parentId === 'op-message' ? opMessage : null)
        result.push({
          ...child,
          replyToName: getDisplayAuthor(parentNode?.author || ''),
          replyText: parentNode?.content,
        })
        traverse(child.id, currentDepth + 1)
      })

      // [新增] 如果该层级已展开且深度>=2，在所有子评论遍历完后，添加一个“收起”按钮
      if (currentDepth >= 2 && expandedThreads[parentId]) {
        result.push({
          id: `collapse-btn-${parentId}`,
          isCollapseButton: true, // 标记为收起按钮
          parentId: parentId,
        })
      }
    }

    const traverseOpChildren = (nodes: Comment[]) => {
      nodes.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      nodes.forEach((child) => {
        result.push({
          ...child,
          replyToName: 'OP',
          replyText: opMessage.content,
        })
        traverse(child.id, 1)
      })
    }

    traverseOpChildren(opChildren)
    result.push({ ...rootComment, replyToName: 'OP' })
    traverse(focusCommentId, 1)

    return result
  }, [allComments, focusCommentId, opPostData, expandedThreads])

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
      useUserStore.getState().registerWordLookup(result, context)
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1 rounded-full text-white/80 text-xs font-bold z-50 backdrop-blur">
            Translation Mode
          </motion.div>
        )}

        {/* 难度设置侧边栏 */}
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[120]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[280px] bg-white dark:bg-[#1C1C1E] z-[121] shadow-2xl p-6 flex flex-col pt-[env(safe-area-inset-top)]">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-black dark:text-white">
                    Settings
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Difficulty Level
                  </p>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-white/5 rounded-full text-gray-400">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
                {[
                  {
                    id: 'Original',
                    label: 'Original',
                    desc: '原汁原味 Reddit 评论',
                  },
                  {
                    id: 'Mixed',
                    label: 'Mixed',
                    desc: '入门级：中英混排，保留核心词',
                  },
                  {
                    id: 'Basic',
                    label: 'Basic',
                    desc: '基础级：词汇量 2000 以内',
                  },
                  {
                    id: 'Intermediate',
                    label: 'Intermediate',
                    desc: '进阶级：英语四六级水平',
                  },
                  {
                    id: 'Expert',
                    label: 'Expert',
                    desc: '精通级：雅思/母语级表达',
                  },
                ].map((level) => (
                  <button
                    key={level.id}
                    onClick={() => {
                      setDifficulty(level.id as DifficultyLevel)
                      setShowSettings(false)
                      if (navigator.vibrate) navigator.vibrate(50)
                    }}
                    className={`w-full p-4 rounded-2xl text-left transition-all border ${
                      difficulty === level.id
                        ? 'bg-orange-500 border-orange-600 shadow-lg shadow-orange-500/20'
                        : 'bg-gray-50 dark:bg-white/5 border-transparent hover:border-gray-200 dark:hover:border-white/10'
                    }`}>
                    <div
                      className={`font-black text-sm mb-1 ${
                        difficulty === level.id
                          ? 'text-white'
                          : 'dark:text-white'
                      }`}>
                      {level.label}
                    </div>
                    <div
                      className={`text-[11px] leading-tight ${
                        difficulty === level.id
                          ? 'text-white/80'
                          : 'text-gray-400'
                      }`}>
                      {level.desc}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10">
                <p className="text-[10px] leading-relaxed text-orange-600 font-medium">
                  💡 Tips: Level adjustments are powered by Dopa to make
                  learning more efficient.
                </p>
              </div>
            </motion.div>
          </>
        )}

        {returnToId && (
          <motion.button
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
          <>
            <div
              className="fixed inset-0 z-[100]"
              onClick={() => setContextMenu(null)}
            />
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="fixed z-[101] bg-white dark:bg-[#1C1C1E] border border-white/10 rounded-xl shadow-2xl p-1 min-w-[150px]"
              style={{
                left: Math.min(contextMenu.x, window.innerWidth - 190),
                top: Math.min(contextMenu.y, window.innerHeight - 240),
              }}>
              <button
                onClick={() => handleQuote(contextMenu.msg)}
                className="menu-item text-orange-500">
                <span className="material-symbols-outlined text-sm">
                  format_quote
                </span>{' '}
                Quote
              </button>
              <button
                onClick={() => toggleSingleTranslation(contextMenu.msg.id)}
                className="menu-item dark:text-white">
                <span className="material-symbols-outlined text-sm">
                  translate
                </span>{' '}
                {expandedTranslations[contextMenu.msg.id]
                  ? 'Hide'
                  : 'Translate'}
              </button>
              <button
                onClick={() => handleCopy(contextMenu.msg.content)}
                className="menu-item dark:text-white">
                <span className="material-symbols-outlined text-sm">
                  content_copy
                </span>{' '}
                Copy
              </button>
              <button
                onClick={() => handleBookmark(contextMenu.msg)}
                className="menu-item dark:text-white">
                <span className="material-symbols-outlined text-sm">
                  bookmark
                </span>{' '}
                Bookmark
              </button>
              {contextMenu.msg.isLocal && (
                <button
                  onClick={() => {
                    deleteLocalComment(postId, contextMenu.msg.id)
                    setContextMenu(null)
                  }}
                  className="menu-item text-red-500">
                  <span className="material-symbols-outlined text-sm">
                    delete
                  </span>{' '}
                  Delete
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {viewingNote && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center px-4 pb-10">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewingNote(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="relative w-full max-w-lg bg-white dark:bg-[#1C1C1E] rounded-[2.5rem] p-8 shadow-2xl border border-white/20 overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-orange-500 flex items-center gap-2">
                  <span className="material-symbols-outlined">lightbulb</span>
                  Cultural Insights
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                  Slang & Context Notes
                </p>
              </div>
              <button
                onClick={() => setViewingNote(null)}
                className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-white/5 rounded-full text-gray-400">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-6 max-h-[50vh] overflow-y-auto no-scrollbar pb-4">
              {viewingNote.map((note, idx) => (
                <div key={idx} className="group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 rounded-md text-xs font-black uppercase">
                      {note.trigger_word}
                    </span>
                    <div className="h-[1px] flex-1 bg-gray-100 dark:bg-white/5" />
                  </div>
                  <p className="text-[14px] leading-relaxed text-gray-700 dark:text-gray-300 font-medium">
                    {note.explanation}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-white/5">
              <button
                onClick={() => setViewingNote(null)}
                className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-transform">
                Got it
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-5 bg-orange-500/90 dark:bg-black/40 backdrop-blur-3xl border-b border-orange-600/20 dark:border-white/5 z-[70]"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(4.5rem + env(safe-area-inset-top))',
        }}>
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-2xl"
          style={{ borderRadius: DROPLET_SHAPE }}>
          <span className="material-symbols-outlined text-white">
            keyboard_arrow_down
          </span>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-white font-black text-sm">
            Thread Discussion
          </span>
          <span className="text-white/30 text-[10px] uppercase font-bold">
            {messages.length - 1} RESPONSES
          </span>
        </div>
        <button
          className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-2xl opacity-40 cursor-not-allowed"
          style={{ borderRadius: DROPLET_SHAPE }}>
          <span className="material-symbols-outlined text-white text-[20px]">
            lock
          </span>
        </button>
      </div>

      <div
        className="shrink-0"
        style={{ height: 'calc(4.5rem + env(safe-area-inset-top))' }}
      />

      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-5 py-6 pb-[90px] space-y-8 no-scrollbar relative z-10 overflow-x-visible overscroll-contain overscroll-x-none !overscroll-x-none touch-pan-y !touch-pan-y">
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
            <React.Fragment key={msg.id}>
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
    </div>
  )
}

export default ChatRoom
