import React, { useState, useEffect, useRef } from 'react'
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
  postImage?: string
}

const ChatRoom: React.FC<ChatRoomProps> = ({
  postId,
  focusCommentId,
  onBack,
}) => {
  // --- Stores ---
  // [关键修复] 1. 解构出 comments 状态，实现数据订阅
  const {
    comments,
    fetchComments,
    addLocalComment,
    deleteLocalComment,
    buildMessageThread,
  } = useCommentStore()
  const { getDefinition, triggerAnalysis } = useDictionaryStore()

  // --- State: Data & Content ---
  const [messages, setMessages] = useState<Comment[]>([])
  const [isInitializing, setIsInitializing] = useState(true)

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
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const bgPressTimerRef = useRef<NodeJS.Timeout | null>(null)

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

  // 2. 自动聚焦 Effect
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

  // 4. [关键修复] 构建消息树
  // 依赖项加入 comments[postId]，确保数据更新时视图刷新
  useEffect(() => {
    const updateMessages = () => {
      const msgs = buildMessageThread(postId, focusCommentId, opPostData)
      setMessages(msgs)
    }

    if (isInitializing) {
      // 首次加载，延迟 150ms 以配合转场动画
      const timer = setTimeout(() => {
        updateMessages()
        setIsInitializing(false)
      }, 150)
      return () => clearTimeout(timer)
    } else {
      // 后续数据更新（如发送消息），立即刷新
      updateMessages()
    }
  }, [postId, focusCommentId, opPostData, buildMessageThread, comments[postId]])

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

  // 6. 分句逻辑
  const getDisplaySentences = (msg: Comment) => {
    // OP 消息强制分句
    if (msg.id === 'op-message') {
      const text = msg.content || ''
      const rawSentences = text.match(
        /[^.!?。！？\n]+[.!?。！？\n]+|[^.!?。！？\n]+$/g,
      ) || [text]
      return rawSentences.map((en) => ({ en: en.trim(), zh: null }))
    }

    // 普通消息
    let segments: { en: string; zh: string | null }[] = []
    if (msg.enrichment?.sentence_segments) {
      segments = msg.enrichment.sentence_segments
    } else {
      segments = [{ en: msg.content, zh: msg.content_cn }]
    }
    return segments.filter((s) => s.en && s.en.trim() !== '')
  }

  const handleWordClick = async (word: string, context: string) => {
    const cachedResult = await triggerAnalysis(word, context)
    setViewingWord(word)
  }

  // 7. 发送消息逻辑
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
        parent_id: quotedMessage.id, // 指向被引用的消息
        upvotes: 0,
        created_at: new Date().toISOString(),
        isLocal: true,
        isQuestion: true,
        replyToName: quotedMessage.author,
        replyText: quotedMessage.content,
      }

      // 更新 Store，会触发 useEffect 立即刷新界面
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
  const handleBgStart = (e: React.SyntheticEvent) => {
    if ((e.target as HTMLElement).closest('input') || contextMenu) return
    // e.nativeEvent.touches 用于区分触摸
    const isTouch = 'touches' in e.nativeEvent
    if (scrollContainerRef.current?.scrollTop === 0) {
      touchStartRef.current = isTouch
        ? (e.nativeEvent as TouchEvent).touches[0].clientY
        : (e as any).clientY
      setIsDragging(true)
    }
    bgPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50)
      setShowGlobalTranslation(true)
    }, 400)
  }
  const handleBgEnd = () => {
    if (bgPressTimerRef.current) clearTimeout(bgPressTimerRef.current)
    setShowGlobalTranslation(false)
    setIsDragging(false)
    if (pullY > 100) onBack()
    setPullY(0)
  }
  const handleBgMove = (e: React.SyntheticEvent) => {
    if (bgPressTimerRef.current) {
      clearTimeout(bgPressTimerRef.current)
      bgPressTimerRef.current = null
    }
    if (!isDragging) return

    const isTouch = 'touches' in e.nativeEvent
    const currentY = isTouch
      ? (e.nativeEvent as TouchEvent).touches[0].clientY
      : (e as any).clientY

    const diff = currentY - touchStartRef.current
    if (diff > 0 && scrollContainerRef.current?.scrollTop === 0) {
      setPullY(Math.pow(diff, 0.8))
    }
  }

  // 10. [关键修复] 通用交互处理 (支持鼠标和触摸)
  const handleStartPress = (e: React.SyntheticEvent, msg: Comment) => {
    // e.stopPropagation() // 如有需要可开启
    const clientX =
      'touches' in e.nativeEvent
        ? (e.nativeEvent as TouchEvent).touches[0].clientX
        : (e as any).clientX
    const clientY =
      'touches' in e.nativeEvent
        ? (e.nativeEvent as TouchEvent).touches[0].clientY
        : (e as any).clientY

    pressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50)
      setContextMenu({ x: clientX, y: clientY, msg })
    }, 500)
  }

  const handleEndPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
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
      className={`fixed inset-0 z-[60] flex flex-col bg-background-light dark:bg-background-dark transition-transform duration-300 ease-out max-w-[100vw] overflow-x-hidden touch-action-pan-y select-none`}
      style={{
        transform: `translateY(${pullY}px)`,
        borderRadius: pullY > 0 ? '40px' : '0px',
      }}
      // 背景交互
      onTouchStart={handleBgStart}
      onTouchMove={handleBgMove}
      onTouchEnd={handleBgEnd}
      onMouseDown={handleBgStart}
      onMouseMove={handleBgMove}
      onMouseUp={handleBgEnd}
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

      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-white/5 bg-background-light dark:bg-[#0B0A09]/90 backdrop-blur shrink-0 relative z-50 transition-colors">
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
                {isInitializing
                  ? 'Loading...'
                  : `${messages.length - 1} comments`}
              </span>
            </>
          )}
        </div>
        <div className="w-10" />
      </div>

      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 no-scrollbar bg-background-light dark:bg-[#0B0A09] transition-colors relative">
        {/* Loading Skeleton */}
        <AnimatePresence>
          {isInitializing && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 p-4 space-y-8 bg-background-light dark:bg-[#0B0A09] z-40">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-white/5 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="w-24 h-3 bg-gray-200 dark:bg-white/5 rounded" />
                    <div className="w-full h-16 bg-gray-200 dark:bg-white/5 rounded-2xl" />
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Real Messages */}
        {!isInitializing &&
          messages.map((msg, index) => {
            const isOP = msg.id === 'op-message'
            const isRoot = index === 1
            const sentences = getDisplaySentences(msg)
            const hasCulturalNote =
              msg.enrichment?.cultural_notes &&
              msg.enrichment.cultural_notes.length > 0
            const isHighlighted = highlightedId === msg.id
            const isUser = msg.isLocal && !msg.isLocalAi
            const isFlash = flashMessageId === msg.id

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
                        // [修复] 绑定通用 Press 事件，支持鼠标和触摸
                        onTouchStart={(e) => handleStartPress(e, msg)}
                        onTouchEnd={handleEndPress}
                        onMouseDown={(e) => handleStartPress(e, msg)}
                        onMouseUp={handleEndPress}
                        onMouseLeave={handleEndPress}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`
                             relative group p-3 pr-6 rounded-2xl text-[15px] leading-relaxed border transition-all duration-300 select-none touch-callout-none
                             ${isRoot || isOP ? 'bg-gray-100 dark:bg-white/10 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white' : 'bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-white/5 text-gray-800 dark:text-gray-200'}
                             ${hasCulturalNote ? 'shadow-[0_0_15px_rgba(234,179,8,0.2)] border-yellow-500/40 bg-gradient-to-br from-yellow-50 to-white dark:from-[#1A1A1A] dark:to-yellow-900/20' : ''}
                           `}>
                        {/* 显式引用按钮 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleQuote(msg)
                          }}
                          className="absolute -right-2 -top-2 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 scale-90 active:scale-95 cursor-pointer">
                          <span className="material-symbols-outlined text-[14px]">
                            format_quote
                          </span>
                        </button>

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
                                {s.zh ||
                                  (i === sentences.length - 1
                                    ? msg.content_cn
                                    : '')}
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
        className="p-4 border-t border-gray-200 dark:border-white/5 bg-background-light dark:bg-[#0B0A09] safe-area-bottom transition-colors"
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
