import React, { useState, useEffect, useRef } from 'react'
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
  postImage?: string
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

// --- Helper Functions (来自 main 的补丁) ---
const decodeHtmlEntity = (str: string) => {
  if (!str) return ''
  return str.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

const parseGiphy = (text: string) => {
  if (!text) return ''
  const giphyRegex = /!\[gif\]\(giphy\|([a-zA-Z0-9]+)(?:\|[^)]*)?\)/g
  return text.replace(giphyRegex, (match, id) => `https://media.giphy.com/media/${id}/giphy.gif`)
}

const segmentText = (text: string): string[] => {
  try {
    // @ts-ignore
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
    return [...segmenter.segment(text)].map((s: any) => s.segment.trim())
  } catch (e) {
    return text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text]
  }
}

const ChatRoom: React.FC<ChatRoomProps> = ({
  postId,
  postImage,
  focusCommentId,
  onBack,
}) => {
  const {
    comments,
    fetchComments,
    addLocalComment,
    deleteLocalComment,
    buildMessageThread,
  } = useCommentStore()
  const { getDefinition, triggerAnalysis } = useDictionaryStore()

  // --- State ---
  const [messages, setMessages] = useState<Comment[]>([])
  const [isInitializing, setIsInitializing] = useState(true)
  const [opPostData, setOpPostData] = useState<{ content: string; content_cn: string; author: string } | null>(null)
  const [inputText, setInputText] = useState('')
  const [quotedMessage, setQuotedMessage] = useState<Comment | null>(null)
  const [viewingWord, setViewingWord] = useState<string | null>(null)
  const [viewingNote, setViewingNote] = useState<CulturalNote[] | null>(null)
  const [showGlobalTranslation, setShowGlobalTranslation] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msg: Comment } | null>(null)
  const [expandedTranslations, setExpandedTranslations] = useState<Record<string, boolean>>({})
  const [isAiMode, setIsAiMode] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Original')
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [returnToId, setReturnToId] = useState<string | null>(null)
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null)
  const [pullY, setPullY] = useState(0)

  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const bgPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartRef = useRef(0)

  // --- Effects ---
  useEffect(() => {
    const handleContextMenu = (e: Event) => e.preventDefault()
    window.addEventListener('contextmenu', handleContextMenu, { capture: true })
    return () => window.removeEventListener('contextmenu', handleContextMenu, { capture: true })
  }, [])

  useEffect(() => {
    const fetchOp = async () => {
      const { data } = await supabase.from('production_posts').select('*').eq('id', postId).single()
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
  }, [postId])

  useEffect(() => {
    const updateMessages = () => {
      const msgs = buildMessageThread(postId, focusCommentId, opPostData)
      setMessages(msgs)
    }
    if (isInitializing) {
      setTimeout(() => { updateMessages(); setIsInitializing(false); }, 150)
    } else {
      updateMessages()
    }
  }, [postId, focusCommentId, opPostData, comments?.[postId]])

  // --- Content Processing ---
  const getDisplaySentences = (msg: Comment) => {
    let content = msg.content || ''
    if (difficulty !== 'Original' && msg.enrichment?.difficulty_variants?.[difficulty]) {
      content = msg.enrichment.difficulty_variants[difficulty].content || content
    }
    
    const rawSegments = segmentText(content)
    return rawSegments.map(en => ({
      en: parseGiphy(decodeHtmlEntity(en)),
      zh: msg.content_cn || null
    })).filter(s => s.en.trim())
  }

  // --- Actions ---
  const handleWordClick = async (word: string, context: string, msg: Comment) => {
    await triggerAnalysis(word, context)
    setViewingWord(word)
    // 沉浸式优化：点击句子直接进入 AI 对话引用模式
    if (!msg.isLocal) {
      setQuotedMessage({ id: msg.id, author: msg.author, content: context, depth: msg.depth })
      setIsAiMode(true)
    }
  }

  const handleSend = async () => {
    if (!inputText.trim() || !isAiMode || !quotedMessage) return
    const question = inputText
    setInputText('')
    setIsAiLoading(true)

    const userMsgId = `local-q-${Date.now()}`
    addLocalComment(postId, {
      id: userMsgId, post_id: postId, author: 'You', content: question,
      depth: (quotedMessage.depth || 0) + 1, parent_id: quotedMessage.id,
      isLocal: true, isQuestion: true, replyToName: quotedMessage.author, replyText: quotedMessage.content,
      upvotes: 0, created_at: new Date().toISOString()
    })

    try {
      const { data } = await supabase.functions.invoke('chat', {
        body: { model: AI_MODEL, messages: [
          { role: 'system', content: `Simulate Reddit user "${quotedMessage.author}". Reply to: "${question}" based on your context: "${quotedMessage.content}". Be concise.` },
          { role: 'user', content: question }
        ]}
      })
      const aiReply = data.choices?.[0]?.message?.content || '...'
      addLocalComment(postId, {
        id: `local-ai-${Date.now()}`, post_id: postId, author: quotedMessage.author, content: aiReply,
        depth: (quotedMessage.depth || 0) + 2, parent_id: userMsgId,
        isLocal: true, isLocalAi: true, replyToName: 'You', replyText: question,
        upvotes: 0, created_at: new Date().toISOString()
      })
    } catch (e) { console.error(e) } finally {
      setIsAiLoading(false)
      setQuotedMessage(null)
      setIsAiMode(false)
    }
  }

  const handleJumpToWithReturn = (targetId: string | null, currentId: string) => {
    if (!targetId) return
    setReturnToId(currentId)
    const el = document.getElementById(`msg-${targetId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedId(targetId)
    setTimeout(() => setHighlightedId(null), 1500)
  }

  // --- Gestures ---
  const handleBgStart = (e: any) => {
    const touchY = e.touches ? e.touches[0].clientY : e.clientY
    touchStartRef.current = touchY
    bgPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50)
      setShowGlobalTranslation(p => !p)
    }, 450)
  }

  const handleBgEnd = () => {
    if (bgPressTimerRef.current) clearTimeout(bgPressTimerRef.current)
    setPullY(0)
  }

  const handleBubblePress = (e: any, msg: Comment) => {
    const x = e.touches ? e.touches[0].clientX : e.clientX
    const y = e.touches ? e.touches[0].clientY : e.clientY
    pressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50)
      if (msg.isLocalAi) {
          setQuotedMessage(msg); setIsAiMode(true); setTimeout(() => inputRef.current?.focus(), 100)
      } else {
          setContextMenu({ x, y, msg })
      }
    }, 500)
  }

  const DROPLET_SHAPE = "50% 50% 50% 50% / 60% 60% 43% 43%"

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#FDFCFB] dark:bg-[#0B0A09] select-none overscroll-none overflow-hidden">
      {/* 沉浸式动态背景 */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-[-50%] bg-cover bg-center blur-[100px] opacity-15" 
             style={{ backgroundImage: `url("${postImage}")` }} />
      </div>

      {viewingWord && (
        <WordDetailOverlay word={viewingWord} definition={getDefinition(viewingWord)} onClose={() => setViewingWord(null)} />
      )}

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-5 z-[70] bg-white/10 dark:bg-black/20 backdrop-blur-3xl border-b border-gray-100 dark:border-white/5"
           style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(4.5rem + env(safe-area-inset-top))' }}>
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-white/10 rounded-2xl" style={{ borderRadius: DROPLET_SHAPE }}>
          <span className="material-symbols-outlined text-gray-600 dark:text-white/80">keyboard_arrow_down</span>
        </button>
        <div className="flex flex-col items-center">
            <span className="text-gray-900 dark:text-white font-black text-sm tracking-tight">Thread Discussion</span>
            <span className="text-gray-400 dark:text-white/30 text-[10px] uppercase font-bold tracking-widest">{messages.length - 1} RESPONSES</span>
        </div>
        <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-white/10 rounded-2xl" style={{ borderRadius: DROPLET_SHAPE }}>
          <span className="material-symbols-outlined text-gray-600 dark:text-white/80 text-[20px]">tune</span>
        </button>
      </div>

      <main ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-8 no-scrollbar relative z-10 pt-[calc(5rem+env(safe-area-inset-top))]">
        {messages.map((msg, index) => {
          const isOP = msg.id === 'op-message'
          const sentences = getDisplaySentences(msg)
          const isUser = msg.isLocal && !msg.isLocalAi

          return (
            <motion.div key={msg.id} id={`msg-${msg.id}`} 
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${highlightedId === msg.id ? 'bg-orange-500/10 -mx-3 px-3 py-2 rounded-2xl transition-all' : ''}`}>
              <div className="shrink-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm ${isOP ? 'bg-orange-500 text-white border-orange-600' : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/10 text-gray-400'}`}>
                   {isOP ? 'OP' : msg.isLocalAi ? '🤖' : msg.author[0].toUpperCase()}
                </div>
              </div>
              <div className={`flex flex-col gap-1.5 max-w-[85%] ${isUser ? 'items-end' : ''}`}>
                <span className="text-[11px] font-black text-gray-400 dark:text-white/30 uppercase tracking-widest">{msg.isLocalAi ? 'Dopa' : msg.author}</span>
                
                {msg.replyText && (
                  <div onClick={() => handleJumpToWithReturn(msg.parent_id, msg.id)}
                       className="text-[10px] text-gray-400 border-l-2 border-orange-500/30 pl-2 mb-1 cursor-pointer line-clamp-1">
                    @{msg.replyToName}: {msg.replyText}
                  </div>
                )}

                <div onTouchStart={(e) => handleBubblePress(e, msg)} onTouchEnd={() => clearTimeout(pressTimerRef.current!)}
                     className={`px-4 py-2.5 rounded-[1.5rem] shadow-sm ${isUser ? 'bg-orange-500 text-white rounded-tr-none' : 'bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 text-gray-800 dark:text-white/90 rounded-tl-none'}`}>
                  {sentences.map((s, i) => (
                    <span key={i} className="inline mr-1">
                      <InteractiveText text={s.en} contextSentence={s.en} externalOnClick={(w) => handleWordClick(w, s.en, msg)} disabled={isUser} />
                      {(showGlobalTranslation || expandedTranslations[msg.id]) && s.zh && (
                        <div className="mt-1 text-xs opacity-50 italic">{s.zh}</div>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )
        })}
        <div className="h-32" />
      </main>

      {/* Input Bar */}
      <div className="fixed bottom-6 left-4 right-4 z-[80]">
        <div className={`p-2 rounded-[2rem] backdrop-blur-3xl border transition-all ${isAiMode ? 'bg-white/90 dark:bg-white/10 border-orange-500/50 shadow-2xl' : 'bg-gray-100/50 dark:bg-white/5 border-transparent opacity-60'}`}>
          {quotedMessage && (
            <div className="flex justify-between items-center px-3 py-1 mb-2 bg-orange-500/10 rounded-full">
              <span className="text-[10px] text-orange-600 font-bold truncate">✨ Ask {quotedMessage.author}: "{quotedMessage.content}"</span>
              <button onClick={() => {setIsAiMode(false); setQuotedMessage(null)}} className="material-symbols-outlined text-sm">close</button>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <input ref={inputRef} value={inputText} onChange={e => setInputText(e.target.value)}
                   disabled={!isAiMode} placeholder={isAiMode ? "Ask Dopa something..." : "Select a sentence to ask"}
                   className="flex-1 bg-transparent px-4 h-10 outline-none text-sm dark:text-white" />
            <button onClick={handleSend} className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${isAiMode ? 'bg-orange-500 shadow-lg' : 'bg-gray-300 dark:bg-white/10'}`}>
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
          </div>
        </div>
      </div>

      {/* Context Menu (AnimatePresence) */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                      className="fixed z-[101] bg-white dark:bg-[#1C1C1E] rounded-xl shadow-2xl p-1 min-w-[150px]"
                      style={{ left: Math.min(contextMenu.x, window.innerWidth - 160), top: Math.min(contextMenu.y, window.innerHeight - 100) }}>
            <button onClick={() => toggleSingleTranslation(contextMenu.msg.id)} className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">translate</span> Translate
            </button>
            <button onClick={() => { handleQuote(contextMenu.msg); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-orange-500 font-bold hover:bg-orange-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">format_quote</span> Quote & Ask
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ChatRoom