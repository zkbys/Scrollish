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

interface HomeProps {
  onNavigate: (page: Page) => void
  onPostSelect: (post: Post) => void
  filteredCommunityId?: string | null
  onClearFilter?: () => void
  initialTab?: 'following' | 'foryou'
}

// [新增] 简易图片预览组件
const ImagePreviewOverlay: React.FC<{ src: string; onClose: () => void }> = ({
  src,
  onClose,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center cursor-zoom-out"
      onClick={onClose}>
      <motion.img
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        src={src}
        className="max-w-full max-h-screen object-contain p-2"
        onClick={(e) => e.stopPropagation()} // 防止点图片关闭，必须点背景（可选，根据需求）
      />
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white backdrop-blur-md">
        <span className="material-symbols-outlined">close</span>
      </button>
    </motion.div>
  )
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
  } = useAppStore()

  const { followedCommunities } = useUserStore()
  const [activeTab, setActiveTab] = useState<'following' | 'foryou'>(initialTab)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // [新增] 预览图片状态
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const [isReady, setIsReady] = useState(() => {
    return !(posts.length > 0 && currentPostIndex > 0)
  })

  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartRef = useRef(0)

  const getFilters = useCallback(() => {
    if (activeTab === 'following') {
      return { followedIds: followedCommunities }
    }
    if (filteredCommunityId) {
      return { communityId: filteredCommunityId }
    }
    return {}
  }, [activeTab, followedCommunities, filteredCommunityId])

  useEffect(() => {
    initFeed(getFilters())
    // 切换 Tab 时重置索引并滚动回顶端，解决首个帖子 UI 不显示的问题
    setCurrentPostIndex(0)
    scrollContainerRef.current?.scrollTo({ top: 0 })
  }, [activeTab, filteredCommunityId, followedCommunities.length])

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
    if (activeTab === 'following' && followedCommunities.length === 0) {
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
      {/* [新增] 图片预览覆盖层 */}
      <AnimatePresence>
        {previewImage && (
          <ImagePreviewOverlay
            src={previewImage}
            onClose={() => setPreviewImage(null)}
          />
        )}
      </AnimatePresence>

      {filteredCommunityId && activeTab === 'foryou' && (
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

      {/* Header: 柑橘元气风重绘 */}
      <header className="absolute top-0 left-0 right-0 z-50 flex flex-col items-center px-5 pt-12 pb-10 bg-gradient-to-b from-black/80 via-black/20 to-transparent pointer-events-none transition-all duration-500">
        <div className="w-full flex items-center justify-between pointer-events-auto">
          <button disabled className="h-11 w-11 flex items-center justify-center bg-white/10 backdrop-blur-xl rounded-2xl border-2 border-orange-400/20 opacity-60 cursor-not-allowed relative overflow-hidden group">
            {/* 增加模糊程度的菜单残影 */}
            <span className="material-symbols-outlined text-[22px] text-white/20 blur-[1.2px]">menu</span>

            {/* 顶层叠加的实心锁定图标 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-orange-500 fill-[1] drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">lock</span>
            </div>
          </button>

          {/* Tab 切换器：柑橘气泡 (回归简洁：无滑块) */}
          <div className="flex p-1.5 bg-black/40 backdrop-blur-2xl rounded-[2.5rem] border-2 border-white/5 shadow-2xl relative pointer-events-auto">
            <button
              onClick={() => setActiveTab('following')}
              className={`px-6 py-2.5 rounded-[2rem] text-[14px] font-black transition-all duration-300 ${activeTab === 'following' ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-white/50 hover:text-white'}`}>
              Following
            </button>
            <button
              onClick={handleForYouClick}
              className={`px-6 py-2.5 rounded-[2rem] text-[14px] font-black transition-all duration-300 ${activeTab === 'foryou' ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-white/50 hover:text-white'}`}>
              For You
            </button>
          </div>

          <button
            onClick={() => onNavigate(Page.Explore)}
            className="h-11 w-11 flex items-center justify-center bg-white/10 backdrop-blur-xl rounded-2xl border-2 border-orange-400/20 active:scale-90 transition-transform shadow-lg group">
            <span className="material-symbols-outlined text-[22px] text-white/90 group-hover:text-orange-400">search</span>
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
          className={`h-full overflow-y-auto snap-y snap-mandatory no-scrollbar pb-0 ${isReady ? 'opacity-100' : 'opacity-0'}`}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
                // [新增] 传递点击放大回调
                onViewImage={(url) => setPreviewImage(url)}
                isExiting={false}
                isActive={index === currentPostIndex}
                isReady={isReady}
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
  onViewImage?: (url: string) => void // [新增]
  isExiting: boolean
  onBack?: () => void
  isActive: boolean
  isReady?: boolean
}> = ({
  post,
  onOpenDiscussion,
  onViewImage,
  isExiting,
  onBack,
  isActive,
  isReady = true,
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
            if (!isExiting) {
              if (hasVideo && videoRef.current) {
                videoRef.current.paused
                  ? videoRef.current.play()
                  : videoRef.current.pause()
              } else if (!hasVideo && onViewImage) {
                // [融合 Main 分支逻辑] 如果是图片且非退出状态，触发预览
                onViewImage(imageUrl)
              }
            }
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
              <motion.img
                src={imageUrl}
                className="absolute inset-0 w-full h-full object-contain z-10 drop-shadow-2xl"
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
          animate={isReady && isActive ? "animate" : "initial"}
          exit="exit"
          inherit={false}
          className="absolute inset-0 z-[120] pointer-events-none">
          <div className="absolute bottom-0 left-0 w-[85%] p-5 pb-24 flex flex-col items-start gap-4">
            <motion.div variants={STAGGER_ITEM} className="flex items-center gap-2.5 pointer-events-auto">
              <div
                className="w-10 h-10 border-2 border-orange-400/30 bg-black/60 backdrop-blur-xl flex items-center justify-center overflow-hidden shadow-lg relative"
                style={{ borderRadius: DROPLET_SHAPE }}>
                {/* 元气绿色小叶子 */}
                <div className="absolute top-1 right-1.5 w-3.5 h-2 bg-green-500/60 rounded-full rotate-[-35deg] blur-[0.3px] pointer-events-none" />
                <span className="text-orange-400 font-black text-[16px]">
                  {subreddit.substring(0, 1).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col drop-shadow-xl">
                <span className="text-white font-black text-[15px] leading-tight flex items-center gap-1.5">
                  r/{subreddit}
                  <span className="material-symbols-outlined text-[14px] text-blue-400 fill-[1]">verified</span>
                </span>
                <div className="flex items-center gap-1 mt-0.5 opacity-60">
                  <span className="text-white text-[10px] font-black uppercase tracking-widest">Active Community</span>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={CITRUS_SQUISH}
                onClick={handleToggleSub}
                className={`backdrop-blur-xl border-2 text-[11px] font-black px-4 py-2 rounded-[1.2rem] ml-1 transition-all pointer-events-auto ${isSubscribed ? 'bg-orange-400/20 border-orange-400/40 text-orange-400' : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'}`}>
                {isSubscribed ? 'Following' : 'Subscribe'}
              </motion.button>
            </motion.div>

            <motion.div
              variants={STAGGER_ITEM}
              className="pointer-events-auto p-6 bg-black/40 backdrop-blur-2xl border-2 border-white/5 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all duration-700" />
              <h1 className="text-white text-[20px] font-black leading-tight drop-shadow-2xl mb-2">
                {titleEn}
              </h1>
              <p className="text-white/70 text-[15px] font-bold leading-relaxed line-clamp-2">
                {titleCn}
              </p>
            </motion.div>
          </div>

          <motion.div variants={STAGGER_ITEM} className="absolute bottom-24 right-2.5 flex flex-col-reverse items-center gap-6 pointer-events-auto w-14">
            {/* 分享：太阳造型 */}
            <div className="flex flex-col items-center gap-1.5">
              <motion.button
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.9 }}
                transition={CITRUS_SQUISH}
                onClick={handleShare}
                className="w-12 h-12 bg-transparent flex items-center justify-center transition-colors relative transition-all overflow-hidden"
                style={{ borderRadius: DROPLET_SHAPE, width: '46px', height: '46px' }}>
                <span className="material-symbols-outlined text-[24px] text-white">
                  sunny
                </span>
              </motion.button>
              <span className="text-white/50 text-[9px] font-black tracking-[0.2em] uppercase drop-shadow-md">Share</span>
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
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Home