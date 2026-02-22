import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/useAppStore'
import { useUserStore } from '../store/useUserStore'
import { useAnalyticsStore } from '../store/useAnalyticsStore'
import { supabase } from '../supabase'
import { Page, Post } from '../types'
import { IMAGES } from '../constants'
import {
  STAGGER_CONTAINER,
  STAGGER_ITEM,
  BUTTON_SPRING,
  SPRING_GENTLE,
} from '../motion'
import JellyLikeButton from '../components/JellyLikeButton'
import JellyCommentButton from '../components/JellyCommentButton'
import JellyFollowButton from '../components/JellyFollowButton'

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
  initialTab = 'foryou',
}) => {
  const {
    posts,
    isLoading,
    isLoadingMore,
    currentPostIndex,
    homeActiveTab,
    isRestoring,
    lastLoadTime,
    initFeed,
    loadMore,
    refreshFeed,
    setCurrentPostIndex,
    setHomeActiveTab,
  } = useAppStore()

  const { followedCommunities } = useUserStore()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const [isReady, setIsReady] = useState(false)
  const [pullY, setPullY] = useState(0)
  const [pushY, setPushY] = useState(0)
  const [isTouching, setIsTouching] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const touchStartRef = useRef(0)

  const getFilters = useCallback(() => {
    if (homeActiveTab === 'following') {
      return { followedIds: followedCommunities }
    }
    if (filteredCommunityId) {
      return { communityId: filteredCommunityId }
    }
    return {}
  }, [homeActiveTab, followedCommunities, filteredCommunityId])

  useEffect(() => {
    initFeed(getFilters())
  }, [homeActiveTab, filteredCommunityId, followedCommunities.length])

  useLayoutEffect(() => {
    const container = scrollContainerRef.current
    if (!container) {
      setIsReady(true)
      return
    }

    const restoreScroll = () => {
      if (posts.length > 0 && currentPostIndex > 0) {
        const rowHeight = container.clientHeight
        if (rowHeight > 0) {
          container.scrollTo({
            top: currentPostIndex * rowHeight,
            behavior: 'auto',
          })

          if (
            Math.abs(container.scrollTop - currentPostIndex * rowHeight) > 5
          ) {
            container.scrollTo({
              top: currentPostIndex * rowHeight,
              behavior: 'auto',
            })
          }
          requestAnimationFrame(() => setIsReady(true))
        } else {
          requestAnimationFrame(restoreScroll)
        }
      } else {
        setIsReady(true)
      }
    }

    restoreScroll()
  }, [])

  useEffect(() => {
    if (isReady && posts.length > 0) {
      const currentPost = posts[currentPostIndex]
      if (currentPost) {
        useUserStore.getState().addViewHistory(currentPost)
      }
    }
  }, [isReady, posts.length, currentPostIndex])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isRestoring || !isReady) return

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

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadMore(getFilters())
          }
        },
        {
          rootMargin: '150% 0px',
        },
      )
      if (node) observer.current.observe(node)
    },
    [isLoading, isLoadingMore, loadMore, getFilters],
  )

  const handleForYouClick = () => {
    if (homeActiveTab !== 'foryou') {
      setHomeActiveTab('foryou')
      setCurrentPostIndex(0)
      scrollContainerRef.current?.scrollTo({ top: 0 })
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      const diff = 5000 - (now - lastLoadTime)
      if (diff > 0) {
        setCooldownRemaining(Math.ceil(diff / 1000))
      } else {
        setCooldownRemaining(0)
      }
    }, 500)
    return () => clearInterval(timer)
  }, [lastLoadTime])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setPullY(80)
    await refreshFeed(getFilters())
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    setIsRefreshing(false)
    setPullY(0)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientY
    setIsTouching(true)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY
    const startY = touchStartRef.current
    const deltaY = currentY - startY
    const container = scrollContainerRef.current
    if (!container) return

    if (container.scrollTop <= 0 && deltaY > 0) {
      setPullY(Math.min(deltaY * 0.5, 80))
      setPushY(0)
    } else if (
      container.scrollTop + container.clientHeight >=
        container.scrollHeight - 5 &&
      deltaY < 0
    ) {
      setPushY(Math.min(Math.abs(deltaY) * 0.5, 80))
      setPullY(0)
    } else {
      setPullY(0)
      setPushY(0)
    }
  }

  const handleTouchEnd = () => {
    setIsTouching(false)
    if (pullY > 60 && !isLoading) {
      handleRefresh()
    }
    setPullY(0)
    setPushY(0)
    touchStartRef.current = 0
  }

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
      comments: prodPost.comments || prodPost.comment_count || 0,
      image_type: prodPost.image_type,
      subreddit: prodPost.subreddit,
    }
    onPostSelect(mappedPost)
  }

  const renderEmptyState = () => {
    if (homeActiveTab === 'following' && followedCommunities.length === 0) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-white/5 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl text-gray-400 dark:text-white/20">
              explore
            </span>
          </div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">
            Following is empty
          </h2>
          <p className="text-sm text-gray-500 dark:text-white/40 font-medium mb-8">
            You haven't followed any communities yet.
          </p>
          <button
            onClick={() => onNavigate(Page.Explore)}
            className="px-8 py-3 bg-primary text-white font-black rounded-full active:scale-95 transition-transform shadow-lg shadow-primary/30">
            Go to Discovery
          </button>
        </div>
      )
    }

    if (posts.length === 0 && !isLoading) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-10 text-center">
          <p className="text-gray-400 dark:text-white/20 font-bold uppercase tracking-widest text-xs">
            - No posts found -
          </p>
          {filteredCommunityId && (
            <button
              onClick={onClearFilter}
              className="mt-4 text-primary text-xs font-black uppercase tracking-widest">
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
      <div className="h-full w-full bg-gray-50 dark:bg-[#0B0A09] flex flex-col items-center justify-center transition-colors duration-300">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full bg-background-light dark:bg-background-dark overflow-hidden transition-colors duration-300">
      {filteredCommunityId && homeActiveTab === 'foryou' && (
        <div className="absolute top-[100px] left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/20 backdrop-blur-md border border-primary/30 rounded-full">
            <span className="text-[10px] font-black text-primary uppercase tracking-wider">
              r/{posts[0]?.subreddit || 'Filtered'}
            </span>
            <button
              onClick={onClearFilter}
              className="flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[16px]">
                close
              </span>
            </button>
          </div>
        </div>
      )}

      <header
        className="absolute top-0 left-0 right-0 z-50 flex flex-col items-center px-5 bg-gradient-to-b from-black/80 via-black/20 to-transparent pointer-events-none transition-all duration-500"
        style={{
          paddingTop:
            'calc(max(0.75rem, env(safe-area-inset-top)) + clamp(0.4rem, 15vh - 6rem, 2.5rem))',
          paddingBottom: 'clamp(1rem, 5vh, 2.5rem)',
        }}>
        <div className="w-full flex items-center justify-between pointer-events-auto max-w-lg mx-auto">
          <button
            disabled
            className="h-[clamp(2.5rem,5vh,3.5rem)] w-[clamp(2.5rem,5vh,3.5rem)] flex items-center justify-center bg-white/10 backdrop-blur-xl rounded-2xl border-2 border-orange-400/20 opacity-60 cursor-not-allowed relative overflow-hidden group">
            <span className="material-symbols-outlined text-[clamp(18px,2.2vh,24px)] text-white/20 blur-[1.2px]">
              menu
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-[clamp(16px,2vh,20px)] text-orange-500 fill-[1] drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">
                lock
              </span>
            </div>
          </button>

          <div className="flex p-1 bg-black/40 backdrop-blur-2xl rounded-[2.5rem] border-2 border-white/5 shadow-2xl relative pointer-events-auto">
            <button
              onClick={() => {
                if (homeActiveTab !== 'following') {
                  setHomeActiveTab('following')
                  setCurrentPostIndex(0)
                  scrollContainerRef.current?.scrollTo({ top: 0 })
                }
              }}
              className={`px-[clamp(0.75rem,3dvw,1.5rem)] py-[clamp(0.4rem,1vh,0.75rem)] rounded-[2rem] text-[clamp(12px,1.5vh,14px)] font-black transition-all duration-300 ${homeActiveTab === 'following' ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-white/50 hover:text-white'}`}>
              Following
            </button>
            <button
              onClick={handleForYouClick}
              className={`px-[clamp(0.75rem,3dvw,1.5rem)] py-[clamp(0.4rem,1vh,0.75rem)] rounded-[2rem] text-[clamp(12px,1.5vh,14px)] font-black transition-all duration-300 ${homeActiveTab === 'foryou' ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-white/50 hover:text-white'}`}>
              For You
            </button>
          </div>

          <button
            onClick={() => onNavigate(Page.Explore)}
            className="h-[clamp(2.5rem,5.5vh,3.5rem)] w-[clamp(2.5rem,5.5vh,3.5rem)] flex items-center justify-center bg-white/10 backdrop-blur-xl rounded-2xl border-2 border-orange-400/20 active:scale-90 transition-transform shadow-lg group">
            <span className="material-symbols-outlined text-[clamp(18px,2.5vh,24px)] text-white/90 group-hover:text-orange-400">
              search
            </span>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isLoading && !isLoadingMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 border-2 border-orange-400/20 rounded-full" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 border-2 border-orange-400 border-t-transparent rounded-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="absolute top-12 left-0 right-0 z-40 flex justify-center transition-transform duration-300 pointer-events-none"
        style={{ transform: `translateY(${pullY - 40}px)` }}>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 bg-white dark:bg-[#1C1C1E] ${isRefreshing ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          {isRefreshing && (
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
          )}
        </div>
      </div>

      {renderEmptyState() || (
        <div
          ref={scrollContainerRef}
          className={`h-full w-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory no-scrollbar bg-black overscroll-none ${
            isReady ? 'opacity-100' : 'opacity-0'
          } ${isLoading ? 'pointer-events-none' : ''} ${
            isTouching ? '' : 'transition-transform duration-300 ease-out'
          }`}
          style={{
            transform: `translateY(${pullY - pushY}px)`,
            overscrollBehavior: 'none',
          }}
          onScroll={isLoading ? undefined : handleScroll}
          onTouchStart={isLoading ? undefined : handleTouchStart}
          onTouchMove={isLoading ? undefined : handleTouchMove}
          onTouchEnd={isLoading ? undefined : handleTouchEnd}>
          {posts.map((post, index) => {
            // [核心修复] PWA 内存优化：计算距离，只渲染附近的 DOM，离太远的卸载图片视频。
            const isNear = Math.abs(index - currentPostIndex) <= 2
            return (
              <div
                key={`${post.id}-${index}`}
                className="h-full w-full snap-start relative"
                style={{ scrollSnapStop: 'always' }}>
                <FeedItem
                  post={post}
                  onOpenDiscussion={() => handleOpenDiscussion(post)}
                  isExiting={false}
                  isActive={index === currentPostIndex}
                  isNear={isNear} // 传入近距标志
                  isReady={isReady}
                  isLoading={isLoading}
                />
              </div>
            )
          })}

          <div
            ref={lastPostElementRef}
            className="w-full flex flex-col items-center justify-center bg-black gap-2 px-10 transition-all duration-500"
            style={{
              height: isLoadingMore || cooldownRemaining > 0 ? '20vh' : '5vh',
              opacity:
                isLoadingMore || (cooldownRemaining > 0 && pushY > 10) ? 1 : 0,
            }}>
            {isLoadingMore ? (
              <div className="flex items-center gap-2 text-white/50 text-xs font-bold uppercase tracking-widest">
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                Loading More...
              </div>
            ) : cooldownRemaining > 0 ? (
              <div className="flex flex-col items-center gap-2">
                <div className="text-white/30 text-[10px] font-medium uppercase tracking-tighter">
                  Wait {cooldownRemaining}s to load more
                </div>
                <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-orange-500"
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: cooldownRemaining, ease: 'linear' }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
                Pull up to load
              </div>
            )}

            {homeActiveTab !== 'foryou' &&
              !isLoadingMore &&
              posts.length > 0 &&
              cooldownRemaining === 0 && (
                <div className="text-white/20 text-[10px] mt-2">
                  - End of Feed -
                </div>
              )}
          </div>

          <div className="h-40 w-full bg-black" />
        </div>
      )}
    </div>
  )
}

export const FeedItem: React.FC<{
  post: any
  onOpenDiscussion: () => void
  isExiting: boolean
  onBack?: () => void
  isActive: boolean
  isNear?: boolean // [新增]
  isReady?: boolean
  isLoading?: boolean
}> = ({
  post,
  onOpenDiscussion,
  isExiting,
  onBack,
  isActive,
  isNear = true, // 默认渲染
  isReady = true,
  isLoading = false,
}) => {
  const {
    toggleLike,
    isLiked: checkIsLiked,
    toggleFollowCommunity,
    isFollowing,
  } = useUserStore()
  const { logEvent } = useAnalyticsStore()

  const isLiked = checkIsLiked(post.id)
  const isSubscribed = post.community_id
    ? isFollowing(post.community_id)
    : false

  const initialLikes =
    typeof post.upvotes === 'number' ? post.upvotes : parseInt(post.likes) || 0
  const imageUrl = post.image_url || post.image || ''
  const videoUrl = post.video_url || post.videoUrl || null
  const titleEn = post.title_en || post.titleEn || ''
  const titleCn = post.title_cn || post.titleZh || ''
  const subreddit = post.subreddit || 'Community'
  const commentCount = post.comments || post.comment_count || 0

  const [likes, setLikes] = useState(initialLikes)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoError, setVideoError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isSlowLoad, setIsSlowLoad] = useState(false)

  const hasVideo = !!videoUrl && !videoError

  const handleToggleSub = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (post.community_id) {
      toggleFollowCommunity(post.community_id)
      if (navigator.vibrate) navigator.vibrate(50)
    }
  }

  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (!hasVideo && isActive && !imageLoaded && !imageError) {
      timeout = setTimeout(() => {
        if (!imageLoaded) setIsSlowLoad(true)
      }, 30000)
    }
    return () => clearTimeout(timeout)
  }, [hasVideo, isActive, imageLoaded, imageError])

  const handleRetryImage = () => {
    setImageError(false)
    setIsSlowLoad(false)
    setImageLoaded(false)
  }

  useEffect(() => {
    if (hasVideo && videoRef.current && !isExiting) {
      const attemptPlay = async () => {
        try {
          if (isActive) {
            videoRef.current!.muted = true
            await videoRef.current!.play()
          } else {
            videoRef.current!.pause()
          }
        } catch (e) {}
      }
      attemptPlay()
    }
  }, [hasVideo, isExiting, isActive])

  const handleLike = async () => {
    if (isExiting) return
    toggleLike(post)
    if (navigator.vibrate) navigator.vibrate(50)
    logEvent({ post_id: post.id, interaction_type: 'click_like' })
    setLikes((prev) => (isLiked ? Math.max(0, prev - 1) : prev + 1))

    try {
      const newCount = isLiked
        ? initialLikes > 0
          ? initialLikes - 1
          : 0
        : initialLikes + 1
      await supabase
        .from('production_posts')
        .update({ upvotes: newCount })
        .eq('id', post.id)
    } catch (e) {}
  }

  const handleDiscussionClick = () => {
    logEvent({ post_id: post.id, interaction_type: 'click_discussion' })
    onOpenDiscussion()
  }
  const handleShare = async () => {
    logEvent({ post_id: post.id, interaction_type: 'click_share' })
    if (navigator.share)
      navigator.share({
        title: titleEn,
        text: titleCn,
        url: window.location.href,
      })
  }

  const CITRUS_SQUISH = {
    type: 'spring',
    stiffness: 600,
    damping: 15,
    mass: 1,
  }

  const DROPLET_SHAPE = '50% 50% 50% 50% / 60% 60% 43% 43%'

  return (
    <div className="h-full w-full bg-[#0B0A09] relative">
      <motion.div
        transition={{ type: 'spring', stiffness: 70, damping: 20 }}
        className="relative h-full w-full overflow-hidden bg-[#121212] z-[100]">
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
            if (!isExiting && hasVideo && videoRef.current)
              videoRef.current.paused
                ? videoRef.current.play()
                : videoRef.current.pause()
          }}>
          {/* [核心修复] 如果 isNear 为 false，直接渲染纯黑背景，不加载真实多媒体节点 */}
          {isNear ? (
            hasVideo ? (
              <video
                ref={videoRef}
                src={videoUrl || ''}
                className="h-full w-full object-cover"
                style={{ objectPosition: 'center 35%' }}
                loop
                muted
                playsInline
                preload={isActive ? 'auto' : 'metadata'}
                onError={() => setVideoError(true)}
              />
            ) : (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center blur-3xl scale-125 opacity-80"
                  style={{ backgroundImage: `url("${imageUrl}")` }}
                />
                <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />

                <AnimatePresence>
                  {(!imageLoaded || imageError || isSlowLoad) && (
                    <motion.div
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900/40 backdrop-blur-md px-10 text-center">
                      {imageError ? (
                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                          <span className="material-symbols-outlined text-red-500 text-5xl mb-4 opacity-80">
                            broken_image
                          </span>
                          <p className="text-white/60 text-xs font-bold leading-relaxed mb-6">
                            Image Unavailable
                            <br />
                            <span className="text-[10px] opacity-50 font-medium">
                              Connection reset or timed out
                            </span>
                          </p>
                          <button
                            onClick={handleRetryImage}
                            className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">
                            Retry
                          </button>
                        </div>
                      ) : isSlowLoad ? (
                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                          <span className="material-symbols-outlined text-orange-500 text-5xl mb-4 opacity-80">
                            timer_slow
                          </span>
                          <p className="text-white/60 text-xs font-bold leading-relaxed mb-6">
                            Connection Slow
                            <br />
                            <span className="text-[10px] opacity-50 font-medium">
                              Taking longer than expected to load
                            </span>
                          </p>
                          <button
                            onClick={handleRetryImage}
                            className="px-6 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-full text-orange-500 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                            Keep Waiting
                          </button>
                        </div>
                      ) : (
                        <div className="relative w-12 h-12">
                          <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full" />
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: 'linear',
                            }}
                            className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full"
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.img
                  src={imageUrl}
                  loading={isActive ? 'eager' : 'lazy'}
                  onLoad={() => {
                    setImageLoaded(true)
                    setIsSlowLoad(false)
                    setImageError(false)
                  }}
                  onError={() => {
                    setImageError(true)
                    setIsSlowLoad(false)
                  }}
                  className={`absolute inset-0 w-full h-full object-contain z-10 drop-shadow-2xl transition-opacity duration-500 ${imageLoaded && !imageError ? 'opacity-100' : 'opacity-0'}`}
                  style={{ objectPosition: 'center 35%' }}
                  transition={{ type: 'spring', stiffness: 70, damping: 20 }}
                />
              </>
            )
          ) : (
            // 内存兜底：对于距离当前超过上下2屏的内容，渲染极其轻量的空节点
            <div className="absolute inset-0 bg-[#0B0A09]" />
          )}

          <div
            className={`absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none z-20 transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
          />
        </div>

        <div
          className={`absolute inset-0 z-30 transition-all ${isExiting ? 'pointer-events-none' : ''}`}
          onDoubleClick={handleLike}
        />

        <motion.div
          key={`actions-${post.id}`}
          variants={STAGGER_CONTAINER}
          initial="initial"
          animate={isReady && isActive && !isLoading ? 'animate' : 'initial'}
          exit="exit"
          inherit={false}
          className="absolute inset-0 z-[120] pointer-events-none">
          <div
            className="absolute bottom-0 left-0 w-[85%] p-[clamp(1rem,3vh,1.5rem)] pb-[clamp(1rem,8vh,6rem)] flex flex-col items-start gap-[clamp(0.5rem,1.2vh,1rem)]"
            style={{
              paddingBottom:
                'calc(max(1rem, env(safe-area-inset-bottom)) + clamp(3.5rem, 8vh, 5.5rem))',
            }}>
            <motion.div
              variants={STAGGER_ITEM}
              className="flex items-center gap-2.5 pointer-events-auto">
              <div
                className="w-[clamp(2.1rem,4.5vh,2.5rem)] h-[clamp(2.1rem,4.5vh,2.5rem)] border-2 border-orange-400/30 bg-black/60 backdrop-blur-xl flex items-center justify-center overflow-hidden shadow-lg relative"
                style={{ borderRadius: DROPLET_SHAPE }}>
                <div className="absolute top-1 right-1.5 w-3.5 h-2 bg-green-500/60 rounded-full rotate-[-35deg] blur-[0.3px] pointer-events-none" />
                <span className="text-orange-400 font-black text-[clamp(14px,1.6vh,16px)]">
                  {subreddit.substring(0, 1).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col drop-shadow-xl">
                <span className="text-white font-black text-[clamp(13px,1.4vh,15px)] leading-tight flex items-center gap-1.5">
                  r/{subreddit}
                  <AnimatePresence>
                    {isSubscribed && (
                      <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{
                          scale: 1.5,
                          opacity: 0,
                          transition: { duration: 0.2 },
                        }}
                        transition={{
                          type: 'spring',
                          damping: 10,
                          stiffness: 300,
                        }}
                        onClick={handleToggleSub}
                        className="material-symbols-outlined text-[clamp(12px,1.2vh,14px)] fill-[1] text-orange-500 cursor-pointer active:scale-75 transition-transform">
                        verified
                      </motion.button>
                    )}
                  </AnimatePresence>
                </span>
                <div className="flex items-center gap-1 mt-0.5 opacity-60">
                  <span className="text-white text-[clamp(8px,0.9vh,10px)] font-black uppercase tracking-widest">
                    Active Community
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={STAGGER_ITEM}
              className="pointer-events-auto p-[clamp(0.75rem,2vh,1.51rem)] bg-black/60 backdrop-blur-3xl border-2 border-white/5 rounded-[clamp(1.5rem,3.5vh,2.5rem)] shadow-2xl relative overflow-hidden group max-w-[95%] select-none -webkit-touch-callout-none">
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all duration-700" />
              <h1 className="text-white text-[clamp(16px,2vh,20px)] font-black leading-tight drop-shadow-2xl mb-1.5">
                {titleEn}
              </h1>
              <p className="text-white/70 text-[clamp(13px,1.6vh,15px)] font-bold leading-relaxed line-clamp-2">
                {titleCn}
              </p>
            </motion.div>
          </div>

          <motion.div
            variants={STAGGER_ITEM}
            className="absolute bottom-[clamp(4.5rem,8vh,6.5rem)] right-2 flex flex-col-reverse items-center gap-[clamp(0.75rem,1.8vh,1.5rem)] pointer-events-auto w-[clamp(3rem,8dvw,3.5rem)]"
            style={{
              bottom:
                'calc(max(1rem, env(safe-area-inset-bottom)) + clamp(3.5rem, 8vh, 5.5rem))',
            }}>
            <div className="flex flex-col items-center gap-1">
              <motion.button
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.9 }}
                transition={CITRUS_SQUISH}
                onClick={handleShare}
                className="flex items-center justify-center transition-all overflow-hidden bg-transparent"
                style={{
                  borderRadius: DROPLET_SHAPE,
                  width: 'clamp(2.5rem,5.5vh,3rem)',
                  height: 'clamp(2.5rem,5.5vh,3rem)',
                }}>
                <span className="material-symbols-outlined text-[clamp(20px,2.5vh,24px)] text-white">
                  sunny
                </span>
              </motion.button>
              <span className="text-white/50 text-[clamp(8px,0.9vh,9px)] font-black tracking-[0.15em] uppercase drop-shadow-md">
                Share
              </span>
            </div>

            <JellyCommentButton
              onClick={handleDiscussionClick}
              label="Discuss"
            />

            <JellyLikeButton
              isLiked={isLiked}
              onClick={handleLike}
              count={likes}
            />

            <JellyFollowButton
              isFollowing={isSubscribed}
              onClick={handleToggleSub}
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Home
