import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import { useCommentStore } from '../store/useCommentStore'
import { useDictionaryStore } from '../store/useDictionaryStore'
import { Comment, CulturalNote } from '../types'
import InteractiveText from '../components/InteractiveText'
import WordDetailOverlay from '../components/WordDetailOverlay'

const AI_MODEL = 'deepseek-ai/DeepSeek-V2.5'

interface ChatRoomProps {
  postId: string
  postImage?: string // [新增] 用于背景虚化一致性
  focusCommentId?: string | null
  onBack: () => void
}

type DifficultyLevel =
  | 'Original'
  | 'Mixed'
  | 'IELTS'
  | 'CET6'
  | 'CET4'
  | 'HighSchool'
  | 'MiddleSchool'
  | 'PrimarySchool'

const ChatRoom: React.FC<ChatRoomProps> = ({
  postId,
  postImage,
  focusCommentId,
  onBack,
}) => {
  // --- Stores ---
  const { getComments, fetchComments, addLocalComment, deleteLocalComment } =
    useCommentStore()
  const { getDefinition, triggerAnalysis } = useDictionaryStore()

  // --- State: Data & Content ---
  const [opPostData, setOpPostData] = useState<{
    content: string
    content_cn: string
    author: string
  } | null>(null)
  const [inputText, setInputText] = useState('')
  const [quotedMessage, setQuotedMessage] = useState<Comment | null>(null)

  // --- State: UI & Interaction ---
  const [viewingWord, setViewingWord] = useState<string | null>(null)
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

  // --- State: AI & Difficulty ---
  const [isAiMode, setIsAiMode] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Original')

  // --- State: Navigation & Highlight ---
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [returnToId, setReturnToId] = useState<string | null>(null)
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null)

  // --- State: Gestures ---
  const [pullY, setPullY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // --- Refs ---
  const touchStartRef = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bgPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const bubblePressTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 1. 全局抑制浏览器默认菜单
  useEffect(() => {
    const handleContextMenu = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
    window.addEventListener('contextmenu', handleContextMenu, { capture: true })
    return () =>
      window.removeEventListener('contextmenu', handleContextMenu, {
        capture: true,
      })
  }, [])

  // 2. 自动聚焦 Effect：当进入引用模式时，自动拉起键盘
  useEffect(() => {
    if (quotedMessage && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [quotedMessage])

  // 3. Fetch OP Data & Comments
  useEffect(() => {
    const fetchOp = async () => {
      const { data } = await supabase
        .from('production_posts')
        .select('*')
        .eq('id', postId)
        .single()
      if (data) {
        setOpPostData({
          content: data.content_en || data.title_en,
          content_cn: data.content_cn || data.title_cn,
          author: data.author || data.subreddit || 'OP',
        })
      }
    }
    fetchOp()
    fetchComments(postId)
  }, [postId, fetchComments])

  const allComments = getComments(postId)

  // 4. 构建消息树 (OP -> OP追问 -> Top Comment -> Children)
  const messages = useMemo(() => {
    if (!opPostData || !allComments.length || !focusCommentId) return []

    // A. 构造 OP 消息
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
      enrichment: { sentence_segments: null, cultural_notes: [] } as any,
    }

    const rootComment = allComments.find((c) => c.id === focusCommentId)
    if (!rootComment) return [opMessage]

    // B. 建立索引
    const childrenMap = new Map<string, Comment[]>()
    // 特殊处理：找出所有回复给 'op-message' 的本地消息
    const opChildren: Comment[] = []

    allComments.forEach((c) => {
      if (c.parent_id === 'op-message') {
        opChildren.push(c)
      } else if (c.parent_id) {
        if (!childrenMap.has(c.parent_id)) childrenMap.set(c.parent_id, [])
        childrenMap.get(c.parent_id)?.push(c)
      }
    })

    const result: Comment[] = []

    // C. 压入 OP
    result.push(opMessage)

    // D. 压入 OP 的追问 (插在 Top Comment 之前)
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
        // 检查该追问是否有 AI 回复
        if (childrenMap.has(child.id)) {
          traverse(child.id) // 复用通用遍历逻辑
        }
      })
    }
    traverseOpChildren(opChildren)

    // E. 压入 Top Comment (Sub-OP)
    result.push({ ...rootComment, replyToName: 'OP' })

    // F. 遍历 Top Comment 的子树
    const traverse = (parentId: string) => {
      const children = childrenMap.get(parentId) || []

      children.sort((a, b) => {
        // 核心修复：本地消息 (用户追问/AI回复) 永远排在最前 (紧贴父节点)
        if (a.isLocal && !b.isLocal) return -1
        if (!a.isLocal && b.isLocal) return 1
        if (a.isLocal && b.isLocal) {
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        }
        return (b.upvotes || 0) - (a.upvotes || 0)
      })

      children.forEach((child) => {
        const parentNode =
          allComments.find((p) => p.id === parentId) ||
          (parentId === 'op-message' ? opMessage : null)
        result.push({
          ...child,
          replyToName: parentNode?.author,
          replyText: parentNode?.content,
        })
        traverse(child.id)
      })
    }
    traverse(focusCommentId)

    return result
  }, [allComments, focusCommentId, opPostData])

  // 5. 新消息自动滚动
  useEffect(() => {
    const lastMsg = messages[messages.length - 1]
    if (lastMsg && lastMsg.isLocalAi && lastMsg.id !== flashMessageId) {
      setFlashMessageId(lastMsg.id)
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'smooth',
          })
        }
      }, 100)
    }
  }, [messages])

  const getInitials = (name: string) =>
    name ? name.substring(0, 2).toUpperCase() : '??'

  // 6. 分句与难度处理逻辑
  const getDisplaySentences = (msg: Comment) => {
    // A. 难度替换 (AI Rewriting)
    if (difficulty !== 'Original' && msg.enrichment?.difficulty_variants) {
      const variant = msg.enrichment.difficulty_variants[difficulty]
      if (variant && variant.content) {
        try {
          // @ts-ignore
          const segmenter = new Intl.Segmenter('en', {
            granularity: 'sentence',
          })
          return [...segmenter.segment(variant.content)]
            .map((s: any) => ({
              en: s.segment.trim(),
              zh: msg.content_cn,
            }))
            .filter((s: any) => s.en.length > 0)
        } catch {
          return [{ en: variant.content, zh: msg.content_cn }]
        }
      }
    }

    // B. OP 消息强制分句
    if (msg.id === 'op-message') {
      const text = msg.content || ''
      const rawSentences = text.match(
        /[^.!?。！？\n]+[.!?。！？\n]+|[^.!?。！？\n]+$/g,
      ) || [text]
      return rawSentences.map((en) => ({ en: en.trim(), zh: null }))
    }

    // C. 普通消息
    let segments: { en: string; zh: string | null }[] = []
    if (msg.enrichment?.sentence_segments) {
      segments = msg.enrichment.sentence_segments
    } else {
      // 降级分句
      try {
        // @ts-ignore
        const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
        segments = [...segmenter.segment(msg.content)].map((s: any) => ({
          en: s.segment.trim(),
          zh: msg.content_cn,
        }))
      } catch {
        segments = [{ en: msg.content, zh: msg.content_cn }]
      }
    }
    // 过滤空白气泡
    return segments.filter((s) => s.en && s.en.trim() !== '')
  }

  const handleWordClick = async (word: string, context: string, msg?: Comment) => {
    const cachedResult = await triggerAnalysis(word, context)
    setViewingWord(word)

    // 如果已经在 AI 追问模式，且用户点击了新的句子，同步更新引用
    if (isAiMode && msg) {
      setQuotedMessage({
        id: msg.id,
        author: msg.isLocalAi ? 'Dopa' : msg.author,
        content: context
      })
    }
  }

  // 7. 发送消息逻辑 (含 AI 模拟)
  const handleSend = async () => {
    if (!inputText.trim()) return

    if (isAiMode && quotedMessage) {
      const questionContent = inputText
      setInputText('')
      setIsAiLoading(true)

      const userQuestionId = `local-q-${Date.now()}`
      const userQuestionMsg: Comment = {
        id: userQuestionId,
        post_id: postId,
        author: 'You',
        content: questionContent,
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
      addLocalComment(postId, userQuestionMsg)

      // 定位到用户发送消息的位置
      setTimeout(() => {
        const el = document.getElementById(`msg-${userQuestionId}`)
        if (el && scrollContainerRef.current) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)

      setQuotedMessage(null)
      setIsAiMode(false)
      setHighlightedId(userQuestionId)
      setTimeout(() => setHighlightedId(null), 2000)

      try {
        const { data, error } = await supabase.functions.invoke('chat', {
          body: {
            model: AI_MODEL,
            messages: [
              {
                role: 'system',
                content: `Simulate Reddit user "${quotedMessage.author}". Context: "${quotedMessage.content}". Q: "${questionContent}". Reply as "${quotedMessage.author}" concisely.`,
              },
              { role: 'user', content: questionContent },
            ],
          },
        })

        if (error) throw error

        const aiReply = data.choices?.[0]?.message?.content || '...'

        const aiAnswerMsg: Comment = {
          id: `local-ai-${Date.now()}`,
          post_id: postId,
          author: quotedMessage.author,
          content: aiReply,
          content_cn: '',
          depth: userQuestionMsg.depth + 1,
          parent_id: userQuestionId,
          upvotes: 0,
          created_at: new Date(Date.now() + 100).toISOString(),
          isLocal: true,
          isLocalAi: true,
          replyToName: 'You',
          replyText: questionContent,
        }
        addLocalComment(postId, aiAnswerMsg)

      } catch (error) {
        console.error('AI API Error:', error)
      } finally {
        setIsAiLoading(false)
      }
    } else {
      console.log('Sending normal reply:', inputText)
      setInputText('')
    }
  }

  // 8. 跳转逻辑
  const handleJumpTo = (targetId: string | null) => {
    if (!targetId) return
    const el = document.getElementById(`msg-${targetId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedId(targetId)
      setTimeout(() => setHighlightedId(null), 1500)
    }
  }
  const handleJumpToWithReturn = (
    targetParentId: string | null,
    currentMsgId: string,
  ) => {
    if (!targetParentId) return
    setReturnToId(currentMsgId)
    handleJumpTo(targetParentId)
  }
  const handleReturnJump = () => {
    if (returnToId) {
      handleJumpTo(returnToId)
      setReturnToId(null)
    }
  }

  // 9. 背景长按 (翻译)
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
    const moveY = Math.abs(e.touches[0].clientY - touchStartRef.current)
    // 灵敏度极致优化：位移超过 3px 判定为滑动，立即取消长按翻译定时器
    if (moveY > 3) {
      if (bgPressTimerRef.current) {
        clearTimeout(bgPressTimerRef.current)
        bgPressTimerRef.current = null
      }
    }
  }

  // 10. 气泡长按 (菜单)
  const handleBubbleTouchStart = (e: React.TouchEvent, msg: Comment) => {
    e.stopPropagation()
    const touch = e.touches[0]
    const x = touch.clientX
    const y = touch.clientY
    bubblePressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50)
      if (msg.isLocalAi) {
        // AI 消息长按直接进入追问模式
        setQuotedMessage({
          id: msg.id,
          author: 'Dopa',
          content: msg.content,
        })
        setIsAiMode(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      } else {
        setContextMenu({ x, y, msg })
      }
    }, 500)
  }
  const handleBubbleTouchEnd = () => {
    if (bubblePressTimerRef.current) {
      clearTimeout(bubblePressTimerRef.current)
      bubblePressTimerRef.current = null
    }
  }
  const handleBubbleTouchMove = () => {
    if (bubblePressTimerRef.current) {
      clearTimeout(bubblePressTimerRef.current)
      bubblePressTimerRef.current = null
    }
  }

  // 11. 菜单动作
  const toggleSingleTranslation = (msgId: string) => {
    setExpandedTranslations((prev) => ({ ...prev, [msgId]: !prev[msgId] }))
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

  const DROPLET_SHAPE = "50% 50% 50% 50% / 60% 60% 43% 43%"
  const AI_AVATAR_PATH = "/ai_dopa.png"

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[#0B0A09] max-w-[100vw] overflow-x-hidden select-none overscroll-none"
      style={{ overscrollBehavior: 'none' }}
      onTouchStart={handleBgTouchStart}
      onTouchMove={handleBgTouchMove}
      onTouchEnd={handleBgTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault()
        return false
      }}>

      {/* 沉浸式背景背景光晕 */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-[-50%] bg-cover bg-center blur-[120px] opacity-20 animate-pulse-slow"
          style={{ backgroundImage: `url("${postImage}")` }}
        />
      </div>

      {viewingWord && (
        <WordDetailOverlay
          word={viewingWord}
          definition={getDefinition(viewingWord)}
          onClose={() => setViewingWord(null)}
        />
      )}

      {/* Difficulty Settings (Toggle) */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 z-[90] backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation()
                setShowSettings(false)
              }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute top-0 bottom-0 right-0 w-72 bg-[#0B0A09]/95 backdrop-blur-2xl border-l border-white/5 z-[95] p-8 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-orange-500/20 rounded-2xl flex items-center justify-center border border-orange-500/30">
                  <span className="material-symbols-outlined text-orange-500">psychology</span>
                </div>
                <h2 className="text-white font-black text-lg tracking-tight">Difficulty</h2>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar">
                {(
                  [
                    'Original',
                    'Mixed',
                    'IELTS',
                    'CET6',
                    'CET4',
                    'HighSchool',
                    'PrimarySchool',
                  ] as DifficultyLevel[]
                ).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setDifficulty(lvl)}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex justify-between items-center transition-all active:scale-95 ${difficulty === lvl ? 'bg-orange-500/10 border-orange-500 text-orange-500' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}>
                    <div className="flex flex-col">
                      <span className="text-[15px] font-black tracking-tight">
                        {lvl === 'Mixed' ? 'Dopamine Mix ⚡️' : lvl}
                      </span>
                    </div>
                    {difficulty === lvl && (
                      <span className="material-symbols-outlined text-orange-500 font-bold">check_circle</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-[11px] text-white/20 font-black uppercase tracking-widest leading-relaxed">
                  Adjust the difficulty to match your learning pace.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cultural Note Overlay */}
      <AnimatePresence>
        {viewingNote && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-x-4 bottom-24 z-[90] bg-white dark:bg-[#1C1C1E] border border-yellow-500/30 p-5 rounded-2xl shadow-2xl"
            onClick={() => setViewingNote(null)}>
            <div className="flex items-center gap-2 mb-3 text-yellow-600 dark:text-yellow-500">
              <span className="material-symbols-outlined">lightbulb</span>
              <span className="font-bold text-sm uppercase tracking-widest">
                Cultural Insight
              </span>
            </div>
            {viewingNote.map((note, idx) => (
              <div key={idx} className="mb-3 last:mb-0">
                <p className="text-gray-900 dark:text-white font-bold text-sm mb-1">
                  {note.trigger_word}
                </p>
                <p className="text-gray-600 dark:text-white/70 text-sm leading-relaxed">
                  {note.explanation}
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGlobalTranslation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1 rounded-full text-white/80 text-xs font-bold z-50 backdrop-blur pointer-events-none">
            Translation Visible
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {returnToId && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={handleReturnJump}
            className="fixed bottom-24 right-4 z-[80] bg-background-light dark:bg-white/10 backdrop-blur border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white p-3 rounded-full shadow-lg flex items-center gap-2">
            <span className="material-symbols-outlined">u_turn_left</span>
            <span className="text-xs font-bold pr-1">Return</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {contextMenu && (
          <>
            <div
              className="fixed inset-0 z-[100]"
              onClick={(e) => {
                e.stopPropagation()
                setContextMenu(null)
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-[101] bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[180px] flex flex-col"
              style={{
                left: Math.min(contextMenu.x, window.innerWidth - 190),
                top: Math.min(contextMenu.y, window.innerHeight - 240),
              }}
              onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handleQuote(contextMenu.msg)}
                className="menu-item text-orange-500">
                <span className="material-symbols-outlined text-[18px]">
                  format_quote
                </span>{' '}
                Quote & Ask
              </button>
              <button
                onClick={() => toggleSingleTranslation(contextMenu.msg.id)}
                className="menu-item text-gray-700 dark:text-gray-200">
                <span className="material-symbols-outlined text-[18px]">
                  translate
                </span>
                {expandedTranslations[contextMenu.msg.id]
                  ? 'Hide Translation'
                  : 'Translate'}
              </button>
              <button
                onClick={() => handleCopy(contextMenu.msg.content)}
                className="menu-item text-gray-700 dark:text-gray-200">
                <span className="material-symbols-outlined text-[18px]">
                  content_copy
                </span>{' '}
                Copy
              </button>
              <button
                onClick={() => handleBookmark(contextMenu.msg)}
                className="menu-item text-gray-700 dark:text-gray-200">
                <span className="material-symbols-outlined text-[18px]">
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
                  <span className="material-symbols-outlined text-[18px]">
                    delete
                  </span>{' '}
                  Delete
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 固定顶栏：采用 fixed 定位确保绝对不会位移 */}
      <div
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-5 bg-black/40 backdrop-blur-3xl border-b border-white/5 z-[70] touch-none"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(4.5rem + env(safe-area-inset-top))'
        }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onBack()
          }}
          className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-2xl border-2 border-white/5 active:scale-90 transition-all shadow-lg"
          style={{ borderRadius: DROPLET_SHAPE }}>
          <span className="material-symbols-outlined text-white/80">keyboard_arrow_down</span>
        </button>

        <div className="flex flex-col items-center">
          {isAiLoading ? (
            <div className="flex items-center gap-2 animate-pulse text-orange-400 whitespace-nowrap">
              <span className="w-2 h-2 bg-orange-500 rounded-full" />
              <span className="text-[12px] font-black uppercase tracking-widest">Replying...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center whitespace-nowrap">
              <span className="text-white font-black text-[14px] tracking-tight">
                Thread Discussion
              </span>
              <div className="flex items-center gap-1.5 opacity-50">
                <span className="w-1 h-1 bg-orange-500 rounded-full" />
                <span className="text-white/80 text-[9px] font-black uppercase tracking-wider">
                  {messages.length - 1} RESPONSES
                </span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowSettings(true)
          }}
          className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-2xl border-2 border-white/5 active:scale-90 transition-all shadow-lg"
          style={{ borderRadius: DROPLET_SHAPE }}>
          <span className="material-symbols-outlined text-white/80 text-[20px]">tune</span>
        </button>
      </div>

      {/* 布局占位：防止 main 容器被 fixed 的 header 遮挡 */}
      <div
        className="shrink-0"
        style={{ height: 'calc(4.5rem + env(safe-area-inset-top))' }}
      />

      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-5 py-6 space-y-8 no-scrollbar bg-transparent relative z-10 touch-pan-y"
        style={{ overscrollBehaviorY: 'none' }}>
        {messages.map((msg, index) => {
          const isOP = msg.id === 'op-message'
          const isRoot = index === 1
          const sentences = getDisplaySentences(msg)

          if (isOP) {
            return (
              <motion.div
                key={msg.id}
                initial={{ y: -200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 1 }}
                className="mb-10 p-6 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] relative shadow-2xl overflow-hidden group"
                onContextMenu={(e) => e.preventDefault()}>

                {/* 装饰性背景光晕 */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl group-hover:bg-orange-500/20 transition-all duration-1000" />

                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-orange-500/20 px-3 py-1 rounded-full border border-orange-500/30">
                    <span className="text-orange-500 text-[10px] font-black uppercase tracking-widest">
                      Original Post
                    </span>
                  </div>
                  <span className="text-xs font-black text-white/50 tracking-tight">
                    by u/{msg.author}
                  </span>
                </div>

                <div className="text-white font-medium text-[17px] leading-relaxed tracking-wide space-y-4">
                  {sentences.map((s, i) => {
                    const isImage = s.en.match(
                      /^https?:\/\/.*\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i,
                    )
                    if (isImage)
                      return (
                        <motion.div
                          key={i}
                          initial={{ scale: 0.9, y: 50, opacity: 0 }}
                          animate={{ scale: 1, y: 0, opacity: 1 }}
                          transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
                          className="my-6 rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl">
                          <img src={s.en} alt="" className="w-full h-auto" />
                        </motion.div>
                      )

                    return (
                      <span key={i} className="inline">
                        <InteractiveText
                          text={s.en}
                          contextSentence={s.en}
                          externalOnClick={(w) => handleWordClick(w, s.en, msg)}
                          disabled={msg.isLocal && !msg.isLocalAi}
                        />
                        <span className="inline-block w-1" />
                      </span>
                    )
                  })}
                </div>
                {msg.content_cn && (
                  <div className="mt-6 pt-6 border-t border-white/5 text-white/40 text-[14px] leading-relaxed italic font-medium">
                    {msg.content_cn}
                  </div>
                )}
              </motion.div>
            )
          }

          // [逻辑恢复] 确保回复气泡的功能性逻辑正常
          const isUser = msg.isLocal && !msg.isLocalAi
          const isHighlighted = highlightedId === msg.id
          const isFlash = flashMessageId === msg.id
          const hasCulturalNote = msg.enrichment?.cultural_notes && msg.enrichment.cultural_notes.length > 0
          const isActive = false // 这里可以用逻辑判断是否是当前焦点

          return (
            <div
              id={`msg-${msg.id}`}
              key={msg.id}
              className={`flex gap-3 mb-8 ${isUser ? 'flex-row-reverse' : ''} transition-all duration-500 ${isHighlighted ? 'bg-orange-500/10 -mx-3 px-3 py-3 rounded-2xl' : ''}`}>

              {/* 头像：改为圆角正方形 */}
              <div className="shrink-0">
                <div
                  className={`w-9 h-9 flex items-center justify-center overflow-hidden border-2 ${isRoot
                    ? 'border-orange-500/40 bg-gradient-to-tr from-orange-400 to-orange-600 text-white'
                    : isUser
                      ? 'border-indigo-500/40 bg-gradient-to-tr from-indigo-500 to-cyan-600 text-white'
                      : 'border-white/10 bg-white/5 text-white/40'
                    } rounded-lg shadow-lg`}>
                  {isRoot ? 'TOP' : (
                    msg.isLocalAi ? (
                      <img src={AI_AVATAR_PATH} alt="Dopa" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(msg.isLocalAi ? 'Dopa' : msg.author)
                    )
                  )}
                </div>
              </div>

              {/* 气泡内容：首页磨砂 + 柑橘渐变 */}
              <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[11px] font-black text-white/30 uppercase tracking-widest leading-none">
                    {msg.isLocalAi ? 'Dopa' : msg.author}
                  </span>
                </div>

                {/* 引用回复展示：更加轻盈的样式 */}
                {!isRoot && msg.replyText && (
                  <div
                    onClick={(isUser || msg.isLocalAi) ? undefined : () => handleJumpToWithReturn(msg.parent_id, msg.id)}
                    className={`text-[11px] text-white/30 italic border-l-2 border-indigo-400/50 pl-3 py-1 mb-1 active:bg-white/5 rounded-r ${(isUser || msg.isLocalAi) ? '' : 'cursor-pointer'} break-all whitespace-pre-wrap max-w-[200px] ${isUser ? 'text-right border-l-0 border-r-2 pr-3 border-indigo-400/50' : ''}`}>
                    <span className="font-black not-italic text-orange-500/60 mr-1">
                      @{msg.replyToName}
                    </span>
                    <span className="line-clamp-1">{msg.replyText}</span>
                  </div>
                )}

                <div
                  onTouchStart={(isUser) ? undefined : (e) => handleBubbleTouchStart(e, msg)}
                  onTouchMove={(isUser) ? undefined : handleBubbleTouchMove}
                  onTouchEnd={(isUser) ? undefined : handleBubbleTouchEnd}
                  className={`relative px-4 py-2 shadow-xl ${isUser
                    ? 'bg-gradient-to-br from-indigo-500 to-cyan-600 text-white rounded-[1.8rem] rounded-tr-none shadow-indigo-500/20'
                    : msg.isLocalAi
                      ? 'bg-white/5 backdrop-blur-3xl border border-indigo-500/30 text-white/90 rounded-[1.8rem] rounded-tl-none ring-1 ring-indigo-500/10'
                      : 'bg-white/5 backdrop-blur-3xl border border-white/5 text-white/90 rounded-[1.8rem] rounded-tl-none'
                    } ${isFlash ? 'animate-pulse border-indigo-400' : ''}`}
                >
                  {/* 文化注记指示器 */}
                  {hasCulturalNote && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewingNote(msg.enrichment!.cultural_notes)
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg border-2 border-[#0B0A09] z-10 animate-pulse cursor-pointer active:scale-90">
                      <span className="material-symbols-outlined text-[12px] text-black font-black">
                        lightbulb
                      </span>
                    </div>
                  )}

                  <div className="text-[15px] leading-relaxed font-medium">
                    {sentences.length > 0 ? sentences.map((s, i) => {
                      const isImage = s.en.match(/^https?:\/\/.*\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i)

                      if (isImage) return (
                        <div key={i} className="my-2 rounded-xl overflow-hidden border border-white/10">
                          <img src={s.en} alt="" className="w-full h-auto" />
                        </div>
                      )

                      return (
                        <span key={i} className="inline">
                          <InteractiveText
                            text={s.en}
                            contextSentence={s.en}
                            externalOnClick={(w) => handleWordClick(w, s.en, msg)}
                            disabled={isUser}
                          />
                          <span className="inline-block w-1" />
                        </span>
                      )
                    }) : (
                      <span>{msg.content}</span>
                    )}
                  </div>

                  {(expandedTranslations[msg.id] || showGlobalTranslation) && msg.content_cn && (
                    <div className="mt-3 pt-3 border-t border-white/10 text-[13px] opacity-60 italic leading-snug">
                      {msg.content_cn}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {isAiLoading && (
          <div className="flex justify-start px-4 py-4 animate-in slide-in-from-bottom-2 fade-in">
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xl px-4 py-2 rounded-2xl shadow-xl">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce delay-100" />
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce delay-200" />
              <span className="text-[10px] text-white/60 font-black uppercase tracking-widest ml-2">
                Dopa is typing...
              </span>
            </div>
          </div>
        )}

        <div className="h-32" />
      </main>

      {/* 底部悬浮输入胶囊 */}
      <div
        className="fixed bottom-6 left-4 right-4 z-50 flex flex-col pointer-events-auto"
        onClick={(e) => e.stopPropagation()}>

        <div className={`bg-white/10 dark:bg-black/40 backdrop-blur-3xl rounded-[2rem] shadow-2xl p-2 transition-all duration-300 ${!isAiMode ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'}`}>
          {quotedMessage && (
            <div className="flex justify-between items-center bg-white/5 rounded-3xl p-3 mb-2 animate-in slide-in-from-bottom-4">
              <div className="flex flex-col max-w-[85%]">
                <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 mb-1">
                  {isAiMode ? `✨ Ask ${quotedMessage.author}` : 'Replying to'}
                </span>
                <span className="text-[12px] text-white/50 truncate font-medium italic">
                  "{quotedMessage.content}"
                </span>
              </div>
              <button
                onClick={() => {
                  setQuotedMessage(null)
                  setIsAiMode(false)
                }}
                className="w-7 h-7 flex items-center justify-center bg-white/10 rounded-full">
                <span className="material-symbols-outlined text-[16px] text-white/50">close</span>
              </button>
            </div>
          )}

          <div className="flex gap-2 items-center">
            <div className="flex-1 relative flex items-center">
              <input
                ref={inputRef}
                disabled={!isAiMode}
                className={`w-full h-12 bg-transparent px-5 text-white text-[15px] outline-none border-none ring-0 focus:ring-0 focus:outline-none placeholder:text-white/20 font-medium ${!isAiMode ? 'cursor-not-allowed' : 'cursor-text'}`}
                placeholder={isAiMode ? `Ask ${quotedMessage?.author}...` : 'Click a sentence to ask Dopa'}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && isAiMode && handleSend()}
              />
            </div>

            <button
              onClick={isAiMode ? handleSend : undefined}
              disabled={!isAiMode}
              className={`w-12 h-12 flex items-center justify-center text-white shadow-lg active:scale-95 transition-all rounded-full ${isAiMode ? 'bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/20' : 'bg-white/10'}`}
            >
              <span className="material-symbols-outlined text-[24px] font-black">
                arrow_upward
              </span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
         .menu-item {
            @apply w-full text-left px-4 py-3.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-3 border-b border-gray-100 dark:border-white/5 active:bg-gray-200 dark:active:bg-white/20 transition-colors;
         }
         /* 强制隐藏所有滚动条 */
         *::-webkit-scrollbar { display: none !important; }
         * { 
            -ms-overflow-style: none !important; 
            scrollbar-width: none !important; 
            -webkit-tap-highlight-color: transparent !important;
         }
         
         /* 彻底移除输入框/交互元素的焦点蓝框 */
         input:focus, textarea:focus, select:focus, button:focus {
            outline: none !important;
            border: none !important;
            box-shadow: none !important;
         }
         input, textarea {
            border: none !important;
            outline: none !important;
         }

         .touch-callout-none { -webkit-touch-callout: none; }
         @keyframes flash {
            0% { background-color: rgba(255,255,255,0.1); }
            50% { background-color: rgba(59, 130, 246, 0.2); }
            100% { background-color: rgba(255,255,255,0.05); }
         }
         .animate-flash {
            animation: flash 1s ease-out;
         }
      `}</style>
    </div>
  )
}

export default ChatRoom
