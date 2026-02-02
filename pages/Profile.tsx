import React, { useRef, useLayoutEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Page, Post } from '../types'
import { useUserStore } from '../store/useUserStore'
import { useProfileStore } from '../store/useProfileStore'
import { useThemeStore } from '../store/useThemeStore'
import { IMAGES } from '../constants'

interface ProfileProps {
  onNavigate?: (page: Page) => void
  onPostSelect?: (post: Post) => void
}

const Profile: React.FC<ProfileProps> = ({ onNavigate, onPostSelect }) => {
  const { likedPosts } = useUserStore()
  const { scrollPos, setScrollPos } = useProfileStore()
  const { theme, toggleTheme } = useThemeStore()

  const [showSettings, setShowSettings] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 恢复滚动位置
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current && scrollPos > 0) {
          scrollContainerRef.current.scrollTo({
            top: scrollPos,
            behavior: 'instant',
          })
        }
      })
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPos(e.currentTarget.scrollTop)
  }

  const handlePostClick = (rawPost: any) => {
    if (onPostSelect) {
      const mappedPost: Post = {
        id: rawPost.id,
        user: rawPost.author_name || rawPost.subreddit || 'Anonymous',
        avatar: rawPost.author_avatar || IMAGES.avatar1,
        titleEn: rawPost.title_en,
        titleZh: rawPost.title_cn || '',
        hashtags: rawPost.hashtags || [],
        image: rawPost.image_url || IMAGES.london,
        videoUrl: rawPost.video_url || null,
        likes: rawPost.upvotes?.toString() || '0',
        stars: '0',
        comments: 0,
        image_type: rawPost.image_type,
        subreddit: rawPost.subreddit,
      }
      onPostSelect(mappedPost)
    }
  }

  return (
    // 根容器：添加 transition-colors 实现丝滑切换
    <div className="h-full w-full flex flex-col overflow-hidden select-none transition-colors duration-300 bg-gray-50 dark:bg-[#0B0A09] text-gray-900 dark:text-white">
      {/* Settings Overlay */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[80] bg-black/40 backdrop-blur-sm dark:bg-black/60"
              onClick={() => setShowSettings(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 w-72 z-[90] p-6 shadow-2xl bg-white dark:bg-[#1C1C1E] border-l border-gray-100 dark:border-white/5"
              onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-black mb-8 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500">
                  settings
                </span>
                Settings
              </h2>

              <div className="space-y-6">
                {/* Theme Switcher */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-3">
                    Appearance
                  </h3>
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 active:scale-95 transition-all">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        <span className="material-symbols-outlined text-[18px]">
                          {theme === 'dark' ? 'dark_mode' : 'light_mode'}
                        </span>
                      </div>
                      <span className="font-bold text-sm">Dark Mode</span>
                    </div>

                    {/* Toggle Switch UI */}
                    <div
                      className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${theme === 'dark' ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </div>
                  </button>
                </div>

                {/* Other Settings Placeholders */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-3">
                    Account
                  </h3>
                  <div className="space-y-2">
                    {['Notifications', 'Privacy', 'Help & Support'].map(
                      (item) => (
                        <button
                          key={item}
                          className="w-full text-left p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 font-medium text-sm transition-colors">
                          {item}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>

              <div className="absolute bottom-8 left-0 right-0 text-center">
                <span className="text-[10px] font-bold text-gray-300 dark:text-white/20">
                  Scrollish v1.0.2 MVP
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header Area */}
      <div className="pt-14 pb-6 px-6 relative z-10 flex items-end justify-between border-b border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-[#0B0A09]/80 backdrop-blur-xl">
        <div>
          <div className="text-[10px] font-black tracking-[0.2em] text-orange-500 mb-1 uppercase">
            Scrollish
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 p-[2px]">
              <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center overflow-hidden">
                <span className="text-xl font-black text-gray-900 dark:text-white">
                  M
                </span>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-2xl font-black leading-none tracking-tight text-gray-900 dark:text-white">
                My Space
              </span>
              <span className="text-xs text-gray-400 dark:text-white/40 font-bold mt-1">
                Free Member
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center active:scale-90 transition-transform shadow-sm dark:shadow-none">
          <span className="material-symbols-outlined text-gray-500 dark:text-white/60">
            settings
          </span>
        </button>
      </div>

      {/* Stats Bar */}
      <div className="px-6 py-6 flex gap-8">
        <div className="flex flex-col">
          <span className="text-xl font-black text-gray-900 dark:text-white">
            {likedPosts.length}
          </span>
          <span className="text-[10px] font-bold text-gray-400 dark:text-white/40 uppercase tracking-widest">
            Saved
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-black text-gray-900 dark:text-white">
            0
          </span>
          <span className="text-[10px] font-bold text-gray-400 dark:text-white/40 uppercase tracking-widest">
            Following
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 flex items-center gap-6 border-b border-gray-100 dark:border-white/5 mb-6">
        <div className="pb-3 border-b-2 border-orange-500 text-orange-500 font-bold text-sm">
          Saved Posts
        </div>
        <div className="pb-3 border-b-2 border-transparent text-gray-400 dark:text-white/40 font-bold text-sm">
          History
        </div>
      </div>

      {/* Grid Content */}
      <main
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pb-32 no-scrollbar">
        {likedPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-300 dark:text-white/20">
            <span className="material-symbols-outlined text-6xl mb-4">
              bookmark_border
            </span>
            <p className="text-xs font-bold uppercase tracking-widest">
              No saved posts yet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {likedPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => handlePostClick(post)}
                className="aspect-[3/4] rounded-2xl bg-white dark:bg-[#1A1A1A] relative overflow-hidden active:scale-95 transition-transform border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-none">
                {/* Media Thumbnail */}
                <div className="absolute inset-0 bg-gray-100 dark:bg-black">
                  {post.video_url ? (
                    <video
                      src={post.video_url}
                      className="w-full h-full object-cover opacity-90 dark:opacity-80"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <div
                      className="w-full h-full bg-cover bg-center"
                      style={{ backgroundImage: `url("${post.image_url}")` }}
                    />
                  )}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 dark:opacity-80" />

                {/* Type Indicator */}
                {post.video_url && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-[14px] text-white">
                      play_arrow
                    </span>
                  </div>
                )}

                {/* Info Overlay (Always white text on dark gradient) */}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[9px] font-black bg-white/20 px-1.5 py-0.5 rounded text-white/90 border border-white/5 backdrop-blur-sm">
                      r/{post.subreddit || 'RD'}
                    </span>
                  </div>
                  <p className="text-xs font-bold leading-tight line-clamp-2 text-white/95 drop-shadow-md">
                    {post.title_en}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default Profile
