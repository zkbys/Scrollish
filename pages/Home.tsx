import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { useAppStore } from '../store/useAppStore'
import { supabase } from '../supabase'
import { Page } from '../types'

interface HomeProps {
  onNavigate: (page: Page) => void
  onPostSelect: (postId: string) => void
}

const Home: React.FC<HomeProps> = ({ onNavigate, onPostSelect }) => {
  const {
    posts,
    initFeed,
    refreshFeed,
    loadMore,
    isLoading,
    isLoadingMore,
    currentPostIndex,
    setCurrentPostIndex,
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<'following' | 'foryou'>('foryou')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 恢复滚动位置的防闪烁逻辑：初始时如果需要恢复位置，先隐藏内容
  const [isReady, setIsReady] = useState(() => {
    return !(posts.length > 0 && currentPostIndex > 0)
  })

  const [transitionPostId, setTransitionPostId] = useState<string | null>(null)
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartRef = useRef(0)

  // 使用 useLayoutEffect 在浏览器绘制前同步恢复滚动位置
  useLayoutEffect(() => {
    if (
      posts.length > 0 &&
      currentPostIndex > 0 &&
      scrollContainerRef.current
    ) {
      const container = scrollContainerRef.current
      const rowHeight = container.clientHeight || window.innerHeight
      container.scrollTop = currentPostIndex * rowHeight

      // 强制在下一帧显示，确保位置已校准
      requestAnimationFrame(() => {
        setIsReady(true)
      })
    } else {
      setIsReady(true)
    }
  }, [])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const rowHeight = container.clientHeight
    if (rowHeight === 0) return
    const newIndex = Math.round(container.scrollTop / rowHeight)
    if (newIndex !== currentPostIndex) {
      setCurrentPostIndex(newIndex)
    }
  }

  const handleOpenDiscussion = (postId: string) => {
    setTransitionPostId(postId)
    if (navigator.vibrate) navigator.vibrate(20)
    setTimeout(() => {
      onPostSelect(postId)
      setTimeout(() => setTransitionPostId(null), 100)
    }, 600)
  }

  const observer = useRef<IntersectionObserver>()
  const lastPostElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (isLoading || isLoadingMore) return
      if (observer.current) observer.current.disconnect()

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && activeTab === 'foryou') {
          loadMore()
        }
      })
      if (node) observer.current.observe(node)
    },
    [isLoading, isLoadingMore, loadMore, activeTab],
  )

  useEffect(() => {
    initFeed()
  }, [])

  const handleForYouClick = () => {
    if (activeTab === 'foryou') {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      setCurrentPostIndex(0)
      refreshFeed()
    } else {
      setActiveTab('foryou')
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollContainerRef.current?.scrollTop === 0) {
      touchStartRef.current = e.touches[0].clientY
    }
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    const touchY = e.touches[0].clientY
    const diff = touchY - touchStartRef.current
    if (scrollContainerRef.current?.scrollTop === 0 && diff > 0) {
      setPullY(Math.min(diff / 2.5, 120))
    }
  }
  const handleTouchEnd = async () => {
    if (pullY > 80) {
      setIsRefreshing(true)
      setPullY(80)
      await refreshFeed()
      setIsRefreshing(false)
    }
    setPullY(0)
    touchStartRef.current = 0
  }

  if (posts.length === 0 && isLoading && !isRefreshing) {
    return (
      <div className="h-full w-full bg-[#0B0A09] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div
      className={`relative h-full w-full bg-[#0B0A09] overflow-hidden transition-colors duration-500 ${transitionPostId ? 'bg-black' : ''}`}>
      <header
        className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-5 pt-12 pb-8 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none transition-all duration-300 ease-apple ${transitionPostId ? 'opacity-0 -translate-y-10' : 'opacity-100 translate-y-0'}`}>
        <button className="pointer-events-auto text-white/90 h-9 w-9 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-full active:scale-90 transition-transform border border-white/5">
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>

        <div className="flex gap-6 pointer-events-auto items-center">
          <button
            onClick={() => setActiveTab('following')}
            className={`text-[16px] font-bold transition-colors drop-shadow-md ${activeTab === 'following' ? 'text-white' : 'text-white/60'}`}>
            Following
          </button>
          <div className="h-4 w-[1px] bg-white/20"></div>
          <button
            onClick={handleForYouClick}
            className={`text-[16px] font-bold transition-colors relative drop-shadow-md flex items-center gap-1 ${activeTab === 'foryou' ? 'text-white' : 'text-white/60'}`}>
            For You
            {isLoading && activeTab === 'foryou' && (
              <span className="w-2.5 h-2.5 border-[1.5px] border-white/30 border-t-white rounded-full animate-spin absolute -right-4 top-1.5"></span>
            )}
            {activeTab === 'foryou' && !isLoading && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-[3px] bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.8)]" />
            )}
          </button>
        </div>

        <button className="pointer-events-auto text-white/90 h-9 w-9 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-full active:scale-90 transition-transform border border-white/5">
          <span className="material-symbols-outlined text-[20px]">search</span>
        </button>
      </header>

      <div
        className="absolute top-12 left-0 right-0 z-40 flex justify-center transition-transform duration-300 pointer-events-none"
        style={{ transform: `translateY(${pullY - 40}px)` }}>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${isRefreshing ? 'bg-white opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          {isRefreshing && (
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        // isReady 控制透明度，实现无缝衔接
        className={`h-full overflow-y-auto snap-y snap-mandatory no-scrollbar pb-0 transition-transform duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateY(${pullY > 0 ? pullY / 3 : 0}px)` }}>
        {posts.map((post, index) => {
          const isTriggerPoint = index === posts.length - 3

          return (
            <div
              key={`${post.id}-${index}`}
              ref={isTriggerPoint ? lastPostElementRef : null}
              className="h-full w-full snap-start relative"
              style={{ scrollSnapStop: 'always' }}>
              <FeedItem
                post={post}
                onOpenDiscussion={() => handleOpenDiscussion(post.id)}
                isExiting={transitionPostId === post.id}
              />
            </div>
          )
        })}

        {posts.length > 0 && (
          <div
            className="h-20 w-full flex items-center justify-center snap-start bg-black/50"
            style={{ scrollSnapStop: 'always' }}>
            {isLoadingMore ? (
              <div className="flex items-center gap-2 text-white/50 text-xs font-bold uppercase tracking-widest">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Loading More...
              </div>
            ) : (
              <div className="text-white/20 text-[10px]">- End of Feed -</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 单个帖子组件
const FeedItem: React.FC<{
  post: any
  onOpenDiscussion: () => void
  isExiting: boolean
}> = ({ post, onOpenDiscussion, isExiting }) => {
  const [likes, setLikes] = useState(post.upvotes || post.likes || 0)
  const [isLiked, setIsLiked] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // 视频错误状态
  const [videoError, setVideoError] = useState(false)

  const titleEn = post.title_en || post.titleEn || ''
  const titleCn = post.title_cn || post.titleZh || ''
  const imageUrl = post.image_url || post.image || ''
  const videoUrl = post.video_url || ''
  const subreddit = post.subreddit || 'Community'
  const commentCount = post.comments || 'Discuss'

  // 必须有 URL 且没有报错才渲染视频
  const hasVideo = !!videoUrl && !videoError

  // 强制播放逻辑
  useEffect(() => {
    if (hasVideo && videoRef.current && !isExiting) {
      const attemptPlay = async () => {
        try {
          videoRef.current!.muted = true
          await videoRef.current!.play()
        } catch (e) {
          console.log('Playback prevented:', e)
        }
      }
      attemptPlay()
    }
  }, [hasVideo, isExiting])

  const handleLike = async () => {
    if (isExiting) return
    const isCurrentlyLiked = isLiked
    const newCount = isCurrentlyLiked ? likes - 1 : likes + 1
    setLikes(newCount)
    setIsLiked(!isCurrentlyLiked)
    if (navigator.vibrate) navigator.vibrate(50)
    try {
      await supabase
        .from('production_posts')
        .update({ upvotes: newCount })
        .eq('id', post.id)
    } catch (error) {
      console.error('Like update failed', error)
      setLikes(likes)
      setIsLiked(isCurrentlyLiked)
    }
  }

  const handleShare = async () => {
    if (isExiting) return
    if (navigator.share) {
      navigator.share({
        title: titleEn,
        text: titleCn,
        url: window.location.href,
      })
    }
  }

  return (
    <div className="h-full w-full bg-[#0B0A09] perspective-container">
      <div
        className={`relative overflow-hidden bg-[#121212] origin-top transition-all duration-[600ms] ease-apple will-change-transform ${
          isExiting
            ? 'fixed z-[100] top-12 left-4 right-4 h-56 rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] translate-y-0 [transform:rotateX(2deg)] brightness-90'
            : 'h-full w-full rounded-none translate-y-0 [transform:rotateX(0deg)] brightness-100'
        }`}>
        <div
          className="absolute inset-0 h-full w-full overflow-hidden"
          onClick={() => {
            if (!isExiting && hasVideo && videoRef.current) {
              videoRef.current.paused
                ? videoRef.current.play()
                : videoRef.current.pause()
            }
          }}>
          {hasVideo ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="h-full w-full object-cover"
              loop
              muted
              playsInline
              // 兼容 iOS/国产浏览器
              {...{ 'webkit-playsinline': 'true' }}
              autoPlay
              // 加载失败时切换回图片
              onError={() => {
                console.log('Video load failed, fallback to image')
                setVideoError(true)
              }}
            />
          ) : (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center blur-3xl scale-125 opacity-80"
                style={{ backgroundImage: `url("${imageUrl}")` }}
              />
              <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
              <img
                src={imageUrl}
                alt="Content"
                className="absolute inset-0 w-full h-full object-contain object-[center_35%] z-10 drop-shadow-2xl"
              />
            </>
          )}
          <div
            className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none z-20 transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
          />
        </div>

        <div
          className={`absolute inset-0 z-30 transition-all ${isExiting ? 'pointer-events-none' : ''}`}
          onDoubleClick={handleLike}
        />

        <div
          className={`absolute inset-0 z-40 pointer-events-none transition-all duration-200 ease-out ${isExiting ? 'opacity-0 translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'}`}>
          <div className="absolute bottom-0 left-0 w-[82%] p-5 pb-24">
            <div className="flex items-center gap-2 mb-3 pointer-events-auto">
              <div className="w-10 h-10 rounded-full border border-white/20 bg-black/40 backdrop-blur-md flex items-center justify-center overflow-hidden">
                <span className="text-white font-black text-sm">
                  {subreddit.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col drop-shadow-md">
                <span className="text-white font-bold text-[15px] leading-tight">
                  r/{subreddit}
                </span>
                {post.image_type === 'generated' && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[10px] text-primary">
                      auto_awesome
                    </span>
                    <span className="text-primary text-[10px] font-bold">
                      AI Illustration
                    </span>
                  </div>
                )}
              </div>
              <button className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold px-3 py-1.5 rounded-full ml-2 transition-all active:scale-95 pointer-events-auto">
                Subscribe
              </button>
            </div>
            <div className="pointer-events-auto mb-2 space-y-1">
              <h1 className="text-white text-[18px] font-black leading-snug drop-shadow-lg pr-4">
                {titleEn}
              </h1>
              <p className="text-white/80 text-[15px] font-medium leading-snug drop-shadow-md line-clamp-3 pr-4">
                {titleCn}
              </p>
            </div>
          </div>

          <div className="absolute bottom-24 right-2 flex flex-col items-center gap-6 pointer-events-auto w-14">
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleLike}
                className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-90">
                <span
                  className={`material-symbols-outlined text-[30px] transition-colors ${isLiked ? 'text-[#ff2d55] fill-[1]' : 'text-white'}`}>
                  favorite
                </span>
              </button>
              <span className="text-white text-[12px] font-bold drop-shadow-md">
                {likes}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={onOpenDiscussion}
                className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-90 hover:bg-white/20">
                <span className="material-symbols-outlined text-[28px] text-white fill-[1]">
                  mode_comment
                </span>
              </button>
              <span className="text-white text-[12px] font-bold drop-shadow-md">
                {commentCount}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleShare}
                className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-90 hover:bg-white/20">
                <span className="material-symbols-outlined text-[28px] text-white transform -rotate-12">
                  reply
                </span>
              </button>
              <span className="text-white text-[12px] font-bold drop-shadow-md">
                Share
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
