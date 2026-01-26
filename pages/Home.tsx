import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { useAppStore, ProductionPost } from '../store/useAppStore'
import { useUserStore } from '../store/useUserStore'
import { supabase } from '../supabase'
import { Page, Post } from '../types' // 引入 Post 类型
import { IMAGES } from '../constants'

interface HomeProps {
  onNavigate: (page: Page) => void
  onPostSelect: (post: Post) => void
  filteredCommunityId?: string | null
  onClearFilter?: () => void
  initialTab?: 'following' | 'foryou'
}

const Home: React.FC<HomeProps> = ({
  onNavigate,
  onPostSelect,
  filteredCommunityId,
  onClearFilter,
  initialTab = 'foryou'
}) => {
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

  const { followedCommunities } = useUserStore()
  const [activeTab, setActiveTab] = useState<'following' | 'foryou'>(initialTab)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const [isReady, setIsReady] = useState(() => {
    return !(posts.length > 0 && currentPostIndex > 0)
  })

  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartRef = useRef(0)

  // 构造当前的过滤器参数
  const getFilters = useCallback(() => {
    if (activeTab === 'following') {
      return { followedIds: followedCommunities }
    }
    if (filteredCommunityId) {
      return { communityId: filteredCommunityId }
    }
    return {}
  }, [activeTab, followedCommunities, filteredCommunityId])

  // 切换标签或关注列表变化时，重新请求
  useEffect(() => {
    initFeed(getFilters())
  }, [activeTab, filteredCommunityId, followedCommunities.length])

  // 同步恢复滚动位置
  useLayoutEffect(() => {
    if (
      posts.length > 0 &&
      currentPostIndex > 0 &&
      scrollContainerRef.current
    ) {
      const container = scrollContainerRef.current
      const rowHeight = container.clientHeight || window.innerHeight
      container.scrollTop = currentPostIndex * rowHeight
      setIsReady(true)
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

  const observer = useRef<IntersectionObserver>()
  const lastPostElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (isLoading || isLoadingMore) return
      if (observer.current) observer.current.disconnect()

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          loadMore(getFilters())
        }
      })
      if (node) observer.current.observe(node)
    },
    [isLoading, isLoadingMore, loadMore, getFilters],
  )

  const handleForYouClick = () => {
    if (activeTab === 'foryou') {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      setCurrentPostIndex(0)
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
      await refreshFeed(getFilters())
      setIsRefreshing(false)
    }
    setPullY(0)
    touchStartRef.current = 0
  }

  // 处理从 Home 点击进入详情
  const handleOpenDiscussion = (prodPost: any) => {
    if (navigator.vibrate) navigator.vibrate(20)

    const mappedPost: Post = {
      id: prodPost.id,
      user: prodPost.subreddit || 'Anonymous',
      avatar: IMAGES.avatar1,
      titleEn: prodPost.title_en,
      titleZh: prodPost.title_cn || '',
      hashtags: [],
      image: prodPost.image_url,
      videoUrl: prodPost.video_url || null,
      likes: prodPost.upvotes?.toString() || '0',
      stars: '0',
      comments: 0,
      image_type: prodPost.image_type,
      subreddit: prodPost.subreddit,
    }

    // [关键改动] 不再需要 600ms 的手动延时，直接利用 framer-motion 的 layoutId 进行转场
    onPostSelect(mappedPost)
  }

  // 渲染空状态 (针对 Following 标签)
  const renderEmptyState = () => {
    if (activeTab === 'following' && followedCommunities.length === 0) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl text-white/20">explore</span>
          </div>
          <h2 className="text-xl font-black text-white mb-2">Following is empty</h2>
          <p className="text-sm text-white/40 font-medium mb-8">
            You haven't followed any communities yet. Go to Discovery to find communities you like!
          </p>
          <button
            onClick={() => onNavigate(Page.Explore)}
            className="px-8 py-3 bg-primary text-white font-black rounded-full active:scale-95 transition-transform shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]"
          >
            Go to Discovery
          </button>
        </div>
      )
    }

    if (posts.length === 0 && !isLoading) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-10 text-center">
          <p className="text-white/20 font-bold uppercase tracking-widest text-xs">- No posts found -</p>
          {filteredCommunityId && (
            <button
              onClick={onClearFilter}
              className="mt-4 text-primary text-xs font-black uppercase tracking-widest"
            >
              Clear Filter
            </button>
          )}
        </div>
      )
    }

    return null
  }

  if (posts.length === 0 && isLoading && !isRefreshing) {
    return (
      <div className="h-full w-full bg-[#0B0A09] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full bg-[#0B0A09] overflow-hidden">

      {/* 社区过滤状态显示 */}
      {filteredCommunityId && activeTab === 'foryou' && (
        <div className="absolute top-[100px] left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/20 backdrop-blur-md border border-primary/30 rounded-full">
            <span className="text-[10px] font-black text-primary uppercase tracking-wider">r/{posts[0]?.subreddit || 'Filtered'}</span>
            <button onClick={onClearFilter} className="flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      )}

      <header
        className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-5 pt-12 pb-8 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none transition-all duration-300 ease-apple">
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

        <button
          onClick={() => onNavigate(Page.Explore)}
          className="pointer-events-auto text-white/90 h-9 w-9 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-full active:scale-90 transition-transform border border-white/5">
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

      {renderEmptyState() || (
        <div
          ref={scrollContainerRef}
          className={`h-full overflow-y-auto snap-y snap-mandatory no-scrollbar pb-0 ${isReady ? 'opacity-100' : 'opacity-0'}`}
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
                  onOpenDiscussion={() => handleOpenDiscussion(post)}
                  isExiting={false}
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
      )}
    </div>
  )
}

import { motion } from 'framer-motion'

// --- FeedItem 组件 (已集成 Shared Element Transition) ---
export const FeedItem: React.FC<{
  post: any
  onOpenDiscussion: () => void
  isExiting: boolean
  onBack?: () => void
}> = ({ post, onOpenDiscussion, isExiting, onBack }) => {
  const { toggleLike, isLiked: checkIsLiked, toggleFollowCommunity, isFollowing } = useUserStore()
  const isLiked = checkIsLiked(post.id)
  const isSubscribed = post.community_id ? isFollowing(post.community_id) : false

  const handleToggleSub = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (post.community_id) {
      toggleFollowCommunity(post.community_id)
      if (navigator.vibrate) navigator.vibrate(50)
    }
  }

  // [修复Bug] 兼容两种数据格式：
  // 1. upvotes (Home页的 ProductionPost)
  // 2. likes (Profile页传递过来的 Post，是 string)
  const initialLikes =
    typeof post.upvotes === 'number' ? post.upvotes : parseInt(post.likes) || 0

  const [likes, setLikes] = useState(initialLikes)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoError, setVideoError] = useState(false)

  const titleEn = post.title_en || post.titleEn || ''
  const titleCn = post.title_cn || post.titleZh || ''
  const imageUrl = post.image_url || post.image || ''
  const videoUrl = post.videoUrl || post.video_url || ''
  const subreddit = post.subreddit || 'Community'
  const commentCount = post.comments || 'Discuss'

  const hasVideo = !!videoUrl && !videoError

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
    toggleLike(post)
    if (navigator.vibrate) navigator.vibrate(50)

    // 更新本地显示
    if (isLiked) {
      setLikes((prev) => Math.max(0, prev - 1))
    } else {
      setLikes((prev) => prev + 1)
    }

    try {
      const newCount = isLiked ? likes - 1 : likes + 1
      await supabase
        .from('production_posts')
        .update({ upvotes: newCount })
        .eq('id', post.id)
    } catch (error) {
      console.error('Like update failed', error)
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
    <div className="h-full w-full bg-[#0B0A09] relative">
      <motion.div
        layoutId={`post-card-${post.id}`}
        transition={{
          type: "spring",
          stiffness: 70, // 配合镜头降落的优雅慢速
          damping: 20,
        }}
        className="relative h-full w-full overflow-hidden bg-[#121212] rounded-none shadow-none z-[100] brightness-100"
      >
        {/* 返回按钮 (Preview模式) */}
        {onBack && !isExiting && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onBack()
            }}
            className="absolute top-12 left-5 z-[60] w-10 h-10 flex items-center justify-center bg-black/20 backdrop-blur-md rounded-full border border-white/10 text-white">
            <span className="material-symbols-outlined text-[24px]">
              arrow_back
            </span>
          </button>
        )}

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
              {...{ 'webkit-playsinline': 'true' }}
              autoPlay
              onError={() => {
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
              <motion.img
                layoutId={`post-image-${post.id}`}
                src={imageUrl}
                alt="Content"
                className="absolute inset-0 w-full h-full object-contain object-center z-10 drop-shadow-2xl will-change-transform"
                transition={{
                  type: "spring",
                  stiffness: 70,
                  damping: 20,
                }}
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
              <button
                onClick={handleToggleSub}
                className={`backdrop-blur-md border text-[10px] font-bold px-3 py-1.5 rounded-full ml-2 transition-all active:scale-95 pointer-events-auto ${isSubscribed
                  ? 'bg-primary/20 border-primary/30 text-primary'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                  }`}
              >
                {isSubscribed ? 'Following' : 'Subscribe'}
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
      </motion.div>
    </div>
  )
}

export default Home
