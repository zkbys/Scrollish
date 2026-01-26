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
import BottomNav from './components/BottomNav'

const App: React.FC = () => {
  // ... rest of the component state and logic remains the same ...
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home)
  const [lastPage, setLastPage] = useState<Page>(Page.Home)
  const [viewingPost, setViewingPost] = useState<Post | null>(null)
  const [filteredCommunityId, setFilteredCommunityId] = useState<string | null>(null)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

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

  // [新增] 统一导航处理，确保记录上一步页面
  const navigateTo = (nextPage: Page) => {
    setLastPage(currentPage)
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
              onOpenDiscussion={() => navigateTo(Page.TopicHub)}
              onBack={() => navigateTo(lastPage)}
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
                if (lastPage === Page.Profile) {
                  navigateTo(Page.Preview)
                } else {
                  setViewingPost(null)
                  setSelectedCommentId(null)
                  navigateTo(Page.Home)
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
            onBack={() => {
              navigateTo(Page.TopicHub)
            }}
          />
        )

      case Page.Explore:
        return (
          <Explore
            onNavigate={navigateTo}
            onPostSelect={handlePostClick}
            onCommunitySelect={(communityId) => {
              setFilteredCommunityId(communityId)
              navigateTo(Page.Home)
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
      default:
        return (
          <Home onNavigate={navigateTo} onPostSelect={handlePostClick} />
        )
    }
  }

  const hideBottomNav =
    currentPage === Page.TopicHub ||
    currentPage === Page.ChatRoom ||
    currentPage === Page.Preview

  // [新增] 定义页面顺序，用于决定滑动方向
  const getPageRank = (page: Page) => {
    switch (page) {
      case Page.Home: return 0
      case Page.Explore: return 1
      case Page.Study: return 2
      case Page.Profile: return 3
      default: return 0
    }
  }

  const direction = getPageRank(currentPage) >= getPageRank(lastPage) ? 1 : -1

  return (
    <div className="flex justify-center bg-black min-h-screen">
      <div className="relative w-full max-w-md h-screen overflow-hidden bg-[#0B0A09] shadow-2xl flex flex-col">
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={currentPage}
              custom={direction}
              // 当涉及到 TopicHub 时，强制仅使用淡入淡出（opacity），完全禁止位移和缩放，防止干扰 Shared Element
              initial={
                currentPage === Page.TopicHub || lastPage === Page.TopicHub
                  ? { opacity: 0 }
                  : { opacity: 0, x: direction * 50, scale: 0.98 }
              }
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={
                (currentPage === Page.Home && lastPage === Page.TopicHub) || currentPage === Page.TopicHub
                  ? { opacity: 0 }
                  : { opacity: 0, x: direction * -50, scale: 0.98 }
              }
              transition={{
                duration: (currentPage === Page.Home && lastPage === Page.TopicHub) || currentPage === Page.TopicHub ? 0.2 : 0.4,
                ease: [0.22, 1, 0.36, 1]
              }}
              className="absolute inset-0 h-full w-full will-change-transform"
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
