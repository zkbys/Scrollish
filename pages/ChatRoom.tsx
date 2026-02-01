import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import { ChatMessage } from '../types'
import { useCommentStore, Comment } from '../store/useCommentStore'
import InteractiveText from '../components/InteractiveText'
import WordDetailOverlay from '../components/WordDetailOverlay'

// --- 配置区域 ---
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions'
const AI_MODEL = 'deepseek-ai/DeepSeek-V2.5'

interface ChatRoomProps {
  postId: string
  postImage?: string
  focusCommentId?: string | null
  onBack: () => void
}

// 扩展消息类型，继承自数据库的 Comment 类型
interface ThreadMessage extends Comment {
  sentenceData?: { en: string; zh: string }[]
  contentIelts?: string
  contentCet6?: string
  contentCet4?: string
  // 兼容旧的 UI 逻辑字段 (可选)
  contentZh?: string
}

type DifficultyLevel = 'Original' | 'IELTS' | 'CET6' | 'CET4'

const ChatRoom: React.FC<ChatRoomProps> = ({
  postId,
  postImage,
  focusCommentId,
  onBack,
}) => {
  const [fetchedImage, setFetchedImage] = useState<string>('')

  // --- Store Hooks ---
  const { getComments, fetchComments, addLocalComment, deleteLocalComment } =
    useCommentStore()

  // --- 交互状态 ---
  const [quotedMessage, setQuotedMessage] = useState<ThreadMessage | null>(null)
  const [activeAnalysis, setActiveAnalysis] = useState<
    ChatMessage['analysis'] | null
  >(null)
  const [inputText, setInputText] = useState('')
  const [selectedWord, setSelectedWord] = useState<string | null>(null)

  // AI 模式状态
  const [isAiMode, setIsAiMode] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)

  // 设置与显示
  const [showTranslation, setShowTranslation] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Original')

  // 上下文菜单
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    msg: ThreadMessage
  } | null>(null)

  // 手势状态
  const [pullY, setPullY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartRef = useRef(0)
  const lastTapRef = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const bubblePressTimer = useRef<NodeJS.Timeout | null>(null)
  const pressStartPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    fetchComments(postId)
    if (!postImage) {
      const fetchImage = async () => {
        const { data } = await supabase
          .from('production_posts')
          .select('image_url')
          .eq('id', postId)
          .single()
        if (data) setFetchedImage(data.image_url)
      }
      fetchImage()
    }
  }, [postId, postImage, fetchComments])

  // 直接获取所有评论（包含 Local）
  const allComments = getComments(postId) as ThreadMessage[]

  // --- 消息流合并与插入 ---
  const messages = useMemo(() => {
    if (!allComments || allComments.length === 0) return []

    // 1. 分离 DB 消息和 Local 消息
    const dbMessages: ThreadMessage[] = []
    const localRepliesMap = new Map<string, ThreadMessage[]>()

    // 第一次遍历：建立映射和分类
    allComments.forEach((c) => {
      if (c.isLocal || c.isLocalAi) {
        const target = c.parent_id || 'root'
        if (!localRepliesMap.has(target)) {
          localRepliesMap.set(target, [])
        }
        localRepliesMap.get(target)!.push(c)
      }
    })

    // 构建 DB 消息树 (DFS)
    const commentMap = new Map<string, ThreadMessage>()
    const childrenMap = new Map<string, ThreadMessage[]>()

    // 仅针对 DB 消息构建基础骨架
    allComments.forEach((c) => {
      if (!c.isLocal && !c.isLocalAi) {
        commentMap.set(c.id, c)
        if (c.parent_id) {
          if (!childrenMap.has(c.parent_id)) childrenMap.set(c.parent_id, [])
          childrenMap.get(c.parent_id)?.push(c)
        }
      }
    })

    const traverse = (comment: ThreadMessage) => {
      const actualContentZh = comment.content_cn || comment.content_zh || ''
      const parent = comment.parent_id
        ? commentMap.get(comment.parent_id)
        : null

      const node: ThreadMessage = {
        ...comment,
        contentZh: actualContentZh,
        replyToName:
          comment.replyToName || (parent ? parent.author : undefined),
        replyText: comment.replyText || (parent ? parent.content : undefined),
      }

      dbMessages.push(node)

      const children = childrenMap.get(comment.id) || []
      children.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
      children.forEach((child) => traverse(child))
    }

    // 找到根节点开始遍历
    allComments
      .filter((c) => c.depth === 0 && !c.isLocal && !c.isLocalAi)
      .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
      .forEach((root) => traverse(root))

    // 3. 递归插入本地消息
    const finalMessages: ThreadMessage[] = []

    const appendMessageWithLocalReplies = (msg: ThreadMessage) => {
      finalMessages.push(msg)

      if (localRepliesMap.has(msg.id)) {
        const replies = localRepliesMap.get(msg.id)!
        replies.forEach((reply) => {
          appendMessageWithLocalReplies(reply)
        })
      }
    }

    dbMessages.forEach((msg) => {
      appendMessageWithLocalReplies(msg)
    })

    return finalMessages
  }, [allComments])

  const getInitials = (name: string) =>
    name ? name.substring(0, 2).toUpperCase() : '??'

  const getSmartSentences = (
    msg: ThreadMessage,
    currentDifficulty: DifficultyLevel,
  ) => {
    let sourceText = msg.content
    if (currentDifficulty === 'IELTS' && msg.contentIelts)
      sourceText = msg.contentIelts
    else if (currentDifficulty === 'CET6' && msg.contentCet6)
      sourceText = msg.contentCet6
    else if (currentDifficulty === 'CET4' && msg.contentCet4)
      sourceText = msg.contentCet4

    if (!sourceText) return []

    try {
      // @ts-ignore
      const segmenterEn = new Intl.Segmenter('en', { granularity: 'sentence' })
      const enSegments = [...segmenterEn.segment(sourceText)]
        .map((s) => s.segment.trim())
        .filter((s) => s.length > 0)

      let zhSegments: string[] = []
      const zhContent = msg.content_cn || msg.contentZh || msg.content_zh
      if (zhContent) {
        // @ts-ignore
        const segmenterZh = new Intl.Segmenter('zh', {
          granularity: 'sentence',
        })
        zhSegments = [...segmenterZh.segment(zhContent)]
          .map((s) => s.segment.trim())
          .filter((s) => s.length > 0)
      }

      return enSegments.map((en, i) => ({
        en,
        zh: zhSegments[i] || '',
      }))
    } catch (e) {
      const fallbackEn = sourceText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [
        sourceText,
      ]
      return fallbackEn.map((s) => ({ en: s.trim(), zh: msg.content_cn || '' }))
    }
  }

  // --- 关键修改：结合分词组件和高亮逻辑 ---
  const renderFragmentWithGlow = (text: string, analysis: any) => {
    if (!analysis || !text.includes(analysis.keyword)) {
      return <InteractiveText text={text} onWordClick={setSelectedWord} />
    }
    const parts = text.split(analysis.keyword)
    return (
      <>
        <InteractiveText text={parts[0]} onWordClick={setSelectedWord} />
        <span
          onClick={(e) => {
            e.stopPropagation()
            setActiveAnalysis(analysis)
          }}
          className="text-orange-400 font-black relative animate-glow cursor-help px-1 rounded-sm bg-orange-500/10 border-b-2 border-orange-500/40 mx-1">
          {analysis.keyword}
        </span>
        <InteractiveText text={parts[1]} onWordClick={setSelectedWord} />
      </>
    )
  }

  // --- API 调用与发送逻辑 ---
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
        author_avatar: '',
        content: questionContent,
        content_zh: '',
        depth: (quotedMessage.depth || 0) + 1,
        parent_id: quotedMessage.id,
        upvotes: 0,
        created_at: new Date().toISOString(),
        isLocal: true,
        isQuestion: true,
        replyToName: quotedMessage.author,
        replyText: quotedMessage.content,
        replyAvatar: quotedMessage.author_avatar,
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
                content: `You are a cool, knowledgeable English learning partner. 
                Your style is casual, witty, and native-like. 
                When answering:
                1. Focus on the nuances, slang, and cultural context of the quoted sentence.
                2. Avoid stiff textbook definitions unless specifically asked.
                3. Use emojis to make it fun.
                4. Keep explanations concise and punchy.`,
              },
              {
                role: 'user',
                content: `Here is the context (a sentence from a social media discussion):
                "${quotedMessage.content}"
                
                My Question: 
                ${questionContent}
                
                Please answer my question specifically based on the context above.`,
              },
            ],
            stream: false,
          }),
        })

        const data = await response.json()
        const aiReply =
          data.choices?.[0]?.message?.content ||
          "Sorry, I couldn't understand that."

        const aiAnswerMsg: Comment = {
          id: `local-ai-${Date.now()}`,
          post_id: postId,
          author: 'Scrollish AI',
          author_avatar:
            'https://api.dicebear.com/7.x/bottts/svg?seed=ScrollishAI',
          content: aiReply,
          content_zh: '',
          depth: userQuestionMsg.depth + 1,
          parent_id: userQuestionId,
          upvotes: 0,
          created_at: new Date().toISOString(),
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
      console.log('Send normal comment:', inputText)
      setInputText('')
      setQuotedMessage(null)
    }
  }

  // --- 手势交互 ---
  const handleContainerClick = () => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      if (navigator.vibrate) navigator.vibrate(50)
      setShowTranslation((prev) => !prev)
    }
    lastTapRef.current = now
    setContextMenu(null)
    if (showSettings) setShowSettings(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (showSettings) setShowSettings(false)
    if (scrollContainerRef.current?.scrollTop === 0) {
      touchStartRef.current = e.touches[0].clientY
      setIsDragging(true)
    }
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const currentY = e.touches[0].clientY
    const diff = currentY - touchStartRef.current
    if (diff > 0 && scrollContainerRef.current?.scrollTop === 0) {
      setPullY(Math.pow(diff, 0.8))
    }
  }
  const handleTouchEnd = () => {
    setIsDragging(false)
    if (pullY > 100) {
      if (navigator.vibrate) navigator.vibrate(10)
      onBack()
    }
    setPullY(0)
    touchStartRef.current = 0
  }

  // 气泡长按
  const handleBubbleTouchStart = (e: React.TouchEvent, msg: ThreadMessage) => {
    e.stopPropagation()
    const touch = e.touches[0]
    pressStartPos.current = { x: touch.clientX, y: touch.clientY }
    bubblePressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50)
      setContextMenu({ x: touch.clientX, y: touch.clientY, msg })
    }, 600)
  }
  const handleBubbleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation()
    const touch = e.touches[0]
    const moveDist = Math.hypot(
      touch.clientX - pressStartPos.current.x,
      touch.clientY - pressStartPos.current.y,
    )
    if (moveDist > 10 && bubblePressTimer.current) {
      clearTimeout(bubblePressTimer.current)
      bubblePressTimer.current = null
    }
  }
  const handleBubbleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation()
    if (bubblePressTimer.current) {
      clearTimeout(bubblePressTimer.current)
      bubblePressTimer.current = null
    }
  }

  const handleCopy = () => {
    if (contextMenu) {
      navigator.clipboard.writeText(contextMenu.msg.content)
      setContextMenu(null)
    }
  }
  const handleQuoteAsk = () => {
    if (contextMenu) {
      setQuotedMessage(contextMenu.msg)
      setIsAiMode(true)
      setContextMenu(null)
    }
  }
  const handleDelete = () => {
    if (contextMenu && (contextMenu.msg.isLocal || contextMenu.msg.isLocalAi)) {
      deleteLocalComment(postId, contextMenu.msg.id)
      setContextMenu(null)
    }
  }

  const bgImage = postImage || fetchedImage
  const isLoading = messages.length === 0

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col bg-[#0B0A09] overflow-hidden overscroll-none shadow-2xl ${!isDragging ? 'transition-transform duration-300 ease-out' : ''}`}
      style={{
        transform: `translateY(${pullY}px)`,
        borderRadius: pullY > 0 ? `${Math.min(pullY / 10, 40)}px` : '0px',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleContainerClick}>
      {/* 0. Word Detail Overlay */}
      {selectedWord && (
        <WordDetailOverlay
          word={selectedWord}
          onClose={() => setSelectedWord(null)}
          onSave={(w) => console.log('Saved word:', w)}
        />
      )}

      {/* 1. Context Menu */}
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
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-[101] bg-[#1C1C1E] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[160px] flex flex-col"
              style={{
                left: Math.min(contextMenu.x, window.innerWidth - 170),
                top: Math.min(contextMenu.y, window.innerHeight - 150),
              }}
              onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleCopy}
                className="w-full text-left px-4 py-3.5 text-white text-sm font-medium hover:bg-white/10 flex items-center gap-3 border-b border-white/5 active:bg-white/20">
                <span className="material-symbols-outlined text-[18px]">
                  content_copy
                </span>{' '}
                Copy
              </button>
              <button
                onClick={handleQuoteAsk}
                className="w-full text-left px-4 py-3.5 text-white text-sm font-medium hover:bg-white/10 flex items-center gap-3 active:bg-white/20 border-b border-white/5">
                <span className="material-symbols-outlined text-[18px] text-orange-500">
                  auto_awesome
                </span>
                <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent font-bold">
                  Quote & Ask
                </span>
              </button>

              {(contextMenu.msg.isLocal || contextMenu.msg.isLocalAi) && (
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-4 py-3.5 text-red-500 text-sm font-medium hover:bg-white/10 flex items-center gap-3 active:bg-white/20">
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

      {/* 2. Settings Sidebar */}
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
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 bottom-0 right-0 w-64 bg-[#1C1C1E] border-l border-white/10 z-[95] shadow-2xl p-6 flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              <h2 className="text-white text-lg font-black mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined">tune</span>{' '}
                Preferences
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3">
                    Content Difficulty
                  </h3>
                  <div className="flex flex-col gap-2">
                    {(
                      ['Original', 'IELTS', 'CET6', 'CET4'] as DifficultyLevel[]
                    ).map((level) => (
                      <button
                        key={level}
                        onClick={() => setDifficulty(level)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all active:scale-95 ${
                          difficulty === level
                            ? 'bg-primary/20 border-primary/50 text-primary'
                            : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10'
                        }`}>
                        <span className="text-sm font-bold">{level}</span>
                        {difficulty === level && (
                          <span className="material-symbols-outlined text-[16px]">
                            check_circle
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 3. Word Analysis Overlay (Deprecated in favor of WordDetailOverlay but kept for 'Glow' logic) */}
      {activeAnalysis && (
        <div
          className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-end animate-in fade-in duration-200"
          onClick={() => setActiveAnalysis(null)}>
          <div
            className="w-full bg-[#1A1A1A] rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 border-t border-white/10"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-500 fill-[1]">
                    auto_awesome
                  </span>
                  <span className="bg-orange-500/10 text-orange-500 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest">
                    {activeAnalysis.type}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white capitalize tracking-tight">
                  {activeAnalysis.keyword}
                </h3>
              </div>
              <button
                onClick={() => setActiveAnalysis(null)}
                className="text-white/40 bg-white/5 p-2 rounded-full">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-gray-300 leading-relaxed text-[16px] font-medium">
              {activeAnalysis.explanation}
            </p>
          </div>
        </div>
      )}

      {/* Top Pull Indicator */}
      <div
        className="absolute top-0 left-0 right-0 h-16 flex items-center justify-center pointer-events-none transition-opacity duration-200 z-[70]"
        style={{
          opacity: Math.min(pullY / 80, 1),
          transform: `translateY(-${30 - Math.min(pullY / 3, 30)}px)`,
        }}>
        <div className="flex flex-col items-center gap-1">
          <span className="material-symbols-outlined text-white/50 text-[20px] animate-bounce">
            keyboard_arrow_down
          </span>
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
            Release to Close
          </span>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {bgImage ? (
          <div
            className="absolute inset-[-50%] bg-cover bg-center blur-[100px] opacity-40 saturate-150 transform scale-110"
            style={{ backgroundImage: `url("${bgImage}")` }}
          />
        ) : (
          <div className="absolute inset-[-20%] bg-gradient-to-br from-purple-900/30 via-black to-blue-900/30 blur-[80px] opacity-60" />
        )}
        <div className="absolute inset-0 bg-black/80 mix-blend-multiply" />
      </div>

      <header className="relative z-50 bg-[#0B0A09]/80 backdrop-blur-xl border-b border-white/5 min-h-[64px] py-2 flex items-center px-4 shrink-0 justify-between">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onBack()
          }}
          className="text-white flex items-center justify-center w-10 h-10 rounded-full bg-white/5 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[24px]">
            keyboard_arrow_down
          </span>
        </button>
        <div className="flex flex-col items-center gap-1">
          <span className="text-white font-bold text-[15px] leading-tight">
            Discussion
          </span>
          <span className="text-white/40 text-[10px] font-medium tracking-wider leading-tight">
            {isLoading ? 'Syncing...' : `${messages.length} replies`}
          </span>
          <div
            className={`
            px-3 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-[0.15em] transition-all mt-0.5
            ${showTranslation ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-white/5 border-white/5 text-white/30'}
          `}>
            {showTranslation ? 'Bilingual On' : 'Double Tap Trans'}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowSettings(true)
          }}
          className="text-white flex items-center justify-center w-10 h-10 rounded-full bg-white/5 active:scale-90 transition-transform hover:bg-white/10">
          <span className="material-symbols-outlined text-[20px]">
            more_horiz
          </span>
        </button>
      </header>

      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 no-scrollbar relative z-10 overflow-x-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
            <p className="text-orange-500/50 text-[10px] font-black tracking-widest uppercase animate-pulse">
              Syncing Context Tree...
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const smartSentences = getSmartSentences(msg, difficulty)
              const isMe = msg.isQuestion

              return (
                <div
                  key={`${msg.id}-${index}`}
                  className={`flex items-start gap-3 group animate-in slide-in-from-bottom-4 duration-500 fill-mode-backwards ${isMe ? 'flex-row-reverse' : ''}`}
                  style={{ animationDelay: `${index * 50}ms` }}>
                  <div className="shrink-0 pt-1">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-black p-[1px] shadow-lg">
                      {msg.author_avatar &&
                      !msg.author_avatar.includes('default') &&
                      !msg.isLocal ? (
                        <div
                          className="w-full h-full rounded-full bg-cover bg-center border border-white/10"
                          style={{
                            backgroundImage: `url("${msg.author_avatar}")`,
                          }}
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-[#1A1A1A] flex items-center justify-center border border-white/10">
                          <span className="text-[10px] font-black text-white/60">
                            {msg.isAi || msg.isLocalAi
                              ? 'AI'
                              : msg.isLocal
                                ? 'ME'
                                : getInitials(msg.author)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={`flex flex-1 flex-col gap-1.5 min-w-0 max-w-full ${isMe ? 'items-end' : ''}`}>
                    <div
                      className={`flex items-baseline gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span
                        className={`text-[12px] font-bold truncate ${msg.isLocalAi ? 'text-orange-400' : msg.isQuestion ? 'text-white/90' : 'text-gray-300'}`}>
                        {msg.author}
                      </span>
                      {(msg.isAi || msg.isLocalAi) && (
                        <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded font-black uppercase">
                          AI Bot
                        </span>
                      )}
                      {msg.isQuestion && (
                        <span className="bg-white/10 text-white/50 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">
                          Question
                        </span>
                      )}
                    </div>

                    {msg.replyText && (
                      <div
                        className={`
                        mb-1 pl-2 pr-2 py-1.5 rounded-lg max-w-[95%] flex items-center gap-2
                        ${
                          isMe
                            ? 'border-r-[3px] border-orange-500/50 bg-orange-500/10 flex-row-reverse text-right'
                            : 'border-l-[3px] border-white/20 bg-white/5 text-left'
                        }
                      `}>
                        <div className="shrink-0 w-5 h-5 rounded-full bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                          {msg.replyAvatar &&
                          !msg.replyAvatar.includes('default') ? (
                            <img
                              src={msg.replyAvatar}
                              className="w-full h-full object-cover"
                              alt=""
                            />
                          ) : (
                            <span className="text-[8px] font-black text-white/60">
                              {getInitials(msg.replyToName || '')}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div
                            className={`flex items-center gap-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <span className="material-symbols-outlined text-[10px] text-white/40">
                              reply
                            </span>
                            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider truncate">
                              {msg.replyToName}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/40 line-clamp-1 italic">
                            {msg.replyText}
                          </p>
                        </div>
                      </div>
                    )}

                    <div
                      className={`
                        flex flex-col gap-2 w-full cursor-pointer group-hover:brightness-110 transition-all select-none
                        ${isMe ? 'items-end' : 'items-start'}
                        ${msg.isQuestion ? 'opacity-90' : ''}
                      `}
                      onTouchStart={(e) => handleBubbleTouchStart(e, msg)}
                      onTouchMove={handleBubbleTouchMove}
                      onTouchEnd={handleBubbleTouchEnd}>
                      {smartSentences.map((sentenceData, bubbleIdx) => (
                        <div
                          key={bubbleIdx}
                          className={`
                          relative px-4 py-3 shadow-sm backdrop-blur-md border 
                          text-[15px] leading-relaxed font-medium break-words max-w-full
                          ${bubbleIdx === 0 ? (isMe ? 'rounded-2xl rounded-tr-none' : 'rounded-2xl rounded-tl-none') : 'rounded-2xl'} 
                          ${
                            msg.isQuestion
                              ? 'bg-orange-500/20 border-orange-500/40 text-white'
                              : 'bg-[#1A1A1A]/80 border-white/5 text-gray-100'
                          }
                        `}>
                          {difficulty !== 'Original' &&
                            bubbleIdx === 0 &&
                            !msg.isQuestion &&
                            !msg.isLocalAi && (
                              <span className="text-[9px] font-black text-primary/60 uppercase tracking-wider mr-2 border border-primary/20 px-1 rounded align-middle">
                                {difficulty} AI
                              </span>
                            )}

                          {renderFragmentWithGlow(
                            sentenceData.en,
                            msg.analysis,
                          )}

                          <AnimatePresence>
                            {showTranslation &&
                              sentenceData.zh &&
                              !msg.isLocal && (
                                <motion.div
                                  initial={{
                                    height: 0,
                                    opacity: 0,
                                    marginTop: 0,
                                  }}
                                  animate={{
                                    height: 'auto',
                                    opacity: 1,
                                    marginTop: 8,
                                  }}
                                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                  className="overflow-hidden border-t border-white/10">
                                  <p className="text-[13px] text-white/50 italic leading-relaxed pt-2">
                                    {sentenceData.zh}
                                  </p>
                                </motion.div>
                              )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}

            {isAiLoading && (
              <div className="flex justify-start px-12 py-4 animate-in slide-in-from-bottom-2 fade-in">
                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-100" />
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-200" />
                  <span className="text-[10px] text-orange-500 font-bold ml-2">
                    DeepSeek Analyzing...
                  </span>
                </div>
              </div>
            )}

            <div className="h-32" />
          </>
        )}
      </main>

      {/* Input Area */}
      <div
        className="absolute bottom-0 left-0 right-0 z-50 bg-[#0B0A09]/90 backdrop-blur-xl border-t border-white/5 px-4 pt-3 pb-8 safe-area-bottom"
        onClick={(e) => e.stopPropagation()}>
        {quotedMessage && (
          <div
            className={`
            flex justify-between items-center rounded-t-xl px-4 py-2 mx-2 -mt-14 mb-2 border border-b-0 animate-in slide-in-from-bottom
            ${isAiMode ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5'}
          `}>
            <div className="flex flex-col max-w-[85%]">
              <span
                className={`text-[9px] font-black uppercase tracking-widest ${isAiMode ? 'text-orange-500' : 'text-white/30'}`}>
                {isAiMode ? '✨ Ask AI about this' : 'Replying to'}
              </span>
              <span className="text-[11px] text-white/70 truncate font-medium mt-0.5">
                "{quotedMessage.content}"
              </span>
            </div>
            <button
              onClick={() => {
                setQuotedMessage(null)
                setIsAiMode(false)
              }}>
              <span className="material-symbols-outlined text-[16px] text-white/40">
                close
              </span>
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div
            className={`
            flex-1 rounded-full h-11 flex items-center px-4 border transition-all
            ${
              isAiMode
                ? 'bg-orange-500/5 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                : 'bg-white/10 border-white/5 focus-within:bg-white/15'
            }
          `}>
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="bg-transparent border-none outline-none text-white text-[16px] w-full placeholder-white/30"
              placeholder={
                isAiMode
                  ? 'E.g. Explain the grammar...'
                  : 'Add to the discussion...'
              }
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className={`
              w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform
              ${!inputText.trim() ? 'opacity-50 grayscale' : ''}
              ${isAiMode ? 'bg-gradient-to-tr from-orange-400 to-red-500' : 'bg-gradient-to-tr from-orange-500 to-red-600'}
            `}>
            <span className="material-symbols-outlined text-[20px]">
              {isAiMode ? 'auto_awesome' : 'send'}
            </span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .animate-glow { animation: glow 2s ease-in-out infinite; }
        .fill-mode-backwards { animation-fill-mode: backwards; }
      `}</style>
    </div>
  )
}

export default ChatRoom
