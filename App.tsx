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

// [新增] 定义页面顺序，用于决定滑动方向
const getPageRank = (page: Page) => {
  switch (page) {
    case Page.Home:
      return 0
    case Page.Explore:
      return 1
    case Page.Study:
      return 2
    case Page.Profile:
      return 3
    case Page.CommunityDetail:
      return 4
    case Page.Login:
      return -1
    default:
      return 0
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
  const [filteredCommunityId, setFilteredCommunityId] = useState<string | null>(
    null,
  )
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null,
  )
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [isCommunityFlow, setIsCommunityFlow] = useState(false)
  const {
    currentUser,
    profile,
    login,
    logout,
    setLoading: setAuthLoading,
    isLoading: isAuthLoading,
    _hasHydrated,
    hasFetchedProfile, // [新增] 必须解构出来作为 Effect 的依赖，否则新用户登录会因 Profile 为空而不触发跳转
  } = useUserStore()
  const { initializeExplore } = useExploreStore()

  useEffect(() => {
    // 1. 初始化时检查现有会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // 如果已有会话且 store 中没有用户，执行同步
        if (!useUserStore.getState().currentUser) {
          login(session.user)
        }
      } else {
        // [修复] 如果没有会话，确保清除本地持久化中的残留用户状态
        logout()
      }
      setAuthLoading(false)
    })

    // 2. 监听 Auth 状态变化 (登录/登出/刷新)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // 只有当用户真的变化或 store 为空时才调用 login，避免过度刷新 session id
        if (useUserStore.getState().currentUser?.id !== session.user.id) {
          login(session.user)
        }
      } else {
        // [优化] 只有在真的没有有效会话时才调用 logout
        // 增加一个额外的 check，防止 Supabase 在刷新 Token 时触发虚假的 null session
        supabase.auth
          .getSession()
          .then(({ data: { session: currentSession } }) => {
            if (!currentSession && useUserStore.getState().currentUser) {
              logout()
            }
          })
      }
      setAuthLoading(false)
    })

    initializeExplore()
    // 初始化主题
    import('./store/useThemeStore').then((m) =>
      m.useThemeStore.getState().initTheme(),
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [login, logout, setAuthLoading, initializeExplore])

  // [路由守卫优化] 增加对 _hasHydrated 的判断
  useEffect(() => {
    if (_hasHydrated && !isAuthLoading) {
      if (!currentUser) {
        if (currentPage !== Page.Login) {
          setCurrentPage(Page.Login)
        }
      } else {
        // 已登录情况下的自动跳转逻辑
        if (currentPage === Page.Login) {
          // [优化] 如果已登录但还在登录页，根据资料完整度决定去哪
          const hasProfile = useUserStore.getState().hasFetchedProfile
          if (hasProfile) {
            if (!profile?.learning_reason) {
              setCurrentPage(Page.Onboarding)
            } else {
              setCurrentPage(Page.Home)
            }
          } else {
            // [新增] 极端情况兜底：如果已登录，但在登录页停留超过 5 秒还没加载完 Profile，强行跳转
            const timer = setTimeout(() => {
              if (
                useUserStore.getState().currentUser &&
                currentPage === Page.Login
              ) {
                console.warn(
                  '[Routing] Watchdog triggered: Forcing navigation from Login page',
                )
                // [优化] 如果 profile 里已经有核心数据了，就去 Home，否则去 Onboarding
                const isReturningUser = !!(
                  profile?.learning_reason ||
                  profile?.target_level ||
                  (profile?.total_xp && profile.total_xp > 0)
                )
                setCurrentPage(isReturningUser ? Page.Home : Page.Onboarding)
              }
            }, 5000)
            return () => clearTimeout(timer)
          }
        } else if (
          useUserStore.getState().hasFetchedProfile &&
          !profile?.learning_reason &&
          !profile?.target_level &&
          !(profile?.total_xp && profile.total_xp > 0) &&
          currentPage !== Page.Onboarding
        ) {
          setCurrentPage(Page.Onboarding)
        }
      }
    }
  }, [
    currentUser,
    currentPage,
    isAuthLoading,
    profile,
    hasFetchedProfile,
    _hasHydrated,
  ])

  // [新增] 单设备登录限制：监听 Session ID 变化
  useEffect(() => {
    if (!_hasHydrated || !currentUser) return

    // 1. 验证函数：对比本地 ID 与远程 ID
    const validateSession = async () => {
      // 如果已经在登录页了，或者正在同步会话 ID，就跳过验证
      const state = useUserStore.getState()
      if (currentPage === Page.Login || state.isSessionSyncing) {
        console.log('[Auth] Validation skipped (Login page or Syncing)')
        return
      }

      console.log('[Auth] Validating session stability...')
      const { data, error } = await supabase
        .from('profiles')
        .select('last_session_id')
        .eq('id', currentUser.id)
        .single()

      if (error) {
        console.warn('[Auth] Session validation query failed:', error.message)
        return
      }

      const localId = useUserStore.getState().localSessionId
      if (
        data?.last_session_id &&
        localId &&
        data.last_session_id !== localId
      ) {
        console.warn(
          '[Auth] Session mismatch detected! Local:',
          localId,
          'Remote:',
          data.last_session_id,
        )

        // [关键优化] 再次确认同步锁，防止在查询过程中锁被释放
        if (useUserStore.getState().isSessionSyncing) return

        // [关键优化] 增加一轮重试。防止登录瞬间数据库同步还没完成产生的“假冲突”
        console.log(
          '[Auth] Retrying session validation in 3s to avoid race condition...',
        )
        await new Promise((resolve) => setTimeout(resolve, 3000))

        const { data: retryData } = await supabase
          .from('profiles')
          .select('last_session_id')
          .eq('id', currentUser.id)
          .single()

        if (
          retryData?.last_session_id &&
          retryData.last_session_id !== localId
        ) {
          console.error(
            '[Auth] Confirmed session mismatch after retry. Kicking out.',
          )
          // 只有第二次依然不匹配，才踢人
          logout()
          setCurrentPage(Page.Login)
          setTimeout(() => {
            alert('您的账号已在其他设备登录，当前会话已失效。')
          }, 100)
        } else {
          console.log('[Auth] Mismatch resolved after retry. Welcome back.')
        }
      }
    }

    // 2. 订阅当前用户 Profile 的实时变化
    const channel = supabase
      .channel(`profile_session_${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`,
        },
        (payload) => {
          console.log('[Auth] Realtime session update received')
          const newSessionId = payload.new?.last_session_id
          const localId = useUserStore.getState().localSessionId

          if (newSessionId && localId && newSessionId !== localId) {
            // [优化] 实时推送同样增加一点宽限时间，等待本地存储完成
            setTimeout(async () => {
              const latestLocalId = useUserStore.getState().localSessionId
              if (newSessionId !== latestLocalId) {
                logout()
                setCurrentPage(Page.Login)
                alert('您的账号已在其他设备登录，当前会话已失效。')
              }
            }, 2000)
          }
        },
      )
      .subscribe((status) => {
        console.log('[Auth] Realtime subscription status:', status)
      })

    // 3. 增加 Visibility Watchdog：当用户切换回标签页时，强制校验一次
    // 解决浏览器后台运行时 WebSocket 可能挂起或漏掉信号的问题
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Auth] Tab became visible, triggering watchdog validation')
        validateSession()
      }
    }

    // 4. 初始校验一次
    validateSession()

    window.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [currentUser?.id, _hasHydrated, logout, currentPage]) // [修改] 增加依赖项确保状态准确

  // Redundant fetchAllPosts removed to improve performance and prevent timeouts.

  // [重构] 恢复瞬间导航：移除延迟和遮罩，优先响应速度
  const navigateTo = (nextPage: Page) => {
    if (currentPage === nextPage) {
      // [修改] 只在用户点击底部导航栏的 Home 时才刷新
      if (nextPage === Page.Home) {
        const { refreshFeed } = useAppStore.getState()
        refreshFeed()
      }
      return
    }

    // [新增] 离开 Home 页时保存当前位置
    if (currentPage === Page.Home && nextPage !== Page.Home) {
      useAppStore.getState().saveCurrentPosition()
    }

    // [新增] 返回 Home 页时恢复保存的位置
    if (nextPage === Page.Home && currentPage !== Page.Home) {
      const store = useAppStore.getState()
      store.setIsRestoring(true)
      store.restoreSavedPosition()

      // 在导航完成后，延迟关闭恢复状态，等待 DOM 渲染和滚动锁定。
      // [优化] 由于 Home 现在跳转是瞬时的，缩短锁定时长。
      setTimeout(() => {
        useAppStore.getState().setIsRestoring(false)
      }, 200)
    }

    // 处理实际导航和滑动方向
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

  // 1. 直接进入 TopicHub (用于 Home Feed 点击，Home 本身就是预览流)
  const handlePostClick = (post: Post) => {
    setViewingPost(post)
    navigateTo(Page.TopicHub)
  }

  // 2. [新增/重命名] 进入预览页 (用于 Explore 和 Profile)
  // 这实现了"点击进入显示类似于首页那样的页面"的需求
  const handlePostPreview = (post: any) => {
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
              onOpenDiscussion={() => navigateTo(Page.TopicHub)} // 点击 discuss 进入 TopicHub
              onBack={() => navigateTo(originPage)} // 返回到来源页 (Explore 或 Profile)
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
                // 处理 TopicHub 返回逻辑
                if (isCommunityFlow) {
                  navigateTo(Page.CommunityDetail)
                } else if (originPage === Page.Explore) {
                  // [修改] 如果来自 Explore，返回 Preview (保持与 Profile 一致的体验)
                  navigateTo(Page.Preview)
                } else if (originPage === Page.Profile) {
                  // 如果来自 Profile，返回 Preview
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
            // [修复] 兼容 Home 传过来的 image 和 Explore 传过来的 image_url
            postImage={activePost.image || activePost.image_url}
            focusCommentId={selectedCommentId}
            onBack={() => navigateTo(Page.TopicHub)}
          />
        )
      case Page.Explore:
        return (
          <Explore
            onNavigate={navigateTo}
            onPostSelect={handlePostPreview} // [关键修改] 使用 Preview 模式
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
            onPostSelect={handlePostPreview} // Profile 保持使用 Preview 模式
          />
        )
      case Page.Login:
        return (
          <Login
            onNavigate={navigateTo}
            onLoginSuccess={(user) => {
              // [优化] 登录成功后直接跳转首页，具体的 store 逻辑交给 App.tsx 的全局监听
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

  if (!_hasHydrated || isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0B0A09]">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <main className="h-screen w-full relative overflow-hidden bg-[#0B0A09]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 h-full w-full">
          {renderPage()}
        </motion.div>
      </AnimatePresence>

      {!hideBottomNav && (
        <BottomNav
          activePage={currentPage === Page.Preview ? Page.Profile : currentPage}
          onNavigate={navigateTo}
        />
      )}
    </main>
  )
}

export default App
