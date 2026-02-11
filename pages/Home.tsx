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
import { STAGGER_CONTAINER, STAGGER_ITEM, BUTTON_SPRING, SPRING_GENTLE } from '../motion'
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
    initFeed,
    refreshFeed,
    loadMore,
    isLoading,
    isLoadingMore,
    currentPostIndex,
    setCurrentPostIndex,
    homeActiveTab,
    setHomeActiveTab,
    isRestoring,
  } = useAppStore()

  const { followedCommunities } = useUserStore()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const [isReady, setIsReady] = useState(() => {
    return !(posts.length > 0 && currentPostIndex > 0)
  })

  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
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
          container.scrollTop = currentPostIndex * rowHeight
          // 额外检查一下是否滚动到位了，CSS Snap 可能会干扰
          if (Math.abs(container.scrollTop - currentPostIndex * rowHeight) > 5) {
            container.scrollTo({ top: currentPostIndex * rowHeight })
          }
          setIsReady(true)
        } else {
          // 如果高度还没准备好，下一帧再试
          requestAnimationFrame(restoreScroll)
        }
      } else {
        setIsReady(true)
      }
    }

    restoreScroll()
  }, [])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // [关键] 正在恢复位置或未就绪时，忽略滚动事件
    if (isRestoring || !isReady) return

    const container = e.currentTarget
    const rowHeight = container.clientHeight
    if (rowHeight === 0) return
    const newIndex = Math.round(container.scrollTop / rowHeight)
    if (newIndex !== currentPostIndex) {
      setCurrentPostIndex(newIndex)

      // [新增] 记录浏览历史
      const currentPost = posts[newIndex]
      if (currentPost) {
        useUserStore.getState().addViewHistory(currentPost)
      }
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
    if (homeActiveTab !== 'foryou') {
      setHomeActiveTab('foryou')
      setCurrentPostIndex(0) // 切换 Tab 时重置
      scrollContainerRef.current?.scrollTo({ top: 0 })
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

      {/* Header: 响应式缩放适配 - 矮屏极限收缩，长屏维持标准 */}
      <header className="absolute top-0 left-0 right-0 z-50 flex flex-col items-center px-5 pt-[clamp(0.4rem,20dvh-7.5rem,3.5rem)] pb-[clamp(1rem,5.5dvh,2.5rem)] bg-gradient-to-b from-black/80 via-black/20 to-transparent pointer-events-none transition-all duration-500">
        <div className="w-full flex items-center justify-between pointer-events-auto max-w-lg mx-auto">
          <button disabled className="h-[clamp(2.5rem,5.5dvh,3.5rem)] w-[clamp(2.5rem,5.5dvh,3.5rem)] flex items-center justify-center bg-white/10 backdrop-blur-xl rounded-2xl border-2 border-orange-400/20 opacity-60 cursor-not-allowed relative overflow-hidden group">
            <span className="material-symbols-outlined text-[clamp(18px,2.5dvh,24px)] text-white/20 blur-[1.2px]">menu</span>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-[clamp(16px,2dvh,20px)] text-orange-500 fill-[1] drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">lock</span>
            </div>
          </button>

          {/* Tab 切换器：随高度缩放 */}
          <div className="flex p-1 bg-black/40 backdrop-blur-2xl rounded-[2.5rem] border-2 border-white/5 shadow-2xl relative pointer-events-auto">
            <button
              onClick={() => {
                if (homeActiveTab !== 'following') {
                  setHomeActiveTab('following')
                  setCurrentPostIndex(0)
                  scrollContainerRef.current?.scrollTo({ top: 0 })
                }
              }}
              className={`px-[clamp(0.75rem,3dvw,1.5rem)] py-[clamp(0.4rem,1.2dvh,0.75rem)] rounded-[2rem] text-[clamp(12px,1.6dvh,14px)] font-black transition-all duration-300 ${homeActiveTab === 'following' ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-white/50 hover:text-white'}`}>
              Following
            </button>
            <button
              onClick={handleForYouClick}
              className={`px-[clamp(0.75rem,3dvw,1.5rem)] py-[clamp(0.4rem,1.2dvh,0.75rem)] rounded-[2rem] text-[clamp(12px,1.6dvh,14px)] font-black transition-all duration-300 ${homeActiveTab === 'foryou' ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-white/50 hover:text-white'}`}>
              For You
            </button>
          </div>

          <button
            onClick={() => onNavigate(Page.Explore)}
            className="h-[clamp(2.5rem,5.5dvh,3.5rem)] w-[clamp(2.5rem,5.5dvh,3.5rem)] flex items-center justify-center bg-white/10 backdrop-blur-xl rounded-2xl border-2 border-orange-400/20 active:scale-90 transition-transform shadow-lg group">
            <span className="material-symbols-outlined text-[clamp(18px,2.5dvh,24px)] text-white/90 group-hover:text-orange-400">search</span>
          </button>
        </div>
      </header>

      {/* 中心加载图标：极简柑橘风 */}
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
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
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
          className={`h-full overflow-y-auto snap-y snap-mandatory no-scrollbar pb-0 overscroll-x-none select-none ${isReady ? 'opacity-100' : 'opacity-0'} ${isLoading ? 'pointer-events-none' : ''}`}
          onScroll={isLoading ? undefined : handleScroll}
          onTouchStart={isLoading ? undefined : handleTouchStart}
          onTouchMove={isLoading ? undefined : handleTouchMove}
          onTouchEnd={isLoading ? undefined : handleTouchEnd}
          style={{ transform: `translateY(${pullY > 0 ? pullY / 3 : 0}px)` }}>
          {posts.map((post, index) => (
            <div
              key={`${post.id}-${index}`}
              ref={index === posts.length - 3 ? lastPostElementRef : null}
              className="h-full w-full snap-start relative"
              style={{ scrollSnapStop: 'always' }}>
              <FeedItem
                post={post}
                onOpenDiscussion={() => handleOpenDiscussion(post)}
                isExiting={false}
                isActive={index === currentPostIndex}
                isReady={isReady}
                isLoading={isLoading}
              />
            </div>
          ))}

          {posts.length > 0 && (
            <div
              className="h-20 w-full flex items-center justify-center snap-start bg-gray-50 dark:bg-black/50 transition-colors"
              style={{ scrollSnapStop: 'always' }}>
              {isLoadingMore ? (
                <div className="flex items-center gap-2 text-gray-400 dark:text-white/50 text-xs font-bold uppercase tracking-widest">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  Loading More...
                </div>
              ) : (
                <div className="text-gray-300 dark:text-white/20 text-[10px]">
                  - End of Feed -
                </div>
              )}
            </div>
          )}
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
  isReady?: boolean
  isLoading?: boolean
}> = ({
  post,
  onOpenDiscussion,
  isExiting,
  onBack,
  isActive,
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
    const [likes, setLikes] = useState(initialLikes)
    const videoRef = useRef<HTMLVideoElement>(null)
    const [videoError, setVideoError] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)

    const hasVideo = !!(post.videoUrl || post.video_url) && !videoError
    const imageUrl = post.image_url || post.image || ''
    const titleEn = post.title_en || post.titleEn || ''
    const titleCn = post.title_cn || post.titleZh || ''
    const subreddit = post.subreddit || 'Community'
    const commentCount = post.comments || post.comment_count || 0

    const handleToggleSub = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (post.community_id) {
        toggleFollowCommunity(post.community_id)
        if (navigator.vibrate) navigator.vibrate(50)
      }
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
          } catch (e) {
          }
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
        const newCount = isLiked ? (initialLikes > 0 ? initialLikes - 1 : 0) : initialLikes + 1
        await supabase
          .from('production_posts')
          .update({ upvotes: newCount })
          .eq('id', post.id)
      } catch (e) { }
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

    // “柑橘元气风”动画配置 (参考 test.tsx)
    const CITRUS_SQUISH = {
      type: 'spring',
      stiffness: 600,
      damping: 15,
      mass: 1
    }

    const DROPLET_SHAPE = "50% 50% 50% 50% / 60% 60% 43% 43%"

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
            {hasVideo ? (
              <video
                ref={videoRef}
                src={post.videoUrl || post.video_url}
                className="h-full w-full object-cover"
                style={{ objectPosition: 'center 35%' }}
                loop
                muted
                playsInline
                onError={() => setVideoError(true)}
              />
            ) : (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center blur-3xl scale-125 opacity-80"
                  style={{ backgroundImage: `url("${imageUrl}")` }}
                />
                <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />

                {/* 骨架屏占位 */}
                <AnimatePresence>
                  {!imageLoaded && (
                    <motion.div
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900/40 backdrop-blur-md">
                      <div className="relative w-12 h-12">
                        <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full" />
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.img
                  src={imageUrl}
                  loading="lazy"
                  onLoad={() => setImageLoaded(true)}
                  className={`absolute inset-0 w-full h-full object-contain z-10 drop-shadow-2xl transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  style={{ objectPosition: 'center 35%' }}
                  transition={{ type: 'spring', stiffness: 70, damping: 20 }}
                />
              </>
            )}
            {/* 始终保持深色渐变，保障文字可读性，同时为透明 BottomNav 提供背景 */}
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
            animate={isReady && isActive && !isLoading ? "animate" : "initial"}
            exit="exit"
            inherit={false}
            className="absolute inset-0 z-[120] pointer-events-none">
            <div className="absolute bottom-0 left-0 w-[85%] p-[clamp(1rem,4dvh,1.5rem)] pb-[clamp(1rem,9.5dvh,6rem)] flex flex-col items-start gap-[clamp(0.5rem,1.5dvh,1rem)]">
              <motion.div variants={STAGGER_ITEM} className="flex items-center gap-2.5 pointer-events-auto">
                <div
                  className="w-[clamp(2.1rem,5dvh,2.5rem)] h-[clamp(2.1rem,5dvh,2.5rem)] border-2 border-orange-400/30 bg-black/60 backdrop-blur-xl flex items-center justify-center overflow-hidden shadow-lg relative"
                  style={{ borderRadius: DROPLET_SHAPE }}>
                  {/* 元气绿色小叶子 */}
                  <div className="absolute top-1 right-1.5 w-3.5 h-2 bg-green-500/60 rounded-full rotate-[-35deg] blur-[0.3px] pointer-events-none" />
                  <span className="text-orange-400 font-black text-[clamp(14px,1.8dvh,16px)]">
                    {subreddit.substring(0, 1).toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col drop-shadow-xl">
                  <span className="text-white font-black text-[clamp(13px,1.6dvh,15px)] leading-tight flex items-center gap-1.5">
                    r/{subreddit}
                    <AnimatePresence>
                      {isSubscribed && (
                        <motion.button
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 1.5, opacity: 0, transition: { duration: 0.2 } }}
                          transition={{ type: "spring", damping: 10, stiffness: 300 }}
                          onClick={handleToggleSub}
                          className="material-symbols-outlined text-[clamp(12px,1.4dvh,14px)] fill-[1] text-orange-500 cursor-pointer active:scale-75 transition-transform"
                        >
                          verified
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </span>
                  <div className="flex items-center gap-1 mt-0.5 opacity-60">
                    <span className="text-white text-[clamp(8px,1dvh,10px)] font-black uppercase tracking-widest">Active Community</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                variants={STAGGER_ITEM}
                className="pointer-events-auto p-[clamp(0.75rem,2.5dvh,1.51rem)] bg-black/60 backdrop-blur-3xl border-2 border-white/5 rounded-[clamp(1.5rem,4dvh,2.5rem)] shadow-2xl relative overflow-hidden group max-w-[95%] select-none -webkit-touch-callout-none">
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all duration-700" />
                <h1 className="text-white text-[clamp(16px,2.2dvh,20px)] font-black leading-tight drop-shadow-2xl mb-1.5">
                  {titleEn}
                </h1>
                <p className="text-white/70 text-[clamp(13px,1.8dvh,15px)] font-bold leading-relaxed line-clamp-2">
                  {titleCn}
                </p>
              </motion.div>
            </div>

            <motion.div variants={STAGGER_ITEM} className="absolute bottom-[clamp(4.5rem,10dvh,6.5rem)] right-2 flex flex-col-reverse items-center gap-[clamp(0.75rem,2dvh,1.5rem)] pointer-events-auto w-[clamp(3rem,8dvw,3.5rem)]">
              {/* 阳光分享按钮 */}
              <div className="flex flex-col items-center gap-1">
                <motion.button
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  transition={CITRUS_SQUISH}
                  onClick={handleShare}
                  className="flex items-center justify-center transition-all overflow-hidden bg-transparent"
                  style={{ borderRadius: DROPLET_SHAPE, width: 'clamp(2.5rem,6dvh,3rem)', height: 'clamp(2.5rem,6dvh,3rem)' }}>
                  <span className="material-symbols-outlined text-[clamp(20px,2.8dvh,24px)] text-white">
                    sunny
                  </span>
                </motion.button>
                <span className="text-white/50 text-[clamp(8px,1dvh,9px)] font-black tracking-[0.15em] uppercase drop-shadow-md">Share</span>
              </div>

              {/* 评论 */}
              <JellyCommentButton
                onClick={handleDiscussionClick}
                label="Discuss"
              />

              {/* 点赞 (果冻爆炸版) */}
              <JellyLikeButton
                isLiked={isLiked}
                onClick={handleLike}
                count={likes}
              />

              {/* 关注 */}
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
