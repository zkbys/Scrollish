import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import { Page } from '../types'
import { useCommentStore } from '../store/useCommentStore'
import { useDictionaryStore } from '../store/useDictionaryStore'
import WordDetailOverlay from '../components/WordDetailOverlay'
import { useVocabularyStore } from '../store/useVocabularyStore'
import { Comment, CulturalNote } from '../types'
import InteractiveText from '../components/InteractiveText'
import TopicHubHeader from '../components/TopicHubHeader'
import TopicCard from '../components/TopicCard'
import ImagePreviewOverlay from '../components/ImagePreviewOverlay'
import CulturalNoteOverlay from '../components/CulturalNoteOverlay'
import { useTopicHubGestures } from '../hooks/useTopicHubGestures'
import SpeakingAvatarOverlay from '../components/SpeakingAvatarOverlay'

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

  const initialDistanceRef = useRef<number | null>(null)
  const lastScaleRef = useRef(1)
  const lastTapRef = useRef(0)
  const initialTouchPosRef = useRef({ x: 0, y: 0 })
  const initialOffsetRef = useRef({ x: 0, y: 0 })
  const contentRef = useRef<HTMLDivElement>(null)
  const hasRestoredPosition = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const { fetchComments, comments: allCommentsMap, isLoading } = useCommentStore()
  const { getDefinition, triggerAnalysis } = useDictionaryStore()

  useEffect(() => {
    setIsCardAtBottom(false)
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [currentIndex])

  // [修复] 当切换帖子时，重置索引和状态，防止导航失效
  useEffect(() => {
    setCurrentIndex(0)
    setOpContent(null)
    setAnimationClass('')
    hasRestoredPosition.current = false
  }, [post?.id])

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
  }, [post?.id, fetchComments])

  const allComments = useMemo(() => (post?.id ? allCommentsMap[post.id] : []) || [], [post?.id, allCommentsMap])
  const comments = useMemo(() => {
    if (!post) return []
    const opCard = {
      id: 'op-card-0',
      isOpCard: true,
      author: post.author || post.subreddit || post.user || 'OP', // 兼容 user 字段
      content: opContent?.en || post.content_en || post.title_en || post.titleEn || 'Loading...',
      content_cn: opContent?.cn || post.content_cn || post.title_cn || post.titleZh || '',
      upvotes: post.upvotes || post.likes || 0,
      enrichment: {
        sentence_segments: opContent?.sentence_segments || post.sentence_segments,
        cultural_notes: opContent?.cultural_notes || post.cultural_notes || [],
      },
    }
    const topLevel = allComments
      .filter((c) => c.depth === 0)
      .sort((a, b) => b.upvotes - a.upvotes)

    if (topLevel.length === 0 && post.id && isLoading[post.id]) return [opCard]
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
    if (!activeComment || activeComment.isOpCard) return 0
    return countDescendants(activeComment.id, allComments)
  }, [allComments, activeComment])

  useEffect(() => {
    if (hasVideo && videoRef.current) {
      videoRef.current.muted = true
      videoRef.current.play().catch(() => { })
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
      useVocabularyStore.getState().registerWordLookup(result, context)
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

  const { handleTouchStart, handleTouchEnd } = useTopicHubGestures({
    onNext: nextCard,
    onPrev: prevCard,
    onDiscussion: goToChatRoom,
    isOpCard: !!activeComment?.isOpCard,
    isCardAtBottom,
    contentRef,
  })

  if (!post || comments.length === 0) {
    return <div className="h-full w-full bg-[#0B0A09] flex items-center justify-center text-white/50">Loading post...</div>
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

      <AnimatePresence>
        {viewingNote && (
          <CulturalNoteOverlay
            notes={viewingNote}
            onClose={() => setViewingNote(null)}
          />
        )}
      </AnimatePresence>

      <ImagePreviewOverlay
        isOpen={isImagePreviewOpen}
        imageUrl={imageUrl}
        scale={scale}
        offset={offset}
        isGesturing={isGesturing}
        onClose={() => setIsImagePreviewOpen(false)}
        onScaleChange={setScale}
        onOffsetChange={setOffset}
        onIsGesturingChange={setIsGesturing}
        onTouchStart={handlePreviewTouchStart}
        onTouchMove={handlePreviewTouchMove}
        onTouchEnd={handlePreviewTouchEnd}
      />

      <div className="mx-4 mt-12 h-56 relative z-50">
        <div
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
        </div>

        <TopicHubHeader onBack={handleBack} subreddit={post.subreddit} />

        <div className="absolute inset-x-0 bottom-0 p-6 z-[70] pointer-events-none">
          <h1 className="text-white text-xl font-black leading-tight line-clamp-2 mt-1 pointer-events-auto">
            <InteractiveText
              text={post.titleEn || post.title_en || ''}
              contextSentence={post.titleEn || post.title_en || ''}
              externalOnClick={handleWordClick}
            />
          </h1>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-start pt-6 z-40">
        <div className="w-full px-8 flex justify-between items-center mb-4">
          <span className="text-gray-500 dark:text-white/60 text-[10px] font-bold uppercase drop-shadow-sm">
            {activeComment?.isOpCard
              ? '原帖内容'
              : `顶级评论 ${currentIndex}/${comments.length - 1}`}
            {post?.id && isLoading[post.id] && comments.length === 1 && ' (Loading...)'}
          </span>
          <div className="h-1 w-16 bg-white/30 dark:bg-white/10 rounded-full overflow-hidden backdrop-blur-sm relative">
            <div
              className={`h-full bg-orange-500 transition-all duration-300 shadow-[0_0_10px_rgba(249,115,22,0.5)] ${post?.id && isLoading[post.id] ? 'animate-pulse opacity-70' : ''}`}
              style={{
                width: post?.id && isLoading[post.id] && comments.length === 1
                  ? '15%'
                  : `${((currentIndex + 1) / Math.max(comments.length, 1)) * 100}%`,
              }}
            />
          </div>
        </div>

        <TopicCard
          activeComment={activeComment}
          activeReplyCount={activeReplyCount}
          currentIndex={currentIndex}
          totalComments={comments.length}
          animationClass={animationClass}
          isCardAtBottom={isCardAtBottom}
          contentRef={contentRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onCardScroll={handleCardScroll}
          onWordClick={handleWordClick}
          onNoteClick={setViewingNote}
          onGoToChatRoom={goToChatRoom}
        />
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
      <SpeakingAvatarOverlay />
    </div>
  )
}

export default TopicHub
