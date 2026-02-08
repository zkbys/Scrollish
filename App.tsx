import React, { useState, useEffect, useRef } from 'react'
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

// [新增] 定义页面顺序，用于决定滑动方向
const getPageRank = (page: Page) => {
  switch (page) {
    case Page.Home: return 0
    case Page.Explore: return 1
    case Page.Study: return 2
    case Page.Profile: return 3
    case Page.CommunityDetail: return 4
    case Page.Login: return -1
    default: return 0
  }
}

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home)
  const [lastPage, setLastPage] = useState<Page>(Page.Home)
  // [新增] 记录用户进入详情流的起始 Tab 页（Explore/Home/Profile）
  const [originPage, setOriginPage] = useState<Page>(Page.Home)
  const [transitionDirection, setTransitionDirection] = useState(1)
  const [viewingPost, setViewingPost] = useState<Post | null>(null)
  const [selectedCommunity, setSelectedCommunity] = useState<any | null>(null)
  const [filteredCommunityId, setFilteredCommunityId] = useState<string | null>(null)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [isCommunityFlow, setIsCommunityFlow] = useState(false)
  const { currentUser, profile, login, logout, setLoading: setAuthLoading, isLoading: isAuthLoading } = useUserStore()
  const hasCheckedOnboarding = useRef(false)

  // [修改] 仅在初始化时确认加载完成
  useEffect(() => {
    setAuthLoading(false)
  }, [])

  // [修复] 未登录拦截 - 移除 currentPage 依赖,避免页面切换时误触发
  useEffect(() => {
    if (!isAuthLoading && !currentUser && currentPage !== Page.Login) {
      setCurrentPage(Page.Login)
    }
  }, [currentUser, isAuthLoading])

  // [完全重写] Onboarding 守卫 - 只在用户首次登录时检查一次
  useEffect(() => {
    // 只有当用户已登录、profile 已加载、且之前没有检查过时,才进行检查
    if (!isAuthLoading && currentUser && profile && !hasCheckedOnboarding.current) {
      hasCheckedOnboarding.current = true

      // 检查 profile 是否缺少必要字段
      if (!profile.learning_reason || !profile.target_level) {
        console.log('[Onboarding Guard] Profile incomplete, redirecting to Onboarding')
        setCurrentPage(Page.Onboarding)
      } else {
        console.log('[Onboarding Guard] Profile complete, allowing navigation')
      }
    }
  }, [currentUser, isAuthLoading, profile])



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

  // [重构] 恢复瞬间导航：移除延迟和遮罩，优先响应速度
  const navigateTo = (nextPage: Page) => {
    if (currentPage === nextPage) return
    performNavigation(nextPage)
  }

  const performNavigation = (nextPage: Page) => {
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
              onBack={() => {
                // [修复] 使用 originPage 确保返回到正确的起始页（通常是 Profile）
                navigateTo(originPage)
              }}
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
                // [智能返回] 优先判断是否处于社区详情流
                if (isCommunityFlow) {
                  navigateTo(Page.CommunityDetail)
                } else if (originPage === Page.Explore) {
                  // 从 Explore 进来的，返回 Explore
                  navigateTo(Page.Explore)
                } else if (originPage === Page.Profile) {
                  // 从 Profile 进来的，返回 Preview 中间层
                  navigateTo(Page.Preview)
                } else {
                  // 从 Home 进来的，或其他情况，返回 Home
                  // 只有在没有社区过滤且是真正回到 Home 时，才清理状态
                  if (!filteredCommunityId && originPage === Page.Home) {
                    setViewingPost(null)
                    setSelectedCommentId(null)
                  }
                  navigateTo(originPage)
                }
              } else {
                // 其他导航（如进入 ChatRoom）正常处理
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
            onBack={() => {
              // ChatRoom 只返回到 TopicHub，不修改 originPage
              // 确保整个详情流的起始点被锁定
              navigateTo(Page.TopicHub)
            }}
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
        return (
          <Onboarding
            onComplete={() => {
              // 引导完成，确保 profile 同步后进入首页
              navigateTo(Page.Home)
            }}
          />
        )
      default:
        return (
          <Home onNavigate={navigateTo} onPostSelect={handlePostClick} />
        )
    }
  }

  const hideBottomNav =
    currentPage === Page.TopicHub ||
    currentPage === Page.ChatRoom ||
    currentPage === Page.Preview ||
    currentPage === Page.CommunityDetail ||
    currentPage === Page.Onboarding ||
    currentPage === Page.Login

  // [移除] 不再在渲染期间实时派生方向，改为使用 navigateTo 显式更新的状态
  // const direction = getPageRank(currentPage) >= getPageRank(lastPage) ? 1 : -1
  // [移除] 不再在渲染期间实时派生方向，改为使用 navigateTo 显式更新的状态
  // const direction = getPageRank(currentPage) >= getPageRank(lastPage) ? 1 : -1

  if (isAuthLoading) {
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