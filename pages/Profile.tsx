import React, { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Page, Post } from '../types'
import { useUserStore } from '../store/useUserStore'
import { useProfileStore } from '../store/useProfileStore'
import { useThemeStore } from '../store/useThemeStore'
import { IMAGES, getAssetPath } from '../constants'
import { STAGGER_CONTAINER, STAGGER_ITEM, SPRING_GENTLE } from '../motion'
import WordDetailOverlay from '../components/WordDetailOverlay'

interface ProfileProps {
  onNavigate?: (page: Page) => void
  onPostSelect?: (post: Post) => void
}

const RoundedStar = ({ className = "size-6", fill = "currentColor" }) => (
  <svg viewBox="0 0 24 24" className={className} fill={fill} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z"
      stroke={fill}
      strokeWidth="4"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

const Profile: React.FC<ProfileProps> = ({ onNavigate, onPostSelect }) => {
  const { likedPosts, starredWords, viewHistory, profile, fetchProfile, fetchStarredWords, updateProfile, logout } = useUserStore()
  const { scrollPos, setScrollPos } = useProfileStore()
  const { theme, toggleTheme } = useThemeStore()
  const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites')

  useEffect(() => {
    fetchProfile()
    fetchStarredWords()
  }, [])

  const userLevel = profile ? Math.floor(Math.sqrt((profile.total_xp || 0) / 100)) + 1 : 1
  const currentXP = profile?.total_xp || 0
  const nextLevelXP = Math.pow(userLevel, 2) * 100
  const prevLevelXP = Math.pow(userLevel - 1, 2) * 100
  const progressPercent = Math.min(100, Math.max(0, ((currentXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100))

  const [showSettings, setShowSettings] = useState(false)
  const [showVocabularyOverlay, setShowVocabularyOverlay] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [viewingWord, setViewingWord] = useState<string | null>(null)
  const [viewingDefinition, setViewingDefinition] = useState<any>(null)
  const [viewingWordContext, setViewingWordContext] = useState<string>('')
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

  const handleWordClick = async (word: any) => {
    setViewingWord(word.word)

    // 如果没有 context，尝试从云端加载
    let updatedWord = { ...word }
    if (!word.contexts || word.contexts.length === 0) {
      const contexts = await useUserStore.getState().fetchWordContext(word.word)
      if (contexts && contexts.length > 0) {
        updatedWord.contexts = contexts
        setViewingWordContext(contexts[0].text)
      }
    } else {
      setViewingWordContext(word.contexts[0]?.text || '')
    }

    setViewingDefinition(updatedWord)
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
    <div className="h-full w-full flex flex-col overflow-hidden select-none overscroll-x-none transition-colors duration-300 bg-[#FDFCFB] dark:bg-[#0B0A09] text-gray-900 dark:text-gray-100 relative">
      {/* Word Detail Overlay */}
      {viewingWord && (
        <WordDetailOverlay
          word={viewingWord}
          definition={viewingDefinition}
          context={viewingWordContext}
          onClose={() => setViewingWord(null)}
          hideContextMeaning={true}
        />
      )}
      {/* Fullscreen Image Preview */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullscreenImage(null)}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 cursor-zoom-out">
            <motion.img
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              src={getAssetPath(fullscreenImage)}
              alt="QR Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-3xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-2">
              <p className="text-white font-black text-lg tracking-tight">截图保存二维码</p>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest">点击背景返回</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Decor */}
      <div className="frost-overlay"></div>
      <div className="blob-pastel -top-20 -left-20 bg-[#FFEDD5] dark:bg-orange-500/20 opacity-60 dark:opacity-40"></div>
      <div className="blob-pastel top-1/4 -right-40 bg-[#FED7AA] dark:bg-red-500/10 opacity-60 dark:opacity-30"></div>
      <div className="blob-pastel -bottom-20 -left-20 bg-[#FFEDD5] dark:bg-orange-500/10 opacity-60 dark:opacity-30"></div>

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
              className="absolute top-0 right-0 bottom-0 w-72 z-[90] p-6 shadow-2xl bg-white/80 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl border-l border-white/40 dark:border-white/5 overflow-y-auto no-scrollbar"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-500">settings</span>
                  Settings
                </h2>
                <button
                  onClick={() => {
                    logout()
                    setShowSettings(false)
                  }}
                  className="h-10 w-10 flex items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 active:scale-90 transition-all hover:bg-red-500 hover:text-white shadow-sm translate-y-1.5 group"
                  title="Logout"
                >
                  <span className="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform">logout</span>
                </button>
              </div>

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



                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-3">Wechatroom</h3>
                  <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 flex flex-col items-center gap-4">
                    <div
                      onClick={() => setFullscreenImage('/group_qr.jpg')}
                      className="w-full aspect-square max-w-[220px] bg-white dark:bg-white/10 rounded-2xl border border-orange-500/20 flex items-center justify-center relative group overflow-hidden shadow-lg p-3 cursor-zoom-in active:scale-95 transition-transform">
                      <img
                        src={getAssetPath('/group_qr.jpg')}
                        alt="Wechatroom QR Code"
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-white/5 dark:bg-black/5 pointer-events-none" />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold text-gray-800 dark:text-white leading-relaxed">加入我们</p>
                      <p className="text-[9px] text-gray-500 dark:text-white/40 mt-1 font-medium italic">欢迎加入scrollish交流群</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-3">Customer Service</h3>
                  <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 flex flex-col items-center gap-4">
                    <div
                      onClick={() => setFullscreenImage('/support_qr.png')}
                      className="w-full aspect-square max-w-[190px] bg-white dark:bg-white/10 rounded-2xl border border-orange-500/20 flex items-center justify-center relative group overflow-hidden shadow-lg p-3 cursor-zoom-in active:scale-95 transition-transform">
                      <img
                        src={getAssetPath('/support_qr.png')}
                        alt="Customer Service QR Code"
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-white/5 dark:bg-black/5 pointer-events-none" />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold text-gray-800 dark:text-white leading-relaxed">联系客服</p>
                      <p className="text-[9px] text-gray-500 dark:text-white/40 mt-1 font-medium italic">问题反馈与 Bug 提交</p>
                    </div>
                  </div>
                </div>



              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className="relative z-50 flex items-center justify-between px-5 pt-[calc(max(0.75rem,env(safe-area-inset-top))+clamp(0.4rem,15vh-7.5rem,2.5rem))] pb-[clamp(0.4rem,1.5vh,1rem)] shrink-0 transition-all duration-500 max-w-lg mx-auto w-full">
        <button
          onClick={() => onNavigate?.(Page.Home)}
          className="h-[clamp(2.2rem,5.5vh,2.75rem)] w-[clamp(2.2rem,5.5vh,2.75rem)] flex items-center justify-center bg-gray-100 dark:bg-white/10 backdrop-blur-xl rounded-[clamp(0.8rem,1.8vh,1.2rem)] border-2 border-orange-400/20 active:scale-90 transition-transform shadow-lg group">
          <span className="material-symbols-outlined text-[clamp(18px,2.2vh,22px)] text-gray-800 dark:text-white/90 group-hover:text-orange-400">arrow_back</span>
        </button>

        <h2 className="text-gray-900 dark:text-white text-[clamp(16px,2vh,18px)] font-black tracking-tight">Profile</h2>

        <button
          onClick={() => setShowSettings(true)}
          className="h-[clamp(2.2rem,5.5vh,2.75rem)] w-[clamp(2.2rem,5.5vh,2.75rem)] flex items-center justify-center bg-gray-100 dark:bg-white/10 backdrop-blur-xl rounded-[clamp(0.8rem,1.8vh,1.2rem)] border-2 border-orange-400/20 active:scale-90 transition-transform shadow-lg group">
          <span className="material-symbols-outlined text-[clamp(18px,2.2vh,22px)] text-gray-800 dark:text-white/90 group-hover:text-orange-400">settings</span>
        </button>
      </header>

      <main
        ref={scrollContainerRef}
        onScroll={handleScroll}
        variants={STAGGER_CONTAINER}
        initial="initial"
        animate="animate"
        className="relative z-10 flex-1 overflow-y-auto no-scrollbar scroll-smooth overscroll-x-none">

        {/* Profile Info - 响应式缩放 */}
        <motion.div variants={STAGGER_ITEM} className="flex p-4 flex-col items-center mt-2 max-w-lg mx-auto">
          <div className="relative">
            <div className="p-1 rounded-full bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-600 shadow-xl ring-4 ring-white/30 dark:ring-white/5">
              <div
                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-[clamp(4.5rem,11vh,6.5rem)] w-[clamp(4.5rem,11vh,6.5rem)] border-[3px] border-white dark:border-[#1C1C1E] shadow-inner"
                style={{ backgroundImage: `url("${getAssetPath(IMAGES.avatarProfile)}")` }}>
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white text-[clamp(8px,1.2vh,10px)] font-black px-[clamp(0.4rem,1vh,0.6rem)] py-[clamp(0.2rem,0.4vh,0.3rem)] rounded-full border-2 border-white dark:border-[#1C1C1E] shadow-lg">
              LVL {userLevel}
            </div>
          </div>
          <div className="flex flex-col items-center mt-[clamp(0.75rem,2vh,1.25rem)] gap-1.5">
            <div className="flex items-center gap-2">
              <p className="text-gray-900 dark:text-white text-[clamp(18px,2.8vh,24px)] font-black tracking-tight">{profile?.display_name || 'My Space'}</p>
              <span className="material-symbols-outlined text-orange-500 text-[clamp(16px,2.2vh,20px)]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <div className="flex items-center gap-1.5 glass-card-premium px-3 py-1 border-white/80 dark:border-white/10">
              <span className="material-symbols-outlined text-orange-500 text-[clamp(11px,1.4vh,14px)]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
              <p className="text-orange-600 dark:text-orange-400 text-[clamp(8px,1.1vh,10px)] font-extrabold uppercase tracking-widest">Premium Member</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Matrix - 响应式卡片 */}
        <motion.div variants={STAGGER_ITEM} className="grid grid-cols-2 gap-[clamp(0.5rem,1.5vh,0.875rem)] p-4 max-w-lg mx-auto">
          <div
            onClick={() => setShowVocabularyOverlay(true)}
            className="glass-card-premium p-[clamp(0.75rem,2vh,1rem)] flex items-center justify-between transition-transform active:scale-[0.98] cursor-pointer hover:bg-orange-500/5 group">
            <div>
              <p className="text-gray-400 dark:text-white/40 text-[clamp(8px,1.1vh,10px)] font-bold uppercase tracking-widest mb-1">Vocabulary</p>
              <p className="text-gray-900 dark:text-white text-[clamp(18px,2.6vh,24px)] font-black group-hover:text-orange-500 transition-colors">{starredWords.length}</p>
            </div>
            <div className="size-[clamp(2rem,5vh,2.5rem)] rounded-[clamp(0.6rem,1.5vh,0.8rem)] bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
              <span className="material-symbols-outlined text-[clamp(18px,2.2vh,22px)]" style={{ fontVariationSettings: "'FILL' 1" }}>book</span>
            </div>
          </div>
          <div className="glass-card-premium p-[clamp(0.75rem,2vh,1rem)] flex items-center justify-between relative overflow-hidden group">
            <div className="flex flex-col blur-[4px]">
              <p className="text-gray-400 dark:text-white/40 text-[clamp(8px,1.1vh,10px)] font-bold uppercase tracking-widest mb-1">History</p>
              <p className="text-gray-900 dark:text-white text-[clamp(18px,2.6vh,24px)] font-black">{profile?.words_count || 0}</p>
            </div>
            <div className="size-[clamp(2rem,5vh,2.5rem)] rounded-[clamp(0.6rem,1.5vh,0.8rem)] bg-purple-500/10 flex items-center justify-center blur-[4px]">
              <span className="material-symbols-outlined text-purple-500 text-[clamp(18px,2.2vh,22px)]" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
            </div>
            {/* 终极锁定层 */}
            <div className="absolute inset-0 z-10 backdrop-blur-[15px] bg-white/10 dark:bg-black/40 flex items-center justify-center border-0">
              <span className="material-symbols-outlined text-orange-500 text-[clamp(16px,2vh,20px)] fill-[1] drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]">lock</span>
            </div>
          </div>
          <div className="glass-card-premium p-[clamp(0.75rem,2vh,1rem)] flex items-center justify-between relative overflow-hidden group">
            <div className="flex flex-col blur-[4px]">
              <p className="text-gray-400 dark:text-white/40 text-[clamp(8px,1.1vh,10px)] font-bold uppercase tracking-widest mb-1">XP</p>
              <p className="text-gray-900 dark:text-white text-[clamp(18px,2.6vh,24px)] font-black">
                {currentXP > 1000 ? `${(currentXP / 1000).toFixed(1)}k` : currentXP}
              </p>
            </div>
            <div className="size-[clamp(2rem,5vh,2.5rem)] rounded-[clamp(0.6rem,1.5vh,0.8rem)] bg-orange-500/10 flex items-center justify-center blur-[4px]">
              <RoundedStar className="size-[clamp(16px,2vh,20px)] text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" fill="currentColor" />
            </div>
            {/* 终极锁定层 */}
            <div className="absolute inset-0 z-10 backdrop-blur-[15px] bg-white/10 dark:bg-black/40 flex items-center justify-center border-0">
              <span className="material-symbols-outlined text-orange-500 text-[clamp(16px,2vh,20px)] fill-[1] drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]">lock</span>
            </div>
          </div>
          <div className="glass-card-premium p-[clamp(0.75rem,2vh,1rem)] flex items-center justify-between relative overflow-hidden group">
            <div className="flex flex-col blur-[4px]">
              <p className="text-gray-400 dark:text-white/40 text-[clamp(8px,1.1vh,10px)] font-bold uppercase tracking-widest mb-1">Streak</p>
              <p className="text-gray-900 dark:text-white text-[clamp(18px,2.6vh,24px)] font-black">{profile?.current_streak || 0}</p>
            </div>
            <div className="size-[clamp(2rem,5vh,2.5rem)] rounded-[clamp(0.6rem,1.5vh,0.8rem)] bg-yellow-500/10 flex items-center justify-center blur-[4px]">
              <span className="material-symbols-outlined text-yellow-500 text-[clamp(18px,2.2vh,22px)]" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
            </div>
            {/* 终极锁定层 */}
            <div className="absolute inset-0 z-10 backdrop-blur-[15px] bg-white/10 dark:bg-black/40 flex items-center justify-center border-0">
              <span className="material-symbols-outlined text-orange-500 text-[clamp(16px,2vh,20px)] fill-[1] drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]">lock</span>
            </div>
          </div>
        </motion.div>

        {/* Level Progress - 紧凑化适配 */}
        <motion.div variants={STAGGER_ITEM} className="mx-[clamp(0.5rem,1.2vh,1rem)] mb-6 p-[clamp(0.75rem,2vh,1.25rem)] glass-card-premium max-w-lg md:mx-auto">
          <div className="flex justify-between items-end mb-2.5">
            <div className="flex flex-col">
              <p className="text-gray-900 dark:text-white text-[clamp(12px,1.6vh,14px)] font-black">Progress to Level {userLevel + 1}</p>
              <p className="text-gray-500 dark:text-white/40 text-[clamp(9px,1.2vh,11px)] font-medium">Keep it up! {nextLevelXP - currentXP} XP to go.</p>
            </div>
            <p className="text-orange-600 dark:text-orange-400 text-[clamp(10px,1.4vh,12px)] font-black">{currentXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP</p>
          </div>
          <div className="h-[clamp(0.6rem,1.5vh,0.85rem)] rounded-full bg-gray-100/50 dark:bg-black/20 inner-glow overflow-hidden p-[2px] border border-white/50 dark:border-white/5">
            <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 shadow-sm transition-all" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </motion.div>

        {/* Sticky Tabs - 响应式高度适配 */}
        <div className="sticky top-0 z-20 bg-white/40 dark:bg-[#0B0A09]/60 backdrop-blur-xl border-b border-white/40 dark:border-white/5 max-w-lg mx-auto w-full">
          <div className="flex px-4">
            <button
              onClick={() => setActiveTab('favorites')}
              className={`flex flex-col items-center justify-center border-b-2 ${activeTab === 'favorites' ? 'border-orange-500 text-gray-900 dark:text-white' : 'border-transparent text-gray-400 dark:text-white/40'} pb-[clamp(0.5rem,1.25vh,0.75rem)] pt-4 flex-1 transition-colors`}>
              <p className="text-[clamp(10px,1.4vh,12px)] font-black tracking-tight uppercase">Favorites</p>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex flex-col items-center justify-center border-b-2 ${activeTab === 'history' ? 'border-orange-500 text-gray-900 dark:text-white' : 'border-transparent text-gray-400 dark:text-white/40'} pb-[clamp(0.5rem,1.25vh,0.75rem)] pt-4 flex-1 transition-colors`}>
              <p className="text-[clamp(10px,1.4vh,12px)] font-black tracking-tight uppercase">History</p>
            </button>
            <button disabled className="flex flex-col items-center justify-center border-b-2 border-transparent text-gray-400 dark:text-white/40 pb-[clamp(0.5rem,1.25vh,0.75rem)] pt-4 flex-1 relative group cursor-not-allowed">
              <div className="flex items-center gap-1 opacity-20 blur-[6px]">
                <p className="text-[clamp(10px,1.4vh,12px)] font-bold tracking-tight uppercase">Awards</p>
              </div>
              <span className="material-symbols-outlined text-[clamp(14px,1.8vh,18px)] text-orange-500 absolute top-1/2 -translate-y-1/2 fill-[1] drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">lock</span>
            </button>
          </div>
        </div>

        {/* Content Grid - 间距适配 */}
        <div className="p-4 pb-32 max-w-lg mx-auto">
          {activeTab === 'favorites' ? (
            likedPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-300 dark:text-white/20">
                <RoundedStar className="size-16 mb-4 opacity-50" fill="currentColor" />
                <p className="text-xs font-bold uppercase tracking-widest text-center">No stars yet<br /><span className="text-[10px] lowercase font-medium opacity-50">Starred items will appear here</span></p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-[clamp(0.5rem,1.5vh,1rem)]">
                {likedPosts.map((post) => (
                  <motion.div
                    key={post.id}
                    variants={STAGGER_ITEM}
                    onClick={() => handlePostClick(post)}
                    className="group glass-card-premium overflow-hidden flex flex-col transition-all duration-300 active:scale-95 shadow-sm hover:shadow-lg cursor-pointer">
                    <div className="aspect-square w-full bg-gray-100 dark:bg-black overflow-hidden relative">
                      {((post as any).video_url || (post as any).videoUrl) ? (
                        <video src={(post as any).video_url || (post as any).videoUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" muted />
                      ) : (
                        <div className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-500" style={{ backgroundImage: `url("${(post as any).image_url || (post as any).image}")` }} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      {((post as any).video_url || (post as any).videoUrl) && (
                        <div className="absolute top-2 right-2 size-[clamp(1.5rem,3.5vh,1.75rem)] bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/60">
                          <span className="material-symbols-outlined text-white text-[clamp(14px,1.8vh,18px)] font-bold">play_arrow</span>
                        </div>
                      )}
                    </div>
                    <div className="p-[clamp(0.5rem,1.2vh,0.75rem)] flex flex-col justify-between flex-grow">
                      <div>
                        <span className="inline-block px-1.5 py-0.5 rounded-md bg-orange-100/60 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[clamp(8px,1vh,9.5px)] font-black uppercase mb-1 border border-orange-200/50 dark:border-orange-500/20">
                          r/{(post as any).subreddit || 'Reddit'}
                        </span>
                        <p className="text-gray-900 dark:text-white text-[clamp(10px,1.3vh,12px)] font-extrabold leading-snug line-clamp-2">
                          {(post as any).title_en || (post as any).titleEn}
                        </p>
                      </div>
                      <p className="text-gray-400 dark:text-white/30 text-[clamp(8px,1vh,9px)] font-bold mt-2 flex items-center gap-1 uppercase tracking-tight">
                        <RoundedStar className="size-[clamp(10px,1.2vh,12px)] text-orange-500" fill="currentColor" />
                        Starred
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          ) : (
            // History Tab
            viewHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-300 dark:text-white/20">
                <span className="material-symbols-outlined text-6xl mb-4 opacity-50">history</span>
                <p className="text-xs font-bold uppercase tracking-widest text-center">No history yet<br /><span className="text-[10px] lowercase font-medium opacity-50">Posts you view will appear here</span></p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-[clamp(0.5rem,1.5vh,1rem)]">
                {viewHistory.map((item) => (
                  <motion.div
                    key={item.postId}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => handlePostClick(item.post)}
                    className="group glass-card-premium overflow-hidden flex flex-col transition-all duration-300 active:scale-95 shadow-sm hover:shadow-lg cursor-pointer">
                    <div className="aspect-square w-full bg-gray-100 dark:bg-black overflow-hidden relative">
                      {((item.post as any).video_url || (item.post as any).videoUrl) ? (
                        <video src={(item.post as any).video_url || (item.post as any).videoUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" muted />
                      ) : (
                        <div className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-500" style={{ backgroundImage: `url("${(item.post as any).image_url || (item.post as any).image}")` }} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      {((item.post as any).video_url || (item.post as any).videoUrl) && (
                        <div className="absolute top-2 right-2 size-[clamp(1.5rem,3.5vh,1.75rem)] bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/60">
                          <span className="material-symbols-outlined text-white text-[clamp(14px,1.8vh,18px)] font-bold">play_arrow</span>
                        </div>
                      )}
                    </div>
                    <div className="p-[clamp(0.5rem,1.2vh,0.75rem)] flex flex-col justify-between flex-grow">
                      <div>
                        <span className="inline-block px-1.5 py-0.5 rounded-md bg-purple-100/60 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[clamp(8px,1vh,9.5px)] font-black uppercase mb-1 border border-purple-200/50 dark:border-purple-500/20">
                          r/{(item.post as any).subreddit || 'Reddit'}
                        </span>
                        <p className="text-gray-900 dark:text-white text-[clamp(10px,1.3vh,12px)] font-extrabold leading-snug line-clamp-2">
                          {(item.post as any).title_en || (item.post as any).titleEn}
                        </p>
                      </div>
                      <p className="text-gray-400 dark:text-white/30 text-[clamp(8px,1vh,9px)] font-bold mt-2 flex items-center gap-1 uppercase tracking-tight">
                        <span className="material-symbols-outlined text-[clamp(11px,1.3vh,13px)] text-purple-500">history</span>
                        {new Date(item.viewedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          )}
        </div>
      </main>

      <AnimatePresence>
        {showVocabularyOverlay && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-[#FDFCFB] dark:bg-[#0B0A09] flex flex-col"
          >
            {/* Overlay Header */}
            <div className="px-6 pt-12 pb-6 flex items-center justify-between border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>book</span>
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Vocabulary</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{starredWords.length} saved words</p>
                </div>
              </div>
              <button
                onClick={() => setShowVocabularyOverlay(false)}
                className="size-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-white/60 active:scale-90 transition-transform"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Overlay Content */}
            <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-32">
              {starredWords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-white/20">
                  <span className="material-symbols-outlined text-6xl mb-4 opacity-50">book</span>
                  <p className="text-xs font-bold uppercase tracking-widest text-center">No words yet<br /><span className="text-[10px] lowercase font-medium opacity-50">Saved words will appear here</span></p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {starredWords.map((word) => (
                    <motion.div
                      key={word.word}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => handleWordClick(word)}
                      className="group glass-card-premium overflow-hidden flex flex-col transition-all duration-300 active:scale-95 shadow-sm hover:shadow-lg cursor-pointer p-4 min-h-[130px] justify-between relative bg-white dark:bg-white/[0.03]"
                    >
                      <div className="absolute top-2 right-2 opacity-20 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-orange-500 text-[16px] fill-[1]">bookmark</span>
                      </div>

                      <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight capitalize mb-1">
                          {word.word}
                        </h3>
                        <p className="text-[10px] font-mono text-gray-400 dark:text-white/30 uppercase tracking-tighter mb-2">
                          {word.ipa || '/.../'}
                        </p>
                      </div>

                      <div className="border-t border-gray-100 dark:border-white/5 pt-2">
                        <p className="text-[11px] font-bold text-gray-700 dark:text-white/80 line-clamp-2 leading-relaxed">
                          {word.definition_cn}
                        </p>
                        <div className="flex items-center justify-between mt-1 gap-2">
                          {word.contexts && word.contexts.length > 0 ? (
                            <p className="text-[9px] text-gray-400 dark:text-white/30 line-clamp-1 italic flex-1">
                              "{word.contexts[0].text}"
                            </p>
                          ) : (
                            <div className="flex-1" />
                          )}
                          {word.contexts && word.contexts.length > 1 && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-500 text-[8px] font-black">
                              +{word.contexts.length - 1} MORE
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
