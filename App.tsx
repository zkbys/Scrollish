import React, { useState, useEffect } from 'react'
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
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home)
  const [lastPage, setLastPage] = useState<Page>(Page.Home)

  // [关键修复] 不再只存 ID，而是存整个 Post 对象
  // 这样避免了从 Profile 跳转时，因为 allPosts 里找不到该 ID 而变成“公交车”的问题
  const [viewingPost, setViewingPost] = useState<Post | null>(null)

  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null,
  )
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

  // [修改] 接收完整的 Post 对象，而不是 ID
  const handlePostClick = (post: Post) => {
    setViewingPost(post)
    setCurrentPage(Page.TopicHub)
  }

  // [修改] Profile 点击处理
  const handleProfilePostClick = (post: Post) => {
    setViewingPost(post) // 直接设置要看的帖子对象
    setLastPage(Page.Profile)
    setCurrentPage(Page.Preview)
  }

  const renderPage = () => {
    // 如果没有选中的帖子，兜底显示 POSTS[0]，但现在逻辑健壮了，很少会走到这里
    const activePost = viewingPost || POSTS[0]

    switch (currentPage) {
      case Page.Home:
        return (
          <Home onNavigate={setCurrentPage} onPostSelect={handlePostClick} />
        )

      case Page.Preview:
        return (
          <div className="h-full w-full bg-black animate-in fade-in zoom-in-95 duration-300">
            <FeedItem
              post={activePost}
              isExiting={false}
              onOpenDiscussion={() => setCurrentPage(Page.TopicHub)}
              onBack={() => setCurrentPage(lastPage)}
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
                  setCurrentPage(Page.Preview)
                } else {
                  setViewingPost(null)
                  setSelectedCommentId(null)
                  setCurrentPage(Page.Home)
                }
              } else {
                setCurrentPage(p)
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
              setCurrentPage(Page.TopicHub)
            }}
          />
        )

      case Page.Explore:
        return <Explore />
      case Page.Study:
        return <Study />
      case Page.Profile:
        return (
          <Profile
            onNavigate={setCurrentPage}
            onPostSelect={handleProfilePostClick}
          />
        )
      default:
        return (
          <Home onNavigate={setCurrentPage} onPostSelect={handlePostClick} />
        )
    }
  }

  const hideBottomNav =
    currentPage === Page.TopicHub ||
    currentPage === Page.ChatRoom ||
    currentPage === Page.Preview

  return (
    <div className="flex justify-center bg-black min-h-screen">
      <div className="relative w-full max-w-md h-screen overflow-hidden bg-[#0B0A09] shadow-2xl flex flex-col">
        <main className="flex-1 overflow-hidden relative">{renderPage()}</main>

        {!hideBottomNav && (
          <BottomNav
            activePage={
              currentPage === Page.Preview ? Page.Profile : currentPage
            }
            onNavigate={setCurrentPage}
          />
        )}
      </div>
    </div>
  )
}

export default App
