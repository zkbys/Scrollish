import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DictionaryResult,
  useDictionaryStore,
} from '../store/useDictionaryStore'

interface WordDetailOverlayProps {
  word: string | null
  definition?: DictionaryResult | null
  context?: string
  onClose: () => void
  onSave?: (word: string) => void
}

const WordDetailOverlay: React.FC<WordDetailOverlayProps> = ({
  word,
  definition,
  context,
  onClose,
  onSave,
}) => {
  const { forgetWord, toggleSaveWord, getInteraction, preferredVoice } =
    useDictionaryStore()
  const [isSaved, setIsSaved] = useState(false)

  // 同步收藏状态
  useEffect(() => {
    if (word) {
      const interaction = getInteraction(word)
      setIsSaved(interaction.isSaved)
    }
  }, [word, getInteraction])

  const handleSave = async () => {
    if (!word) return
    if (navigator.vibrate) navigator.vibrate(50)

    const newState = !isSaved
    setIsSaved(newState)
    await toggleSaveWord(word, context)

    if (onSave && newState) onSave(word)
  }

  // --- 修复：发音逻辑 ---
  const handlePlayAudio = () => {
    if (!word) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word)

    // 1. 尝试获取声音列表 (Chrome 有时需要重新获取)
    let voices = window.speechSynthesis.getVoices()

    // 2. 如果设置了首选声音，尝试匹配
    if (preferredVoice) {
      const selected = voices.find(
        (v) => v.name === preferredVoice.name && v.lang === preferredVoice.lang,
      )
      if (selected) {
        utterance.voice = selected
        // 电脑端某些神经语音语速较快，稍微调慢
        utterance.rate = 0.9
      } else {
        // 如果找不到首选声音，尝试找同语言的
        const fallback = voices.find((v) => v.lang === preferredVoice.lang)
        if (fallback) utterance.voice = fallback
      }
    }

    window.speechSynthesis.speak(utterance)
  }

  const handleForget = () => {
    if (navigator.vibrate) navigator.vibrate(20)
    if (word) forgetWord(word)
    onClose()
  }

  if (!word) return null

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center transition-colors"
        onClick={onClose}>
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-white dark:bg-[#1C1C1E] border-t sm:border border-gray-200 dark:border-white/10 sm:rounded-2xl rounded-t-[2rem] p-6 shadow-2xl relative overflow-hidden transition-colors duration-300"
          onClick={(e) => e.stopPropagation()}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 dark:bg-green-500/10 blur-[50px] rounded-full pointer-events-none" />

          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-1 capitalize">
                  {word}
                </h2>
                <button
                  onClick={handlePlayAudio}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/80 active:bg-green-500 active:text-white transition-colors hover:bg-gray-200 dark:hover:bg-white/20">
                  <span className="material-symbols-outlined text-[20px]">
                    volume_up
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-3 text-gray-500 dark:text-white/40 text-sm font-medium font-mono">
                {definition ? (
                  <span>{definition.ipa}</span>
                ) : (
                  <span className="animate-pulse">Analyzing...</span>
                )}
              </div>
            </div>

            <div className="flex gap-2 relative">
              <button
                onClick={handleForget}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/40 border border-gray-200 dark:border-white/5 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-all active:scale-90">
                <span className="material-symbols-outlined text-[22px]">
                  visibility_off
                </span>
              </button>

              <button
                onClick={handleSave}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 border ${
                  isSaved
                    ? 'bg-green-600 text-white border-green-600 shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/40 border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-white/10'
                }`}>
                <span className="material-symbols-outlined text-[24px] fill-current">
                  {isSaved ? 'bookmark' : 'bookmark_border'}
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-4 relative z-10 max-h-[60vh] overflow-y-auto no-scrollbar">
            {definition ? (
              <>
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-green-600 dark:text-green-500 mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">
                      radar
                    </span>{' '}
                    Context Meaning
                  </h4>
                  <p className="text-gray-900 dark:text-white text-[16px] font-bold leading-relaxed">
                    {definition.context_meaning_cn}
                  </p>
                  <p className="text-gray-600 dark:text-white/60 text-[13px] mt-1 leading-relaxed">
                    {definition.context_meaning_en}
                  </p>
                </div>

                {context && (
                  <div className="px-4 py-3 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">
                        format_quote
                      </span>
                      Source Context
                    </h4>
                    <p className="text-gray-700 dark:text-white/80 text-sm italic font-medium leading-relaxed">
                      "{context}"
                    </p>
                  </div>
                )}

                {definition.roots && (
                  <div className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/30 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">
                        account_tree
                      </span>{' '}
                      Etymology
                    </h4>
                    <p className="text-orange-600 dark:text-orange-300 font-mono text-sm">
                      {definition.roots}
                    </p>
                  </div>
                )}

                <div className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/30 mb-2">
                    Dictionary
                  </h4>
                  <div className="space-y-2">
                    <p className="text-gray-800 dark:text-gray-300 text-sm font-medium">
                      <span className="text-gray-400 dark:text-white/40 text-xs mr-2">
                        CN
                      </span>
                      {definition.definition_cn}
                    </p>
                    <div className="h-[1px] bg-gray-200 dark:bg-white/5" />
                    <p className="text-gray-600 dark:text-gray-400 text-sm italic">
                      <span className="text-gray-400 dark:text-white/40 text-xs mr-2 not-italic">
                        EN
                      </span>
                      {definition.definition_en}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3 animate-pulse">
                <div className="h-24 bg-gray-200 dark:bg-white/5 rounded-xl" />
                <div className="h-12 bg-gray-200 dark:bg-white/5 rounded-xl" />
                <div className="h-16 bg-gray-200 dark:bg-white/5 rounded-xl" />
              </div>
            )}
          </div>
          <div className="h-6" />
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default WordDetailOverlay
