import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from './supabase'
import { Page, Post } from './types'
import { POSTS, IMAGES } from './constants'
import Home, { FeedItem } from './pages/Home'
import TopicHub from './pages/TopicHub'
import ChatRoom from './pages/ChatRoom'
import Explore from './pages/Explore'
import Study from './pages/Study'
import Profile from './pages/Profile'
import CommunityDetail from './pages/CommunityDetail'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import BottomNav from './components/BottomNav'
import { useUserStore } from './store/useUserStore'
import { useAppStore } from './store/useAppStore'
import { useExploreStore } from './store/useExploreStore'
import { PAGE_VARIANTS } from './motion'
import { preloadImage, preloadImages } from './utils/media'

// [核心重构] 定义页面顺序，用于决定滑动方向
const getPageRank = (page: Page) => {
  switch (page) {
    case Page.Login: return -1
    case Page.Home: return 0
    case Page.Explore: return 1
    case Page.Study: return 2
    case Page.Profile: return 3
    case Page.CommunityDetail: return 4
    default: return 0
  }
}

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home)
  const [lastPage, setLastPage] = useState<Page>(Page.Home)
  const [originPage, setOriginPage] = useState<Page>(Page.Home)
  const [transitionDirection, setTransitionDirection] = useState(1)
  const [viewingPost, setViewingPost] = useState<Post | null>(null)
  const [selectedCommunity, setSelectedCommunity] = useState<any | null>(null)
  const [filteredCommunityId, setFilteredCommunityId] = useState<string | null>(null)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [isCommunityFlow, setIsCommunityFlow] = useState(false)

  // 状态管理
  const {
    currentUser,
    profile,
    login,
    logout,
    setLoading: setAuthLoading,
    isLoading: isAuthLoading,
    _hasHydrated,
  } = useUserStore()
  const { initializeExplore } = useExploreStore()

  useEffect(() => {
    setAuthLoading(false)
    initializeExplore()
  }, [])

  // [路由守卫优化] 增加对 _hasHydrated 的判断，防止从本地存储加载完成前误跳 Login
  useEffect(() => {
    if (_hasHydrated && !isAuthLoading) {
      if (!currentUser && currentPage !== Page.Login) {
        setCurrentPage(Page.Login)
      } else if (
        currentUser &&
        !profile?.learning_reason &&
        currentPage !== Page.Onboarding
      ) {
        setCurrentPage(Page.Onboarding)
      }
    }
  }, [currentUser, currentPage, isAuthLoading, profile, _hasHydrated])

  useEffect(() => {
    const fetchAllPosts = async () => {
      try {
        const { data, error } = await supabase
          .from('production_posts')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        if (data && data.length > 0) {
          const mappedPosts: Post[] = data.map((item: any) => ({
            id: item.id,
            user: item.author_name || item.subreddit || 'Anonymous',
            avatar: item.author_avatar || IMAGES.avatar1,
            titleEn: item.title_en,
            titleZh: item.title_cn || '',
            hashtags: item.hashtags || [],
            image: item.image_url || IMAGES.london,
            videoUrl: item.video_url || null,
            likes: item.upvotes?.toString() || '0',
            stars: item.stars?.toString() || '0',
            comments: 0,
            image_type: item.image_type,
            subreddit: item.subreddit,
          }))
          setAllPosts(mappedPosts)
        } else {
          setAllPosts(POSTS)
        }
      } catch (err) {
        console.error('Error fetching posts:', err)
        setAllPosts(POSTS)
      } finally {
        setLoading(false)
      }
    }
    fetchAllPosts()
  }, [])

  // [性能重构] 恢复瞬间导航：移除延迟和遮罩，提升 UI 响应反馈
  const navigateTo = (nextPage: Page) => {
    if (currentPage === nextPage) return
    
    const oldRank = getPageRank(currentPage)
    const newRank = getPageRank(nextPage)
    
    setTransitionDirection(newRank >= oldRank ? 1 : -1)
    setLastPage(currentPage)

    const mainTabPages = [Page.Home, Page.Explore, Page.Study, Page.Profile]
    if (mainTabPages.includes(nextPage)) {
      setOriginPage(nextPage)
    }
    setCurrentPage(nextPage)
  }

  const handlePostClick = (post: Post) => {
    setViewingPost(post)
    navigateTo(Page.TopicHub)
  }

  const handleProfilePostClick = (post: Post) => {
    setViewingPost(post)
    navigateTo(Page.Preview)
  }

  const renderPage = () => {
    const activePost = viewingPost || POSTS[0]

    switch (currentPage) {
      case Page.Home:
        return (
          <Home
            onNavigate={navigateTo}
            onPostSelect={handlePostClick}
            filteredCommunityId={filteredCommunityId}
            onClearFilter={() => setFilteredCommunityId(null)}
            initialTab={filteredCommunityId ? 'foryou' : undefined}
          />
        )
      case Page.Preview:
        return (
          <div className="h-full w-full bg-black">
            <FeedItem
              post={activePost}
              isExiting={false}
              isActive={true}
              onOpenDiscussion={() => navigateTo(Page.TopicHub)}
              onBack={() => navigateTo(originPage)}
            />
          </div>
        )
      case Page.TopicHub:
        return (
          <TopicHub
            post={activePost}
            initialCommentId={selectedCommentId}
            onNavigate={(p) => {
              if (p === Page.Home) {
                if (isCommunityFlow) {
                  navigateTo(Page.CommunityDetail)
                } else if (originPage === Page.Explore) {
                  navigateTo(Page.Explore)
                } else if (originPage === Page.Profile) {
                  navigateTo(Page.Preview)
                } else {
                  if (!filteredCommunityId && originPage === Page.Home) {
                    setViewingPost(null)
                    setSelectedCommentId(null)
                  }
                  navigateTo(originPage)
                }
              } else {
                navigateTo(p)
              }
            }}
            onSelectComment={(commentId) => setSelectedCommentId(commentId)}
          />
        )
      case Page.ChatRoom:
        return (
          <ChatRoom
            postId={activePost.id}
            postImage={activePost.image}
            focusCommentId={selectedCommentId}
            onBack={() => navigateTo(Page.TopicHub)}
          />
        )
      case Page.Explore:
        return (
          <Explore
            onNavigate={navigateTo}
            onPostSelect={handlePostClick}
            onCommunitySelect={(community) => {
              setSelectedCommunity(community)
              navigateTo(Page.CommunityDetail)
            }}
          />
        )
      case Page.CommunityDetail:
        return (
          <CommunityDetail
            community={selectedCommunity}
            onBack={() => {
              setIsCommunityFlow(false)
              navigateTo(originPage)
            }}
            onPostSelect={(post) => {
              setIsCommunityFlow(true)
              handlePostClick(post)
            }}
          />
        )
      case Page.Study:
        return <Study />
      case Page.Profile:
        return (
          <Profile
            onNavigate={navigateTo}
            onPostSelect={handleProfilePostClick}
          />
        )
      case Page.Login:
        return (
          <Login
            onNavigate={navigateTo}
            onLoginSuccess={(user) => {
              login(user)
              navigateTo(Page.Home)
            }}
          />
        )
      case Page.Onboarding:
        return <Onboarding onComplete={() => navigateTo(Page.Home)} />
      default:
        return <Home onNavigate={navigateTo} onPostSelect={handlePostClick} />
    }
  }

  const hideBottomNav =
    currentPage === Page.TopicHub ||
    currentPage === Page.ChatRoom ||
    currentPage === Page.Preview ||
    currentPage === Page.CommunityDetail ||
    currentPage === Page.Onboarding ||
    currentPage === Page.Login

  // [核心修复] 如果持久化存储还没加载完，显示 Loading，防止权限检查异常
  if (!_hasHydrated || isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0B0A09]">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex justify-center bg-black min-h-screen">
      <div className="relative w-full max-w-md h-screen overflow-hidden bg-[#0B0A09] shadow-2xl flex flex-col">
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 h-full w-full"
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>

        {!hideBottomNav && (
          <BottomNav
            activePage={
              currentPage === Page.Preview ? Page.Profile : currentPage
            }
            onNavigate={navigateTo}
          />
        )}
      </div>
    </div>
  )
}

export default App