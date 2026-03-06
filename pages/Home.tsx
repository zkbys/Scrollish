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
import { useHistoryStore } from '../store/useHistoryStore'
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
import { FeedItem } from '../components/FeedItem'

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

  const { followedCommunities } = useHistoryStore()
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
        useHistoryStore.getState().addViewHistory(currentPost)
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
          className={`h-full w-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory no-scrollbar bg-black overscroll-none ${isReady ? 'opacity-100' : 'opacity-0'
            } ${isLoading ? 'pointer-events-none' : ''} ${isTouching ? '' : 'transition-transform duration-300 ease-out'
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

export default Home
