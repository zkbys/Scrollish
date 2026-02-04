import React, { useMemo, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDictionaryStore } from '../store/useDictionaryStore'
import { useUserStore } from '../store/useUserStore'
import WordDetailOverlay from '../components/WordDetailOverlay'
import { IMAGES } from '../constants'

const Study: React.FC = () => {
  const {
    userInteractions,
    cachedDefinitions,
    syncInteractions,
    getDefinition,
    preferredVoice,
    setPreferredVoice,
  } = useDictionaryStore()
  const { currentUser } = useUserStore()

  const [showSettings, setShowSettings] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([])
  const [viewingWord, setViewingWord] = useState<string | null>(null)
  const [viewingContext, setViewingContext] = useState<string | undefined>(
    undefined,
  )

  useEffect(() => {
    syncInteractions()
    const loadVoices = () => {
      const voices = window.speechSynthesis
        .getVoices()
        .filter((v) => v.lang.startsWith('en'))
      setAvailableVoices(voices)
    }
    loadVoices()
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [])

  const wordsCollected = useMemo(() => {
    return Object.values(userInteractions).filter((i) => i.isSaved).length
  }, [userInteractions])

  const totalInteractions = useMemo(() => {
    return Object.values(userInteractions).reduce(
      (acc, curr) => acc + curr.count,
      0,
    )
  }, [userInteractions])

  const savedWords = useMemo(() => {
    return Object.entries(userInteractions)
      .filter(([_, data]) => data.isSaved)
      .map(([word, data]) => ({
        word,
        count: data.count,
        lastUpdated: data.lastUpdated,
        context: data.savedContext,
        def: cachedDefinitions[word]?.definition_cn || 'Review pending...',
      }))
      .sort((a, b) => b.lastUpdated - a.lastUpdated)
  }, [userInteractions, cachedDefinitions])

  const handleTestVoice = (voice: SpeechSynthesisVoice) => {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(`Hello, this is ${voice.name}`)
    u.voice = voice
    window.speechSynthesis.speak(u)
    setPreferredVoice({ lang: voice.lang, name: voice.name })
  }

  const openWordDetail = (word: string, context?: string) => {
    setViewingWord(word)
    setViewingContext(context)
  }

  return (
    // 修复：背景色 + 底部内边距
    <div className="h-full flex flex-col bg-background-light dark:bg-background-dark overflow-y-auto no-scrollbar pb-32 relative transition-colors duration-300">
      <AnimatePresence>
        {viewingWord && (
          <WordDetailOverlay
            word={viewingWord}
            definition={getDefinition(viewingWord)}
            context={viewingContext}
            onClose={() => setViewingWord(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[90] backdrop-blur-sm"
              onClick={() => setShowSettings(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[100] bg-white dark:bg-[#1C1C1E] rounded-t-[2rem] p-6 max-h-[70vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-gray-900 dark:text-white">
                  Voice Settings
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                {availableVoices.map((voice, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleTestVoice(voice)}
                    className={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${
                      preferredVoice?.name === voice.name
                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                        : 'bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}>
                    <div className="flex flex-col items-start">
                      <span className="font-bold text-sm truncate max-w-[240px]">
                        {voice.name}
                      </span>
                      <span
                        className={`text-xs ${preferredVoice?.name === voice.name ? 'text-white/70' : 'text-gray-400'}`}>
                        {voice.lang}
                      </span>
                    </div>
                    {preferredVoice?.name === voice.name && (
                      <span className="material-symbols-outlined">
                        check_circle
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-20 flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 pb-2 justify-between transition-colors">
        <div className="flex size-12 shrink-0 items-center">
          <div
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-white shadow-md"
            style={{
              backgroundImage: `url("${currentUser?.avatar_url || IMAGES.avatar1}")`,
            }}
          />
        </div>
        <h2 className="text-gray-900 dark:text-white text-lg font-black flex-1 text-center tracking-tight">
          My Space
        </h2>
        <button
          onClick={() => setShowSettings(true)}
          className="flex size-10 items-center justify-center rounded-full bg-white dark:bg-[#1C1C1E] shadow-sm text-gray-700 dark:text-white border border-gray-100 dark:border-white/5 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-xl">settings</span>
        </button>
      </header>

      <div className="px-4 pt-4 flex gap-3">
        <div className="flex-1 rounded-[1.5rem] p-5 bg-[#E0F7FA] dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-400/20 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-cyan-600 dark:text-cyan-400 text-xl">
                school
              </span>
              <p className="text-cyan-800 dark:text-cyan-200 text-xs font-bold uppercase tracking-wider">
                Collected
              </p>
            </div>
            <p className="text-cyan-900 dark:text-white tracking-tight text-3xl font-black">
              {wordsCollected}
            </p>
          </div>
        </div>

        <div className="flex-1 rounded-[1.5rem] p-5 bg-[#FFF3E0] dark:bg-orange-900/20 border border-orange-100 dark:border-orange-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-400/20 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-orange-600 dark:text-orange-400 text-xl">
                ads_click
              </span>
              <p className="text-orange-800 dark:text-orange-200 text-xs font-bold uppercase tracking-wider">
                Interactions
              </p>
            </div>
            <p className="text-orange-900 dark:text-white tracking-tight text-3xl font-black">
              {totalInteractions}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-8">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-gray-900 dark:text-white text-xl font-black tracking-tight flex items-center gap-2">
            <span className="text-2xl">🎒</span> Treasure Bag
          </h3>
          <span className="bg-gray-100 dark:bg-white/10 px-3 py-1 rounded-full text-xs font-bold text-gray-500 dark:text-white/50">
            {savedWords.length} items
          </span>
        </div>

        <div className="grid gap-3">
          {savedWords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#1C1C1E] rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-white/5">
              <span className="text-6xl mb-4 opacity-50">💎</span>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                No treasures yet
              </p>
            </div>
          ) : (
            savedWords.map((item, i) => (
              <motion.div
                key={item.word}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => openWordDetail(item.word, item.context)}
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-white/5 flex flex-col gap-2 relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]">
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${['bg-pink-400', 'bg-purple-400', 'bg-blue-400', 'bg-green-400', 'bg-yellow-400'][i % 5]}`}
                />

                <div className="flex justify-between items-start pl-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-black text-gray-900 dark:text-white capitalize">
                        {item.word}
                      </h4>
                      {item.count > 3 && (
                        <span className="bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Hot
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-white/60 font-medium line-clamp-1 mt-0.5">
                      {item.def}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center">
                    <span className="material-symbols-outlined text-gray-400 text-[20px]">
                      chevron_right
                    </span>
                  </div>
                </div>

                {item.context && (
                  <div className="ml-3 mt-1 p-2 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic line-clamp-2 leading-relaxed">
                      "{item.context}"
                    </p>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Study
