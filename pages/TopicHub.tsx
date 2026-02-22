import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import { Page } from '../types'
import { useCommentStore } from '../store/useCommentStore'
import { useDictionaryStore } from '../store/useDictionaryStore'
import MessageBubble from '../components/MessageBubble'
import WordDetailOverlay from '../components/WordDetailOverlay'
import { useUserStore } from '../store/useUserStore'
import { Comment, CulturalNote } from '../types'
import InteractiveText from '../components/InteractiveText'

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
  const [opContent, setOpContent] = useState<{
    en: string
    cn: string
    sentence_segments?: any[]
    cultural_notes?: any[]
  } | null>(null)

  const [viewingWord, setViewingWord] = useState<string | null>(null)
  const [viewingWordContext, setViewingWordContext] = useState<string>('')
  const [viewingNote, setViewingNote] = useState<CulturalNote[] | null>(null)
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isGesturing, setIsGesturing] = useState(false)
  const [isCardAtBottom, setIsCardAtBottom] = useState(false)

  const startPos = useRef({ x: 0, y: 0 })
  const initialDistanceRef = useRef<number | null>(null)
  const lastScaleRef = useRef(1)
  const lastTapRef = useRef(0)
  const initialTouchPosRef = useRef({ x: 0, y: 0 })
  const initialOffsetRef = useRef({ x: 0, y: 0 })
  const contentRef = useRef<HTMLDivElement>(null)
  const hasRestoredPosition = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // [新增] 专门记录触摸按下的时间戳，用于防手势误触
  const touchStartTime = useRef(0)

  const { fetchComments, getComments, isLoading } = useCommentStore()
  const { getDefinition, triggerAnalysis } = useDictionaryStore()
  const { registerWordLookup } = useUserStore()

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
        setOpContent({
          en: post.content_en,
          cn: post.content_cn,
          sentence_segments: post.sentence_segments,
          cultural_notes: post.cultural_notes,
        })
      } else {
        supabase
          .from('production_posts')
          .select(
            'content_en, content_cn, title_en, title_cn, sentence_segments, cultural_notes',
          )
          .eq('id', post.id)
          .single()
          .then(({ data }) => {
            if (data)
              setOpContent({
                en: data.content_en || data.title_en || '',
                cn: data.content_cn || data.title_cn || '',
                sentence_segments: data.sentence_segments,
                cultural_notes: data.cultural_notes,
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
      enrichment: {
        sentence_segments:
          opContent?.sentence_segments || post.sentence_segments,
        cultural_notes: opContent?.cultural_notes || post.cultural_notes || [],
      },
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

  const countDescendants = (parentId: string, all: Comment[]): number => {
    const children = all.filter((c) => c.parent_id === parentId)
    if (children.length === 0) return 0
    return (
      children.length +
      children.reduce((acc, child) => acc + countDescendants(child.id, all), 0)
    )
  }

  const activeReplyCount = useMemo(() => {
    if (activeComment.isOpCard) return 0
    return countDescendants(activeComment.id, allComments)
  }, [allComments, activeComment])

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
    if (navigator.vibrate) navigator.vibrate(20)
    const result = await triggerAnalysis(word, context)
    if (result) {
      useUserStore.getState().registerWordLookup(result, context)
    }
    setViewingWord(word)
    setViewingWordContext(context)
  }

  const handleCardScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const isBottom = scrollTop + clientHeight >= scrollHeight - 10
    setIsCardAtBottom(isBottom)
  }

  const getDistance = (t1: React.Touch, t2: React.Touch) => {
    return Math.sqrt(
      Math.pow(t2.clientX - t1.clientX, 2) +
        Math.pow(t2.clientY - t1.clientY, 2),
    )
  }

  const handlePreviewTouchStart = (e: React.TouchEvent) => {
    setIsGesturing(true)
    if (e.touches.length === 1) {
      initialTouchPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
      initialOffsetRef.current = { ...offset }
    } else if (e.touches.length === 2) {
      initialDistanceRef.current = getDistance(e.touches[0], e.touches[1])
      lastScaleRef.current = scale
    }
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      setIsGesturing(false)
      const targetScale = scale > 1 ? 1 : 2
      setScale(targetScale)
      if (targetScale === 1) setOffset({ x: 0, y: 0 })
      e.preventDefault()
    }
    lastTapRef.current = now
  }

  const handlePreviewTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      const dx = e.touches[0].clientX - initialTouchPosRef.current.x
      const dy = e.touches[0].clientY - initialTouchPosRef.current.y
      setOffset({
        x: initialOffsetRef.current.x + dx,
        y: initialOffsetRef.current.y + dy,
      })
    } else if (e.touches.length === 2 && initialDistanceRef.current !== null) {
      const currentDistance = getDistance(e.touches[0], e.touches[1])
      const newScale =
        (currentDistance / initialDistanceRef.current) * lastScaleRef.current
      setScale(Math.min(Math.max(newScale, 1), 5))
    }
  }

  const handlePreviewTouchEnd = () => {
    initialDistanceRef.current = null
    setIsGesturing(false)
    if (scale <= 1.01) {
      setScale(1)
      setOffset({ x: 0, y: 0 })
    }
  }

  // [核心修复] 手势防冲突检测
  const handleTouchStart = (e: React.TouchEvent) => {
    // 检测按压的目标是否是一个可点击的互动元素（如单词、灯泡或按钮）
    const target = e.target as HTMLElement
    if (target.closest('.cursor-pointer, button, [role="button"]')) {
      startPos.current = { x: -1, y: -1 } // 标记无效滑动
      return
    }

    startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    touchStartTime.current = Date.now()
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startPos.current.x === -1) return // 之前已被标记为忽略

    const diffX = e.changedTouches[0].clientX - startPos.current.x
    const diffY = e.changedTouches[0].clientY - startPos.current.y
    const touchDuration = Date.now() - touchStartTime.current

    // 防误触：时间必须短（< 1000ms），位移必须足够长（> 70px）才算滑动
    if (touchDuration > 1000) return
    if (Math.abs(diffX) < 70 && Math.abs(diffY) < 70) return

    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > 70) diffX < 0 ? nextCard() : prevCard()
    } else {
      if (diffY < -70 && !activeComment.isOpCard) {
        if (
          isCardAtBottom ||
          (contentRef.current &&
            contentRef.current.scrollHeight <= contentRef.current.clientHeight)
        ) {
          goToChatRoom()
        }
      }
    }

    // 重置
    startPos.current = { x: -1, y: -1 }
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
      className={`h-full flex flex-col bg-[#FDFCFB] dark:bg-[#0B0A09] overflow-hidden select-none overscroll-x-none !overscroll-x-none relative transition-colors duration-500 ${isExiting ? 'opacity-0 scale-95' : 'opacity-100'}`}>
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="frost-overlay" />
        <div className="blob-pastel -top-20 -left-20 bg-[#FFEDD5] dark:bg-orange-500/20 opacity-60 dark:opacity-40" />
        <div className="blob-pastel top-1/4 -right-40 bg-[#FED7AA] dark:bg-red-500/10 opacity-60 dark:opacity-30" />
        <div className="blob-pastel -bottom-20 -left-20 bg-[#FFEDD5] dark:bg-orange-500/10 opacity-60 dark:opacity-30" />
        <div
          className="absolute inset-[-50%] bg-cover bg-center blur-[120px] opacity-40 dark:opacity-30 animate-pulse-slow"
          style={{ backgroundImage: `url("${imageUrl}")` }}
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

      {/* 文化注记弹层 UI */}
      <AnimatePresence>
        {viewingNote && (
          <div className="fixed inset-0 z-[150] flex items-end justify-center px-4 pb-10">
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
      </AnimatePresence>

      {/* 图片全屏预览 Overlay */}
      <AnimatePresence>
        {isImagePreviewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (scale === 1) setIsImagePreviewOpen(false)
              else {
                setScale(1)
                setOffset({ x: 0, y: 0 })
              }
            }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 overflow-hidden">
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: scale,
                x: offset.x,
                y: offset.y,
                opacity: 1,
              }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={
                isGesturing
                  ? { type: 'tween', duration: 0 }
                  : { type: 'spring', damping: 25, stiffness: 300 }
              }
              src={imageUrl}
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              style={{ touchAction: 'none' }}
              alt="Full Preview"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handlePreviewTouchStart}
              onTouchMove={handlePreviewTouchMove}
              onTouchEnd={handlePreviewTouchEnd}
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsImagePreviewOpen(false)
                setScale(1)
                setOffset({ x: 0, y: 0 })
              }}
              className="absolute top-10 right-10 text-white/50 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-4xl">close</span>
            </button>
            {scale > 1 && (
              <div className="absolute bottom-10 px-4 py-2 bg-white/10 backdrop-blur rounded-full text-white/60 text-[10px] font-bold uppercase tracking-widest">
                {scale.toFixed(1)}x Zoom
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-4 mt-12 h-56 relative z-50">
        <motion.div
          initial={{ y: -300, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => !hasVideo && setIsImagePreviewOpen(true)}
          className={`absolute inset-0 rounded-[2.5rem] border-2 border-white/40 dark:border-white/20 shadow-2xl overflow-hidden bg-gray-200 dark:bg-[#1C1C1E] ${!hasVideo ? 'cursor-zoom-in active:scale-[0.98]' : ''} transition-transform duration-200`}>
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
          <h1 className="text-white text-xl font-black leading-tight line-clamp-2 mt-1 pointer-events-auto">
            <InteractiveText
              text={post.titleEn || post.title_en || ''}
              contextSentence={post.titleEn || post.title_en || ''}
              externalOnClick={handleWordClick}
            />
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
          <span className="text-gray-500 dark:text-white/60 text-[10px] font-bold uppercase drop-shadow-sm">
            {activeComment?.isOpCard
              ? '原帖内容'
              : `顶级评论 ${currentIndex}/${comments.length - 1}`}
          </span>
          <div className="h-1 w-16 bg-white/30 dark:bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
            <div
              className="h-full bg-orange-500 transition-all duration-300 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
              style={{
                width: `${((currentIndex + 1) / Math.max(comments.length, 1)) * 100}%`,
              }}
            />
          </div>
        </div>

        <div
          className="relative w-full px-4 h-[52vh] overscroll-x-none !overscroll-x-none touch-pan-y !touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}>
          <div
            className={`absolute inset-x-4 top-0 bottom-0 flex flex-col overflow-hidden transition-all duration-300 shadow-2xl rounded-[2.5rem] border border-white/40 dark:border-white/10 ${animationClass} 
            bg-white/60 dark:bg-[#121212]/60 backdrop-blur-3xl overscroll-x-none !overscroll-x-none touch-pan-y !touch-pan-y`}>
            <div className="h-16 border-b border-gray-200/50 dark:border-white/5 flex items-center justify-between px-6 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full p-[2px] ${activeComment?.isOpCard ? 'bg-gray-200 dark:bg-white' : 'bg-gradient-to-tr from-orange-500 to-red-500'}`}>
                  <div className="w-full h-full rounded-full bg-white dark:bg-[#121212] flex items-center justify-center text-[10px] font-black">
                    {activeComment?.isOpCard
                      ? 'OP'
                      : activeComment?.author.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-gray-900 dark:text-white font-bold text-sm leading-tight">
                    {activeComment?.author}
                  </span>
                  {!activeComment?.isOpCard && (
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px] text-orange-500">
                          favorite
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 dark:text-white/60">
                          {activeComment.upvotes || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px] text-blue-400">
                          chat_bubble
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 dark:text-white/60">
                          {activeReplyCount} replies
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {!activeComment?.isOpCard && (
                <button
                  onClick={goToChatRoom}
                  className="w-10 h-10 rounded-full bg-gray-100/80 dark:bg-white/5 flex items-center justify-center active:scale-95 transition-all hover:bg-gray-200/80 dark:hover:bg-white/10">
                  <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-[20px]">
                    expand_less
                  </span>
                </button>
              )}
            </div>

            <div
              ref={contentRef}
              onScroll={handleCardScroll}
              className="flex-1 p-6 overflow-y-auto no-scrollbar scroll-smooth overscroll-x-none">
              <MessageBubble
                comment={activeComment}
                isUser={false}
                onWordClick={handleWordClick}
                showTranslation={true}
                onNoteClick={setViewingNote}
              />
              <div className="h-12" />
            </div>

            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-white/90 via-white/50 to-transparent dark:from-[#000000] dark:via-[#121212]/50 pointer-events-none flex flex-col justify-end pb-4">
              <div className="flex justify-center opacity-80">
                {activeComment?.isOpCard ? (
                  <div className="flex flex-col items-center animate-bounce-subtle">
                    <div className="flex items-center gap-1 text-gray-400 dark:text-white/60">
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        左滑看观点
                      </span>
                      <span className="material-symbols-outlined text-[14px]">
                        arrow_forward
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`flex flex-col items-center transition-all duration-300 ${isCardAtBottom ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-50'}`}>
                    {isCardAtBottom ? (
                      <>
                        <span className="material-symbols-outlined text-orange-500 text-[18px] animate-bounce">
                          keyboard_double_arrow_up
                        </span>
                        <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest mt-0.5">
                          上拉进入讨论
                        </span>
                      </>
                    ) : (
                      <span className="material-symbols-outlined text-gray-300 dark:text-white/30 text-[16px]">
                        keyboard_arrow_down
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="h-14 w-full relative z-40 overflow-hidden flex items-center bg-gray-100/30 dark:bg-white/5 backdrop-blur-md border-t border-white/20 dark:border-white/5 opacity-80">
        <div className="flex whitespace-nowrap animate-ticker items-center gap-10 px-8">
          {[1, 2, 3].map((v) => (
            <div key={v} className="flex items-center gap-12">
              <span className="text-[10px] font-black text-orange-500 dark:text-orange-300 tracking-[0.15em]">
                欢 迎 来 到 SCROLLISH · 如 果 遇 到 题 请 及 时 向 我 们 反 馈
                谢 谢！❤
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
