import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore, ProductionPost } from '../store/useAppStore'
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

  // 下拉刷新相关
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartRef = useRef(0)

  // --- 1. 自动恢复滚动位置 ---
  useEffect(() => {
    setTimeout(() => {
      if (
        scrollContainerRef.current &&
        posts.length > 0 &&
        currentPostIndex > 0
      ) {
        const container = scrollContainerRef.current
        const rowHeight = container.clientHeight || window.innerHeight

        container.scrollTo({
          top: currentPostIndex * rowHeight,
          behavior: 'auto',
        })
      }
    }, 0)
  }, [])

  // --- 2. 监听滚动 ---
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const rowHeight = container.clientHeight
    if (rowHeight === 0) return

    const newIndex = Math.round(container.scrollTop / rowHeight)
    if (newIndex !== currentPostIndex) {
      setCurrentPostIndex(newIndex)
    }
  }

  // --- 无限加载观察者 ---
  const observer = useRef<IntersectionObserver>()
  const lastPostElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (isLoading || isLoadingMore) return
      if (observer.current) observer.current.disconnect()

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && activeTab === 'foryou') {
          console.log('Trigger point reached, calling loadMore()...')
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

  // --- 点击 Tab 逻辑 ---
  const handleForYouClick = () => {
    if (activeTab === 'foryou') {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      setCurrentPostIndex(0)
      refreshFeed()
    } else {
      setActiveTab('foryou')
    }
  }

  // --- 下拉刷新手势逻辑 ---
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

  // 全屏 Loading (仅首次)
  if (posts.length === 0 && isLoading && !isRefreshing) {
    return (
      <div className="h-full w-full bg-[#0B0A09] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full bg-[#0B0A09] overflow-hidden">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-5 pt-12 pb-8 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
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

      {/* 下拉刷新指示器 (修改：移除了 arrow_downward，只在刷新时显示 Spinner) */}
      <div
        className="absolute top-12 left-0 right-0 z-40 flex justify-center transition-transform duration-300 pointer-events-none"
        style={{ transform: `translateY(${pullY - 40}px)` }}>
        {/* 只有 isRefreshing 为 true 时，才显示白底圆圈和Loading，平时下拉是空的（或者你可以只保留圆圈不显示图标） */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${isRefreshing ? 'bg-white opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          {isRefreshing && (
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
          )}
        </div>
      </div>

      {/* 核心滚动容器 */}
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar pb-0 transition-transform duration-300"
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
              // [关键修改] 强制每次只滑一页 (Scroll Snap Stop)
              // 注意：snap-stop 是 CSS 属性，Tailwind 可能需要 arbitrary value 或 style
              style={{ scrollSnapStop: 'always' }}>
              <FeedItem
                post={post}
                onOpenDiscussion={() => onPostSelect(post.id)}
              />
            </div>
          )
        })}

        {/* 底部加载更多指示器 */}
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

// --- FeedItem 组件 (保持不变) ---
const FeedItem: React.FC<{
  post: ProductionPost
  onOpenDiscussion: () => void
}> = ({ post, onOpenDiscussion }) => {
  const [likes, setLikes] = useState(post.upvotes || 0)
  const [isLiked, setIsLiked] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasVideo = !!post.video_url

  const handleLike = async () => {
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
    if (navigator.share) {
      navigator.share({
        title: post.title_en,
        text: post.title_cn,
        url: window.location.href,
      })
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#121212]">
      <div
        className="absolute inset-0 h-full w-full overflow-hidden"
        onClick={() => {
          if (hasVideo && videoRef.current) {
            videoRef.current.paused
              ? videoRef.current.play()
              : videoRef.current.pause()
          }
        }}>
        {hasVideo ? (
          <video
            ref={videoRef}
            src={post.video_url!}
            className="h-full w-full object-cover"
            loop
            muted
            playsInline
            autoPlay
          />
        ) : (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center blur-3xl scale-125 opacity-80"
              style={{ backgroundImage: `url("${post.image_url}")` }}
            />
            <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
            <img
              src={post.image_url}
              alt="Content"
              className="absolute inset-0 w-full h-full object-contain z-10 drop-shadow-2xl"
            />
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none z-20" />
      </div>

      <div className="absolute inset-0 z-30" onDoubleClick={handleLike} />

      <div className="absolute bottom-0 left-0 w-[82%] z-40 p-5 pb-24 pointer-events-none">
        <div className="flex items-center gap-2 mb-3 pointer-events-auto">
          <div className="w-10 h-10 rounded-full border border-white/20 bg-black/40 backdrop-blur-md flex items-center justify-center overflow-hidden">
            <span className="text-white font-black text-sm">
              {post.subreddit
                ? post.subreddit.substring(0, 2).toUpperCase()
                : 'RD'}
            </span>
          </div>
          <div className="flex flex-col drop-shadow-md">
            <span className="text-white font-bold text-[15px] leading-tight">
              r/{post.subreddit}
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
          <button className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold px-3 py-1.5 rounded-full ml-2 transition-all active:scale-95">
            Subscribe
          </button>
        </div>
        <div className="pointer-events-auto mb-2 space-y-1">
          <h1 className="text-white text-[18px] font-black leading-snug drop-shadow-lg pr-4">
            {post.title_en}
          </h1>
          <p className="text-white/80 text-[15px] font-medium leading-snug drop-shadow-md line-clamp-3 pr-4">
            {post.title_cn}
          </p>
        </div>
      </div>

      <div className="absolute bottom-24 right-2 flex flex-col items-center gap-6 z-50 pointer-events-auto w-14">
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
            Discuss
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
  )
}

export default Home
