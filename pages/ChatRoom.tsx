import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import { useCommentStore } from '../store/useCommentStore'
import { useDictionaryStore } from '../store/useDictionaryStore'
import { Comment, CulturalNote } from '../types'
import InteractiveText from '../components/InteractiveText'
import WordDetailOverlay from '../components/WordDetailOverlay'

const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions'
const AI_MODEL = 'deepseek-ai/DeepSeek-V2.5'

interface ChatRoomProps {
  postId: string
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

  const handleWordClick = async (word: string, context: string) => {
    const cachedResult = await triggerAnalysis(word, context)
    setViewingWord(word)
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

      setQuotedMessage(null)
      setIsAiMode(false)

      try {
        const apiKey = import.meta.env.VITE_SILICONFLOW_API_KEY
        if (!apiKey) throw new Error('Missing API Key')

        const response = await fetch(SILICONFLOW_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [
              {
                role: 'system',
                content: `Simulate Reddit user "${quotedMessage.author}". Context: "${quotedMessage.content}". Q: "${questionContent}". Reply as "${quotedMessage.author}" concisely.`,
              },
              { role: 'user', content: questionContent },
            ],
            stream: false,
          }),
        })

        const data = await response.json()
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
    if (scrollContainerRef.current?.scrollTop === 0) {
      touchStartRef.current = e.touches[0].clientY
      setIsDragging(true)
    }
    bgPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50)
      setShowGlobalTranslation(true)
    }, 400)
  }
  const handleBgTouchEnd = () => {
    if (bgPressTimerRef.current) clearTimeout(bgPressTimerRef.current)
    setShowGlobalTranslation(false)
    setIsDragging(false)
    if (pullY > 100) onBack()
    setPullY(0)
  }
  const handleBgTouchMove = (e: React.TouchEvent) => {
    if (bgPressTimerRef.current) {
      clearTimeout(bgPressTimerRef.current)
      bgPressTimerRef.current = null
    }
    if (!isDragging) return
    const currentY = e.touches[0].clientY
    const diff = currentY - touchStartRef.current
    if (diff > 0 && scrollContainerRef.current?.scrollTop === 0) {
      setPullY(Math.pow(diff, 0.8))
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
      setContextMenu({ x, y, msg })
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

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col bg-gray-50 dark:bg-[#0B0A09] transition-transform duration-300 ease-out max-w-[100vw] overflow-x-hidden touch-action-pan-y select-none`}
      style={{
        transform: `translateY(${pullY}px)`,
        borderRadius: pullY > 0 ? '40px' : '0px',
      }}
      onTouchStart={handleBgTouchStart}
      onTouchMove={handleBgTouchMove}
      onTouchEnd={handleBgTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault()
        return false
      }}>
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
              className="absolute top-0 bottom-0 right-0 w-64 bg-white dark:bg-[#1C1C1E] border-l border-gray-200 dark:border-white/10 z-[95] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <h2 className="text-gray-900 dark:text-white font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500">
                  psychology
                </span>
                Difficulty
              </h2>
              <div className="space-y-2 max-h-[80vh] overflow-y-auto">
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
                    className={`w-full p-3 rounded-xl border text-left flex justify-between items-center ${difficulty === lvl ? 'bg-orange-500/20 border-orange-500 text-orange-600 dark:text-orange-500' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/5 text-gray-700 dark:text-white/60'}`}>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">
                        {lvl === 'Mixed' ? 'Dopamine Mix ⚡️' : lvl}
                      </span>
                    </div>
                    {difficulty === lvl && (
                      <span className="material-symbols-outlined text-sm">
                        check
                      </span>
                    )}
                  </button>
                ))}
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
            className="fixed bottom-24 right-4 z-[80] bg-white/90 dark:bg-white/10 backdrop-blur border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white p-3 rounded-full shadow-lg flex items-center gap-2">
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

      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-white/5 bg-white/90 dark:bg-[#0B0A09]/90 backdrop-blur shrink-0 relative z-50 transition-colors">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onBack()
          }}
          className="w-10 h-10 flex items-center justify-center text-gray-500 dark:text-white/60">
          <span className="material-symbols-outlined">keyboard_arrow_down</span>
        </button>
        <div className="flex flex-col items-center">
          {isAiLoading ? (
            <div className="flex items-center gap-2 animate-pulse text-green-500 dark:text-green-400">
              <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full" />
              <span className="text-sm font-bold">Replying...</span>
            </div>
          ) : (
            <>
              <span className="text-gray-900 dark:text-white font-bold text-sm">
                Thread
              </span>
              <span className="text-gray-500 dark:text-white/40 text-[10px]">
                {messages.length - 1} comments
              </span>
            </>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowSettings(true)
          }}
          className="w-10 h-10 flex items-center justify-center text-gray-500 dark:text-white/60">
          <span className="material-symbols-outlined">tune</span>
        </button>
      </div>

      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 no-scrollbar bg-gray-50 dark:bg-[#0B0A09] transition-colors">
        {messages.map((msg, index) => {
          const isOP = msg.id === 'op-message'
          const isRoot = index === 1
          const sentences = getDisplaySentences(msg)
          const hasCulturalNote =
            msg.enrichment?.cultural_notes &&
            msg.enrichment.cultural_notes.length > 0
          const isHighlighted = highlightedId === msg.id
          const isUser = msg.isLocal && !msg.isLocalAi
          const isFlash = flashMessageId === msg.id

          if (isOP) {
            return (
              <div
                key={msg.id}
                className="mb-8 p-4 bg-gradient-to-br from-gray-200 to-gray-100 dark:from-white/10 dark:to-white/5 border border-gray-200 dark:border-white/10 rounded-2xl relative select-none touch-callout-none shadow-sm"
                onContextMenu={(e) => e.preventDefault()}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-primary/20 text-primary text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                    OP
                  </span>
                  <span className="text-xs font-bold text-gray-800 dark:text-white/90 line-clamp-1">
                    {msg.author}
                  </span>
                </div>
                <div className="text-gray-800 dark:text-white/80 text-[15px] leading-relaxed">
                  {sentences.map((s, i) => {
                    // 图片检测
                    const isImage = s.en.match(
                      /^https?:\/\/.*\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i,
                    )
                    if (isImage)
                      return (
                        <img
                          key={i}
                          src={s.en}
                          alt=""
                          className="rounded-lg max-w-full h-auto my-2"
                        />
                      )

                    return (
                      <span key={i}>
                        <InteractiveText
                          text={s.en}
                          contextSentence={s.en}
                          externalOnClick={(w) => handleWordClick(w, s.en)}
                        />
                        <span className="inline-block w-1" />
                      </span>
                    )
                  })}
                </div>
                {msg.content_cn && (
                  <div className="mt-3 pt-3 border-t border-gray-300 dark:border-white/5 text-gray-500 dark:text-white/50 text-xs italic">
                    {msg.content_cn}
                  </div>
                )}
              </div>
            )
          }

          return (
            <div
              id={`msg-${msg.id}`}
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${isRoot || isOP ? 'mb-8' : ''} transition-all duration-500 ${isHighlighted ? 'bg-orange-100 dark:bg-white/5 -mx-2 px-2 py-2 rounded-xl' : ''} ${isFlash ? 'animate-flash bg-blue-50 dark:bg-white/10 rounded-xl' : ''}`}>
              <div className="shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border border-gray-200 dark:border-white/10 ${isRoot || isOP ? 'bg-gradient-to-tr from-orange-500 to-red-500 text-white w-10 h-10 text-xs' : 'bg-gray-200 dark:bg-[#1A1A1A] text-gray-500 dark:text-white/60'}`}>
                  {isOP ? 'OP' : isRoot ? 'TOP' : getInitials(msg.author)}
                </div>
                {(isRoot || isOP) && (
                  <div className="h-full w-[1px] bg-gray-200 dark:bg-white/10 mx-auto my-2" />
                )}
              </div>

              <div
                className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : ''}`}>
                <div
                  className={`flex items-baseline gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <span
                    className={`text-xs font-bold ${isRoot || isOP ? 'text-gray-900 dark:text-white text-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                    {msg.author}
                  </span>
                  {isOP && (
                    <span className="bg-orange-500/20 text-orange-500 text-[9px] px-1 rounded font-bold">
                      OP
                    </span>
                  )}
                  {isRoot && (
                    <span className="bg-orange-500/20 text-orange-500 text-[9px] px-1 rounded font-bold">
                      Top Comment
                    </span>
                  )}
                  {msg.isLocalAi && (
                    <span className="bg-blue-500/20 text-blue-500 dark:text-blue-400 text-[9px] px-1 rounded font-bold">
                      AI
                    </span>
                  )}
                </div>

                {!isRoot && !isOP && msg.replyText && (
                  <div
                    onClick={() =>
                      handleJumpToWithReturn(msg.parent_id, msg.id)
                    }
                    className={`text-[11px] text-gray-400 dark:text-white/40 italic border-l-2 border-gray-300 dark:border-white/20 pl-2 mb-1 active:bg-black/5 dark:active:bg-white/5 rounded-r cursor-pointer break-all whitespace-pre-wrap ${isUser ? 'text-right border-l-0 border-r-2 pr-2' : ''}`}>
                    <span className="font-bold not-italic text-gray-500 dark:text-white/30 mr-1">
                      @{msg.replyToName}
                    </span>
                    {msg.replyText}
                  </div>
                )}

                {sentences.map((s, i) => {
                  const isImage = s.en.match(
                    /^https?:\/\/.*\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i,
                  )
                  return (
                    <div
                      key={i}
                      onTouchStart={(e) => handleBubbleTouchStart(e, msg)}
                      onTouchEnd={handleBubbleTouchEnd}
                      onTouchMove={handleBubbleTouchMove}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`
                             relative p-3 pr-6 rounded-2xl text-[15px] leading-relaxed border transition-all duration-300 select-none touch-callout-none
                             ${isRoot || isOP ? 'bg-gray-100 dark:bg-white/10 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white' : 'bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-white/5 text-gray-800 dark:text-gray-200'}
                             ${hasCulturalNote ? 'shadow-[0_0_15px_rgba(234,179,8,0.2)] border-yellow-500/40 bg-gradient-to-br from-yellow-50 to-white dark:from-[#1A1A1A] dark:to-yellow-900/20' : ''}
                           `}>
                      {hasCulturalNote && i === 0 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setViewingNote(msg.enrichment!.cultural_notes)
                          }}
                          className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-[#0B0A09] z-10 animate-pulse cursor-pointer active:scale-90">
                          <span className="material-symbols-outlined text-[12px] text-black font-bold">
                            lightbulb
                          </span>
                        </div>
                      )}

                      {isImage ? (
                        <img
                          src={s.en}
                          alt=""
                          className="rounded-lg max-w-full h-auto"
                        />
                      ) : (
                        <InteractiveText
                          text={s.en || ''}
                          contextSentence={s.en || ''}
                          externalOnClick={(w) => handleWordClick(w, s.en)}
                        />
                      )}

                      <AnimatePresence>
                        {(showGlobalTranslation ||
                          expandedTranslations[msg.id]) &&
                          (s.zh ||
                            (isOP &&
                              i === sentences.length - 1 &&
                              msg.content_cn)) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-2 pt-2 border-t border-gray-200 dark:border-white/5 text-sm text-gray-500 dark:text-white/50 italic overflow-hidden">
                              {s.zh || msg.content_cn}
                            </motion.div>
                          )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {isAiLoading && (
          <div className="flex justify-start px-12 py-4 animate-in slide-in-from-bottom-2 fade-in">
            <div className="flex items-center gap-2 bg-gray-200 dark:bg-white/5 px-4 py-2 rounded-full border border-gray-300 dark:border-white/5">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-100" />
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-200" />
              <span className="text-[10px] text-orange-600 dark:text-orange-500 font-bold ml-2">
                {quotedMessage
                  ? `${quotedMessage.author} is typing...`
                  : 'AI is typing...'}
              </span>
            </div>
          </div>
        )}

        <div className="h-32" />
      </main>

      <div
        className="p-4 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0B0A09] safe-area-bottom transition-colors"
        onClick={(e) => e.stopPropagation()}>
        {quotedMessage && (
          <div className="flex justify-between items-center bg-gray-200 dark:bg-white/5 rounded-t-lg p-2 mb-2 border border-gray-300 dark:border-white/5 border-b-0 animate-in slide-in-from-bottom">
            <div className="flex flex-col max-w-[85%]">
              <span
                className={`text-[9px] font-black uppercase tracking-widest ${isAiMode ? 'text-orange-500' : 'text-gray-400 dark:text-white/30'}`}>
                {isAiMode ? `✨ Ask ${quotedMessage.author}` : 'Replying to'}
              </span>
              <span className="text-[11px] text-gray-600 dark:text-white/70 truncate font-medium mt-0.5 break-all">
                "{quotedMessage.content}"
              </span>
            </div>
            <button
              onClick={() => {
                setQuotedMessage(null)
                setIsAiMode(false)
              }}>
              <span className="material-symbols-outlined text-sm text-gray-500 dark:text-white/50">
                close
              </span>
            </button>
          </div>
        )}
        <div className="flex gap-3 items-center">
          <input
            ref={inputRef}
            className={`flex-1 h-10 rounded-full px-4 text-gray-900 dark:text-white text-sm outline-none border transition-colors ${isAiMode ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-500/50' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/5 focus:border-gray-300 dark:focus:border-white/20'}`}
            placeholder={
              isAiMode ? `Ask ${quotedMessage?.author}...` : 'Reply...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button
            onClick={handleSend}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${isAiMode ? 'bg-gradient-to-tr from-orange-500 to-red-500' : 'bg-orange-600'}`}>
            <span className="material-symbols-outlined text-[20px]">
              {isAiMode ? 'auto_awesome' : 'send'}
            </span>
          </button>
        </div>
      </div>

      <style>{`
         .menu-item {
            @apply w-full text-left px-4 py-3.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-3 border-b border-gray-100 dark:border-white/5 active:bg-gray-200 dark:active:bg-white/20 transition-colors;
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
