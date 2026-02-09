import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
} from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../supabase'
import { Page } from '../types'
import { useCommentStore } from '../store/useCommentStore'
import { useDictionaryStore } from '../store/useDictionaryStore'
import MessageBubble from '../components/MessageBubble'
import WordDetailOverlay from '../components/WordDetailOverlay'

interface TopicHubProps {
  onNavigate: (page: Page) => void
  onSelectComment: (commentId: string) => void
  post: any
  initialCommentId?: string | null
}

const TopicHub: React.FC<TopicHubProps> = ({
  onNavigate,
  onSelectComment,
  post,
  initialCommentId,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [animationClass, setAnimationClass] = useState('')
  const [isExiting, setIsExiting] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [opContent, setOpContent] = useState<{ en: string; cn: string } | null>(
    null,
  )

  // 查词状态
  const [viewingWord, setViewingWord] = useState<string | null>(null)

  // [新增] 卡片是否滚动到底部
  const [isCardAtBottom, setIsCardAtBottom] = useState(false)

  const startPos = useRef({ x: 0, y: 0 })
  const contentRef = useRef<HTMLDivElement>(null)
  const hasRestoredPosition = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const { fetchComments, getComments, isLoading } = useCommentStore()
  const { getDefinition, triggerAnalysis } = useDictionaryStore()

  // 每次切换卡片时重置底部状态
  useEffect(() => {
    setIsCardAtBottom(false)
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [currentIndex])

  useEffect(() => {
    if (post?.id) {
      fetchComments(post.id)
      if (post.content_en && post.content_en.length > 10) {
        setOpContent({ en: post.content_en, cn: post.content_cn })
      } else {
        supabase
          .from('production_posts')
          .select('content_en, content_cn, title_en, title_cn')
          .eq('id', post.id)
          .single()
          .then(({ data }) => {
            if (data)
              setOpContent({
                en: data.content_en || data.title_en || '',
                cn: data.content_cn || data.title_cn || '',
              })
          })
      }
    }
  }, [post, fetchComments])

  const allComments = getComments(post.id)
  const comments = useMemo(() => {
    const opCard = {
      id: 'op-card-0',
      isOpCard: true,
      author: post.author || post.subreddit || 'OP',
      content:
        opContent?.en || post.content_en || post.title_en || 'Loading...',
      content_cn: opContent?.cn || post.content_cn || post.title_cn || '',
      upvotes: post.upvotes || 0,
      depth: -1,
      enrichment: null,
    }
    const topLevel = allComments
      .filter((c) => c.depth === 0)
      .sort((a, b) => b.upvotes - a.upvotes)
    if (topLevel.length === 0 && isLoading[post.id]) return [opCard]
    return [opCard, ...topLevel]
  }, [allComments, isLoading, post, opContent])

  useEffect(() => {
    if (
      !hasRestoredPosition.current &&
      initialCommentId &&
      comments.length > 1
    ) {
      const targetIndex = comments.findIndex((c) => c.id === initialCommentId)
      if (targetIndex !== -1) {
        setCurrentIndex(targetIndex)
        hasRestoredPosition.current = true
      }
    }
  }, [comments, initialCommentId])

  const imageUrl = post.image_url || post.image || ''
  const videoUrl = post.videoUrl || post.video_url || ''
  const hasVideo = !!videoUrl && !videoError
  const activeComment = comments[currentIndex] || comments[0]

  useEffect(() => {
    if (hasVideo && videoRef.current) {
      videoRef.current.muted = true
      videoRef.current.play().catch(() => {})
    }
  }, [hasVideo])

  const handleBack = () => {
    if (navigator.vibrate) navigator.vibrate(20)
    setIsExiting(true)
    setTimeout(() => onNavigate(Page.Home), 50)
  }

  const goToChatRoom = () => {
    if (activeComment?.isOpCard) return
    onSelectComment(activeComment.id)
    onNavigate(Page.ChatRoom)
  }

  const handleWordClick = async (word: string, context: string) => {
    await triggerAnalysis(word, context)
    setViewingWord(word)
  }

  // [新增] 监听卡片内部滚动，判断是否到底部
  const handleCardScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    // 允许 10px 误差
    const isBottom = scrollTop + clientHeight >= scrollHeight - 10
    setIsCardAtBottom(isBottom)
  }

  const handleTouchStart = (e: React.TouchEvent) =>
    (startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = e.changedTouches[0].clientX - startPos.current.x
    const diffY = e.changedTouches[0].clientY - startPos.current.y

    // 横向滑动优先 (切换卡片)
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > 50) diffX < 0 ? nextCard() : prevCard()
    } else {
      // 纵向滑动 (进入聊天室)
      // 只有非 OP 卡片，且在底部，且向上拉动(diffY < 0)时触发
      if (diffY < -50 && !activeComment.isOpCard) {
        // 如果卡片内容很短（不需要滚动）或者已经滚动到底部
        if (
          isCardAtBottom ||
          (contentRef.current &&
            contentRef.current.scrollHeight <= contentRef.current.clientHeight)
        ) {
          goToChatRoom()
        }
      }
    }
  }

  const nextCard = () => {
    if (currentIndex >= comments.length - 1) return
    setAnimationClass('slide-out-left')
    setTimeout(() => {
      setCurrentIndex((p) => p + 1)
      setAnimationClass('slide-in-right')
      setTimeout(() => setAnimationClass(''), 400)
    }, 200)
  }
  const prevCard = () => {
    if (currentIndex <= 0) return
    setAnimationClass('slide-out-right')
    setTimeout(() => {
      setCurrentIndex((p) => p - 1)
      setAnimationClass('slide-in-left')
      setTimeout(() => setAnimationClass(''), 400)
    }, 200)
  }

  return (
    <div
      className={`h-full flex flex-col bg-[#FDFCFB] dark:bg-[#0B0A09] overflow-hidden select-none relative transition-colors duration-500 ${isExiting ? 'opacity-0 scale-95' : 'opacity-100'}`}>
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="frost-overlay" />
        <div className="blob-pastel -top-20 -left-20 bg-[#FFEDD5] dark:bg-orange-500/20 opacity-60 dark:opacity-40" />
        <div className="blob-pastel top-1/4 -right-40 bg-[#FED7AA] dark:bg-red-500/10 opacity-60 dark:opacity-30" />
        <div className="blob-pastel -bottom-20 -left-20 bg-[#FFEDD5] dark:bg-orange-500/10 opacity-60 dark:opacity-30" />
        <div
          className="absolute inset-[-50%] bg-cover bg-center blur-[120px] opacity-10 dark:opacity-20 animate-pulse-slow"
          style={{ backgroundImage: `url("${imageUrl}")` }}
        />
      </div>

      {viewingWord && (
        <WordDetailOverlay
          word={viewingWord}
          definition={getDefinition(viewingWord)}
          onClose={() => setViewingWord(null)}
        />
      )}

      <div className="mx-4 mt-12 h-56 relative z-50">
        <motion.div
          initial={{ y: -300, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute inset-0 rounded-[2.5rem] border-2 border-white/40 dark:border-white/20 shadow-2xl overflow-hidden bg-gray-200 dark:bg-[#1C1C1E]">
          {hasVideo ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-cover"
              loop
              muted
              playsInline
              autoPlay
            />
          ) : (
            <img src={imageUrl} className="w-full h-full object-cover" alt="" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 z-20 pointer-events-none" />
        </motion.div>
        <div className="absolute inset-x-0 bottom-0 p-6 z-[70] pointer-events-none">
          <span className="text-white/80 text-[10px] font-bold uppercase tracking-widest">
            {post.subreddit}
          </span>
          <h1 className="text-white text-xl font-black leading-tight line-clamp-2 mt-1">
            {post.titleEn}
          </h1>
        </div>
        <button
          onClick={handleBack}
          className="absolute top-5 left-5 w-10 h-10 bg-black/20 backdrop-blur rounded-full flex items-center justify-center text-white border border-white/20 z-[80]">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
      </div>

      <main className="flex-1 flex flex-col items-center justify-start pt-6 z-40">
        <div className="w-full px-8 flex justify-between items-center mb-4">
          <span className="text-gray-500 dark:text-white/40 text-[10px] font-bold uppercase">
            {activeComment?.isOpCard
              ? 'Original Post'
              : `Opinion ${currentIndex}/${comments.length - 1}`}
          </span>
          <div className="h-1 w-16 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / Math.max(comments.length, 1)) * 100}%`,
              }}
            />
          </div>
        </div>

        <div
          className="relative w-full px-4 h-[52vh]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}>
          <div
            className={`absolute inset-x-4 top-0 bottom-0 bg-white/90 dark:bg-[#121212]/80 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden transition-all duration-300 shadow-2xl ${animationClass}`}>
            <div
              className="h-16 border-b border-gray-100 dark:border-white/5 flex items-center justify-between px-6 shrink-0"
              onClick={goToChatRoom}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full p-[2px] ${activeComment?.isOpCard ? 'bg-gray-200 dark:bg-white' : 'bg-gradient-to-tr from-orange-500 to-red-500'}`}>
                  <div className="w-full h-full rounded-full bg-white dark:bg-[#121212] flex items-center justify-center text-[10px] font-black">
                    {activeComment?.isOpCard
                      ? 'OP'
                      : activeComment?.author.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <span className="text-gray-900 dark:text-white font-bold text-sm">
                  {activeComment?.author}
                </span>
              </div>
              {!activeComment?.isOpCard && (
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">
                    expand_less
                  </span>
                </div>
              )}
            </div>

            <div
              ref={contentRef}
              onScroll={handleCardScroll}
              className="flex-1 p-6 overflow-y-auto no-scrollbar scroll-smooth">
              <MessageBubble
                comment={activeComment}
                isUser={false}
                onWordClick={handleWordClick}
                showTranslation={true}
              />
              <div className="h-12" />
            </div>

            {/* [核心修复] 动态交互提示 */}
            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-white dark:from-[#121212] to-transparent pointer-events-none flex items-end justify-center pb-4 opacity-80">
              {activeComment?.isOpCard ? (
                // 0号卡片: 提示右滑
                <div className="flex flex-col items-center animate-bounce-subtle">
                  <div className="flex items-center gap-1 text-gray-400 dark:text-white">
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      Swipe Left
                    </span>
                    <span className="material-symbols-outlined text-[14px]">
                      arrow_forward
                    </span>
                  </div>
                </div>
              ) : (
                // 其他卡片: 提示上拉 (仅当到底部时变色提示)
                <div
                  className={`flex flex-col items-center transition-all duration-300 ${isCardAtBottom ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-50'}`}>
                  {isCardAtBottom ? (
                    <>
                      <span className="material-symbols-outlined text-orange-500 text-[18px] animate-bounce">
                        keyboard_double_arrow_up
                      </span>
                      <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest mt-0.5">
                        Pull Up to Discuss
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-gray-300 dark:text-white/30 text-[16px]">
                        keyboard_arrow_down
                      </span>
                      <span className="text-[8px] font-black text-gray-300 dark:text-white/30 uppercase tracking-widest">
                        Scroll to Read
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* [核心修复] 底部滚动字幕回归 */}
      <div className="h-14 w-full relative z-40 overflow-hidden flex items-center bg-gray-100/50 dark:bg-white/5 backdrop-blur-md border-t border-gray-200 dark:border-white/5 opacity-80">
        <div className="flex whitespace-nowrap animate-ticker items-center gap-10 px-8">
          {[1, 2, 3].map((v) => (
            <div key={v} className="flex items-center gap-12">
              <span className="text-[10px] font-black text-orange-500 dark:text-orange-300 tracking-[0.15em]">
                欢 迎 来 到 SCROLLISH · 如 果 遇 到 问 题 请 及 时 向 我 们 反
                馈 谢 谢！❤
              </span>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                <span
                  className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"
                  style={{ animationDelay: '0.2s' }}
                />
                <span
                  className="w-2 h-2 bg-orange-300 rounded-full animate-pulse"
                  style={{ animationDelay: '0.4s' }}
                />
              </div>
              <span className="text-[11px] font-black text-orange-500 dark:text-orange-400 tracking-wider font-mono">
                Welcome to Scrollish!
              </span>
              <div className="flex gap-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-1 h-3 bg-white/20 rounded-full rotate-12"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .animate-ticker { animation: ticker 40s linear infinite; }
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }
        .slide-out-left { animation: slideOutLeft 0.3s forwards ease-in; } 
        .slide-in-right { animation: slideInRight 0.3s forwards ease-out; } 
        .slide-out-right { animation: slideOutRight 0.3s forwards ease-in; } 
        .slide-in-left { animation: slideInLeft 0.3s forwards ease-out; } 
        @keyframes slideOutLeft { to { transform: translateX(-120%) rotate(-5deg); opacity: 0; } } 
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } 
        @keyframes slideOutRight { to { transform: translateX(120%) rotate(5deg); opacity: 0; } } 
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .blob-pastel { position: absolute; width: 500px; height: 500px; filter: blur(100px); border-radius: 50%; z-index: 0; pointer-events: none; }
        .frost-overlay { position: fixed; inset: 0; background: url('https://grainy-gradients.vercel.app/noise.svg'); opacity: 0.03; pointer-events: none; z-index: 5; }
      `}</style>
    </div>
  )
}

export default TopicHub
