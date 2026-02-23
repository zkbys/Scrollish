import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Page, Post } from './types'
import { POSTS } from './constants'
import Home from './pages/Home'
import { FeedItem } from './components/FeedItem'
import TopicHub from './pages/TopicHub'
import ChatRoom from './pages/ChatRoom'
import Explore from './pages/Explore'
import Study from './pages/Study'
import Profile from './pages/Profile'
import CommunityDetail from './pages/CommunityDetail'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import BottomNav from './components/BottomNav'
import { PAGE_VARIANTS } from './motion'
import { useRouter } from './hooks/useRouter'
import { useSessionManager } from './hooks/useSessionManager'

const App: React.FC = () => {
  // Use Custom Hooks
  const {
    currentPage,
    originPage,
    transitionDirection,
    setCurrentPage,
    navigateTo,
    currentPageRef,
  } = useRouter()

  const { isAuthLoading, _hasHydrated } = useSessionManager(
    currentPage,
    setCurrentPage,
    currentPageRef
  )

  // Local State
  const [viewingPost, setViewingPost] = useState<Post | null>(null)
  const [selectedCommunity, setSelectedCommunity] = useState<any | null>(null)
  const [filteredCommunityId, setFilteredCommunityId] = useState<string | null>(null)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [isCommunityFlow, setIsCommunityFlow] = useState(false)

  // Navigation Handlers
  const handlePostClick = (post: Post) => {
    setViewingPost(post)
    navigateTo(Page.TopicHub)
  }

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
              onOpenDiscussion={() => navigateTo(Page.TopicHub)}
              onBack={() => navigateTo(originPage)}
            />
          </div>
        )
      case Page.TopicHub:
        return (
          <TopicHub
            key={activePost.id}
            post={activePost}
            initialCommentId={selectedCommentId}
            onNavigate={(p) => {
              if (p === Page.Home) {
                if (isCommunityFlow) {
                  navigateTo(Page.CommunityDetail)
                } else if (originPage === Page.Explore || originPage === Page.Profile) {
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
            postImage={activePost.image || activePost.image_url}
            focusCommentId={selectedCommentId}
            onBack={() => navigateTo(Page.TopicHub)}
          />
        )
      case Page.Explore:
        return (
          <Explore
            onNavigate={navigateTo}
            onPostSelect={handlePostPreview}
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
            onPostSelect={handlePostPreview}
          />
        )
      case Page.Login:
        return (
          <Login
            onNavigate={navigateTo}
            onLoginSuccess={() => navigateTo(Page.Home)}
          />
        )
      case Page.Onboarding:
        return <Onboarding onComplete={() => navigateTo(Page.Home)} />
      default:
        return <Home onNavigate={navigateTo} onPostSelect={handlePostClick} />
    }
  }

  const hideBottomNav = [
    Page.TopicHub,
    Page.ChatRoom,
    Page.Preview,
    Page.CommunityDetail,
    Page.Onboarding,
    Page.Login,
  ].includes(currentPage)

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
