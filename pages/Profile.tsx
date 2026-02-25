import React, { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Page, Post } from '../types'
import { useUserStore } from '../store/useUserStore'
import { useAuthStore } from '../store/useAuthStore'
import { useHistoryStore } from '../store/useHistoryStore'
import { useVocabularyStore } from '../store/useVocabularyStore'
import { useProfileStore } from '../store/useProfileStore'
import { useThemeStore } from '../store/useThemeStore'
import { IMAGES, getAssetPath } from '../constants'
import { STAGGER_CONTAINER, STAGGER_ITEM, SPRING_GENTLE } from '../motion'
import WordDetailOverlay from '../components/WordDetailOverlay'
import { toMultiplier, toLevel } from '../utils/ttsUtils'
import { VOICES } from '../constants'
import { useTTS } from '../hooks/useTTS'
import VoiceCloneManager from '../components/VoiceCloneManager'
import { useNotificationStore } from '../store/useNotificationStore'

// [NEW] 子组件导入
import { NotificationCenter } from '../components/profile/NotificationCenter'
import { VocabularyOverlay } from '../components/profile/VocabularyOverlay'
import { SettingsOverlay } from '../components/profile/SettingsOverlay'
import { StatsMatrix } from '../components/profile/StatsMatrix'
import { ProfileIdentity } from '../components/profile/ProfileIdentity'
import { RoundedStar } from '../components/RoundedStar'

interface ProfileProps {
  onNavigate?: (page: Page) => void
  onPostSelect?: (post: Post) => void
}


const Profile: React.FC<ProfileProps> = ({ onNavigate, onPostSelect }) => {
  const { profile, fetchProfile, updateProfile, setTtsVoice, setTtsParams, clearVoiceClone } = useUserStore()
  const { logout } = useAuthStore()
  const { likedPosts, viewHistory } = useHistoryStore()
  const { starredWords, fetchStarredWords } = useVocabularyStore()
  const { scrollPos, setScrollPos } = useProfileStore()
  const { theme, toggleTheme } = useThemeStore()
  const { speak } = useTTS()
  const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites')

  // [优化] UI 状态
  const [showSettings, setShowSettings] = useState(false)
  const [showVocabularyOverlay, setShowVocabularyOverlay] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [viewingWord, setViewingWord] = useState<string | null>(null)
  const [viewingDefinition, setViewingDefinition] = useState<any>(null)
  const [viewingWordContext, setViewingWordContext] = useState<string>('')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useNotificationStore(state => state.fetchNotifications)
  const subscribeRealtime = useNotificationStore(state => state.subscribeRealtime)

  useEffect(() => {
    fetchProfile(true)
    fetchStarredWords()
    fetchNotifications()
    const unsubscribe = subscribeRealtime()
    return () => unsubscribe()
  }, [])

  // 计算等级相关数据
  const userLevel = profile ? Math.floor(Math.sqrt((profile.total_xp || 0) / 100)) + 1 : 1
  const currentXP = profile?.total_xp || 0
  const nextLevelXP = Math.pow(userLevel, 2) * 100
  const prevLevelXP = Math.pow(userLevel - 1, 2) * 100
  const progressPercent = Math.min(100, Math.max(0, ((currentXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100))

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPos(e.currentTarget.scrollTop)
  }

  const handleWordClick = async (word: any) => {
    setViewingWord(word.word)
    let updatedWord = { ...word }
    if (!word.contexts || word.contexts.length === 0) {
      const contexts = await useVocabularyStore.getState().fetchWordContext(word.word)
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

  return (
    <div className="h-full w-full flex flex-col overflow-hidden select-none overscroll-x-none transition-colors duration-300 bg-[#FDFCFB] dark:bg-[#0B0A09] text-gray-900 dark:text-gray-100 relative">
      <WordDetailOverlay
        word={viewingWord}
        definition={viewingDefinition}
        context={viewingWordContext}
        onClose={() => setViewingWord(null)}
        hideContextMeaning={true}
      />

      <div className="frost-overlay"></div>
      <div className="blob-pastel -top-20 -left-20 bg-[#FFEDD5] dark:bg-orange-500/20 opacity-60 dark:opacity-40"></div>
      <div className="blob-pastel top-1/4 -right-40 bg-[#FED7AA] dark:bg-red-500/10 opacity-60 dark:opacity-30"></div>
      <div className="blob-pastel -bottom-20 -left-20 bg-[#FFEDD5] dark:bg-orange-500/10 opacity-60 dark:opacity-30"></div>

      <header className="relative z-50 flex items-center justify-between px-5 pt-[calc(max(0.75rem,env(safe-area-inset-top))+clamp(0.4rem,15vh-7.5rem,2.5rem))] pb-[clamp(0.4rem,1.5vh,1rem)] shrink-0 transition-all duration-500 max-w-lg mx-auto w-full">
        <NotificationCenter />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 dark:bg-orange-500/20 rounded-full border border-orange-400/20 shadow-sm transition-all active:scale-95">
            <span className="text-[12px] font-black text-orange-600 dark:text-orange-400">{profile?.coins || 0}</span>
            <img src={getAssetPath('/dopa_coin.png')} className="w-4 h-4 object-contain" alt="Dopa Coin" />
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="h-[clamp(2.2rem,5.5vh,2.75rem)] w-[clamp(2.2rem,5.5vh,2.75rem)] flex items-center justify-center bg-gray-100 dark:bg-white/10 backdrop-blur-xl rounded-[clamp(0.8rem,1.8vh,1.2rem)] border-2 border-orange-400/20 active:scale-90 transition-transform shadow-lg group relative">
            <span className="material-symbols-outlined text-[clamp(18px,2.2vh,22px)] text-gray-800 dark:text-white/90 group-hover:text-orange-400">settings</span>
            {!useUserStore.getState().voiceDotDismissed && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-[#0B0A09] animate-pulse shadow-sm z-10" />
            )}
          </button>
        </div>
      </header>

      <main
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative z-10 flex-1 overflow-y-auto no-scrollbar scroll-smooth overscroll-x-none">
        <ProfileIdentity profile={profile} userLevel={userLevel} />
        <StatsMatrix
          starredWordsCount={starredWords.length}
          wordsCount={profile?.words_count || 0}
          currentXP={currentXP}
          currentStreak={profile?.current_streak || 0}
          userLevel={userLevel}
          nextLevelXP={nextLevelXP}
          progressPercent={progressPercent}
          onVocabularyClick={() => setShowVocabularyOverlay(true)}
        />

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

      <SettingsOverlay
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        logout={logout}
        theme={theme as any}
        toggleTheme={toggleTheme}
        profile={profile}
        updateProfile={updateProfile}
        setTtsVoice={setTtsVoice}
        setTtsParams={setTtsParams}
        clearVoiceClone={clearVoiceClone}
        speak={speak}
        setShowCloneModal={setShowCloneModal}
      />

      <VocabularyOverlay
        isOpen={showVocabularyOverlay}
        onClose={() => setShowVocabularyOverlay(false)}
        starredWords={starredWords}
        onWordClick={handleWordClick}
      />

      <AnimatePresence>
        {showCloneModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCloneModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <div className="relative z-10 w-full max-w-md mx-auto">
              <VoiceCloneManager
                onClose={() => setShowCloneModal(false)}
                onSuccess={() => {
                  setShowCloneModal(false)
                  setTtsVoice('cloned')
                }}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .glass-card-premium {
            background: rgba(255, 255, 255, 0.65);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.8);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.04);
            border-radius: 1.25rem;
        }
        .dark .glass-card-premium {
            background: rgba(30, 30, 32, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.06);
            backdrop-filter: blur(20px);
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
