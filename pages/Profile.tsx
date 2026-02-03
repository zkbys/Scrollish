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
    <div className="h-full w-full flex flex-col overflow-hidden select-none transition-colors duration-300 bg-[#FDFCFB] dark:bg-[#0B0A09] text-gray-900 dark:text-gray-100 relative">
      {/* Background Decor */}
      <div className="frost-overlay"></div>
      <div className="blob-pastel -top-20 -left-20 bg-[#FFEDD5] dark:bg-orange-500/20 opacity-60 dark:opacity-40"></div>
      <div className="blob-pastel top-1/4 -right-40 bg-[#FED7AA] dark:bg-red-500/10 opacity-60 dark:opacity-30"></div>
      <div className="blob-pastel -bottom-20 -left-20 bg-[#FFF7ED] dark:bg-amber-500/10 opacity-60 dark:opacity-20"></div>

      {/* Settings Overlay */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[80] bg-black/20 backdrop-blur-sm dark:bg-black/60"
              onClick={() => setShowSettings(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 w-72 z-[90] p-6 shadow-2xl bg-white/80 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl border-l border-white/40 dark:border-white/5"
              onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-black mb-8 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500">settings</span>
                Settings
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-3">Appearance</h3>
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/5 active:scale-95 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        <span className="material-symbols-outlined text-[18px]">
                          {theme === 'dark' ? 'dark_mode' : 'light_mode'}
                        </span>
                      </div>
                      <span className="font-bold text-sm">Dark Mode</span>
                    </div>
                    <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${theme === 'dark' ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className="relative z-20 flex items-center p-4 pt-6 justify-between shrink-0">
        <div
          onClick={() => onNavigate?.(Page.Home)}
          className="flex size-10 items-center justify-center rounded-full glass-card-premium cursor-pointer active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-gray-800 dark:text-gray-200 text-lg">arrow_back_ios_new</span>
        </div>
        <h2 className="text-gray-900 dark:text-white text-lg font-extrabold tracking-tight">Profile</h2>
        <div
          onClick={() => setShowSettings(true)}
          className="flex size-10 items-center justify-center rounded-full glass-card-premium cursor-pointer active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-gray-800 dark:text-gray-200 text-xl">settings</span>
        </div>
      </header>

      <main
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative z-10 flex-1 overflow-y-auto no-scrollbar scroll-smooth">

        {/* Profile Info */}
        <div className="flex p-4 flex-col items-center mt-2">
          <div className="relative">
            <div className="p-1 rounded-full bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-600 shadow-xl ring-4 ring-white/30 dark:ring-white/5">
              <div
                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-24 w-24 border-[3px] border-white dark:border-[#1C1C1E] shadow-inner"
                style={{ backgroundImage: `url("${IMAGES.avatar1}")` }}>
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full border-2 border-white dark:border-[#1C1C1E] shadow-lg">
              LVL 42
            </div>
          </div>
          <div className="flex flex-col items-center mt-5 gap-1.5">
            <div className="flex items-center gap-2">
              <p className="text-gray-900 dark:text-white text-2xl font-black tracking-tight">My Space</p>
              <span className="material-symbols-outlined text-orange-500 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <div className="flex items-center gap-1.5 glass-card-premium px-3 py-1 border-white/80 dark:border-white/10">
              <span className="material-symbols-outlined text-orange-500 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
              <p className="text-orange-600 dark:text-orange-400 text-[10px] font-extrabold uppercase tracking-widest">Premium Member</p>
            </div>
          </div>
        </div>

        {/* Stats Matrix */}
        <div className="grid grid-cols-2 gap-3.5 p-4">
          <div className="glass-card-premium p-4 flex items-center justify-between transition-transform active:scale-[0.98]">
            <div>
              <p className="text-gray-400 dark:text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Saved</p>
              <p className="text-gray-900 dark:text-white text-2xl font-black">{likedPosts.length}</p>
            </div>
            <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-500 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span>
            </div>
          </div>
          <div className="glass-card-premium p-4 flex items-center justify-between">
            <div>
              <p className="text-gray-400 dark:text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Words</p>
              <p className="text-gray-900 dark:text-white text-2xl font-black">2.4k</p>
            </div>
            <div className="size-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-500 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
            </div>
          </div>
          <div className="glass-card-premium p-4 flex items-center justify-between">
            <div>
              <p className="text-gray-400 dark:text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">XP</p>
              <p className="text-gray-900 dark:text-white text-2xl font-black">15.2k</p>
            </div>
            <div className="size-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-orange-500 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            </div>
          </div>
          <div className="glass-card-premium p-4 flex items-center justify-between">
            <div>
              <p className="text-gray-400 dark:text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Awards</p>
              <p className="text-gray-900 dark:text-white text-2xl font-black">12</p>
            </div>
            <div className="size-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-yellow-500 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            </div>
          </div>
        </div>

        {/* Level Progress */}
        <div className="mx-4 mb-6 p-5 glass-card-premium">
          <div className="flex justify-between items-end mb-3">
            <div className="flex flex-col">
              <p className="text-gray-900 dark:text-white text-sm font-black">Progress to Level 43</p>
              <p className="text-gray-500 dark:text-white/40 text-[11px] font-medium">Keep it up! You\'re almost there.</p>
            </div>
            <p className="text-orange-600 dark:text-orange-400 text-xs font-black">15,200 / 20,000 XP</p>
          </div>
          <div className="h-3.5 rounded-full bg-gray-100/50 dark:bg-black/20 inner-glow overflow-hidden p-0.5 border border-white/50 dark:border-white/5">
            <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 shadow-sm transition-all" style={{ width: '75%' }}></div>
          </div>
        </div>

        {/* Sticky Tabs */}
        <div className="sticky top-0 z-20 bg-white/40 dark:bg-[#0B0A09]/60 backdrop-blur-xl border-b border-white/40 dark:border-white/5">
          <div className="flex px-4">
            <button className="flex flex-col items-center justify-center border-b-2 border-orange-500 text-gray-900 dark:text-white pb-3 pt-4 flex-1">
              <p className="text-xs font-black tracking-tight uppercase">Saved</p>
            </button>
            <button className="flex flex-col items-center justify-center border-b-2 border-transparent text-gray-400 dark:text-white/40 pb-3 pt-4 flex-1">
              <p className="text-xs font-bold tracking-tight uppercase">History</p>
            </button>
            <button className="flex flex-col items-center justify-center border-b-2 border-transparent text-gray-400 dark:text-white/40 pb-3 pt-4 flex-1">
              <p className="text-xs font-bold tracking-tight uppercase">Awards</p>
            </button>
          </div>
        </div>

        {/* Content Grid */}
        <div className="p-4 pb-32">
          {likedPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-300 dark:text-white/20">
              <span className="material-symbols-outlined text-6xl mb-4">bookmark_border</span>
              <p className="text-xs font-bold uppercase tracking-widest text-center">No saved posts yet<br /><span className="text-[10px] lowercase font-medium opacity-50">Saved items will appear here</span></p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {likedPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => handlePostClick(post)}
                  className="group glass-card-premium overflow-hidden flex flex-col transition-all duration-300 active:scale-95 shadow-sm hover:shadow-lg cursor-pointer">
                  <div className="aspect-square w-full bg-gray-100 dark:bg-black overflow-hidden relative">
                    {post.video_url ? (
                      <video src={post.video_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" muted />
                    ) : (
                      <div className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-500" style={{ backgroundImage: `url("${post.image_url}")` }} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    {post.video_url && (
                      <div className="absolute top-2 right-2 w-7 h-7 bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/60">
                        <span className="material-symbols-outlined text-white text-lg font-bold">play_arrow</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col justify-between flex-grow">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md bg-orange-100/60 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[9px] font-black uppercase mb-1.5 border border-orange-200/50 dark:border-orange-500/20">
                        r/{post.subreddit || 'Reddit'}
                      </span>
                      <p className="text-gray-900 dark:text-white text-[11px] font-extrabold leading-snug line-clamp-2">
                        {post.title_en}
                      </p>
                    </div>
                    <p className="text-gray-400 dark:text-white/30 text-[9px] font-bold mt-2 flex items-center gap-1 uppercase tracking-tight">
                      <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
                      Saved recently
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Global CSS for Premium Interface */}
      <style>{`
        .glass-card-premium {
            background: rgba(255, 255, 255, 0.65);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.8);
            box-shadow: 
                0 10px 15px -3px rgba(0, 0, 0, 0.04), 
                inset 0 0 0 1px rgba(255, 255, 255, 0.5),
                inset 0 2px 4px 0 rgba(255, 255, 255, 0.8);
            border-radius: 1.25rem;
        }
        .dark .glass-card-premium {
            background: rgba(30, 30, 32, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.06);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(20px);
        }
        .inner-glow {
            box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 1);
        }
        .dark .inner-glow {
            box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.05);
        }
        .blob-pastel {
            position: absolute;
            width: 500px;
            height: 500px;
            filter: blur(80px);
            border-radius: 50%;
            z-index: 0;
            pointer-events: none;
        }
        .frost-overlay {
            position: fixed;
            inset: 0;
            background: url('https://grainy-gradients.vercel.app/noise.svg');
            opacity: 0.03;
            pointer-events: none;
            z-index: 5;
        }
      `}</style>
    </div>
  )
}

export default Profile
