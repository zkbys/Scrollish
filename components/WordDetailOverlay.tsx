import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserStore } from '../store/useUserStore'
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
  hideContextMeaning?: boolean
}

type Accent = 'US' | 'UK'

const WordDetailOverlay: React.FC<WordDetailOverlayProps> = ({
  word,
  definition,
  context,
  onClose,
  onSave,
  hideContextMeaning = false,
}) => {
  const { toggleStarWord, isWordStarred } = useUserStore()
  const { triggerAnalysis, isAnalyzing, cachedDefinitions } = useDictionaryStore()
  const isSaved = word ? isWordStarred(word) : false
  const currentDefinition = definition || null
  const { forgetWord } = useDictionaryStore()

  // TTS 状态
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([])
  const [accent, setAccent] = useState<Accent>('US')
  const [showDopaHint, setShowDopaHint] = useState(false)

  // 1. 修复电脑端 TTS：异步加载声音列表 (带安全检查)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    const loadVoices = () => {
      try {
        const voices = window.speechSynthesis.getVoices()
        if (voices.length > 0) {
          setAvailableVoices(voices)
        }
      } catch (e) {
        console.warn('Failed to get voices:', e)
      }
    }

    loadVoices()
    try {
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices
      }
    } catch (e) {
      console.warn('Failed to set onvoiceschanged:', e)
    }
  }, [])

  if (!word) return null

  const handleSave = () => {
    if (navigator.vibrate) navigator.vibrate(50)
    if (word && currentDefinition) {
      toggleStarWord(currentDefinition)
    }
  }

  const getBestVoice = (targetAccent: Accent) => {
    const targetLang = targetAccent === 'US' ? 'en-US' : 'en-GB'
    const normalize = (lang: string) => lang.replace('_', '-')
    const bestVoice = availableVoices.find(
      (v) =>
        normalize(v.lang) === targetLang &&
        (v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Siri') ||
          v.name.includes('Premium') ||
          v.name.includes('Enhanced')),
    )
    if (bestVoice) return bestVoice
    const exactLangVoice = availableVoices.find(
      (v) => normalize(v.lang) === targetLang,
    )
    if (exactLangVoice) return exactLangVoice
    return availableVoices.find((v) => normalize(v.lang).startsWith('en'))
  }

  const handlePlayAudio = (targetAccent?: Accent) => {
    if (!word || typeof window === 'undefined' || !window.speechSynthesis) return
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(word)
      const voice = getBestVoice(targetAccent || accent)
      if (voice) {
        utterance.voice = voice
        utterance.rate = 0.9
      }
      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.error('Speech Synthesis Error:', e)
    }
  }

  const handleForget = () => {
    if (navigator.vibrate) navigator.vibrate(20)
    forgetWord(word)
    onClose()
  }

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] bg-black/10 dark:bg-black/30 backdrop-blur-[2px] flex items-end sm:items-center justify-center"
        onClick={onClose}>
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
          className="w-full max-w-lg overflow-visible px-2 pb-6 sm:pb-2"
          onClick={(e) => e.stopPropagation()}>

          <div className="relative citrus-glass citrus-card-shadow sm:rounded-[2rem] rounded-[2rem] p-5 border-none overflow-hidden isolate shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
            {/* 核心设计：杂志风格背景大字 */}
            <div className="magazine-bg-text text-orange-500 dark:text-orange-400 select-none">
              {word}
            </div>

            {/* 顶栏：词条与主操作 */}
            <div className="flex justify-between items-start mb-3 relative z-10">
              <div className="flex-1 pt-0">
                <motion.h2
                  layoutId="word-title"
                  className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter mb-2 capitalize leading-none drop-shadow-sm">
                  {word}
                </motion.h2>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-white/60 dark:bg-white/5 rounded-full border border-black/5 dark:border-white/10 backdrop-blur-md">
                    <span className={`text-sm font-black font-mono tracking-tight ${!currentDefinition ? 'text-orange-500/40 animate-pulse' : 'text-gray-500 dark:text-white/40'}`}>
                      {currentDefinition ? currentDefinition.ipa : (isAnalyzing(word, context || '') ? 'Parsing IPA...' : '/.../')}
                    </span>
                  </div>

                  {/* 口音药丸 */}
                  <div className="flex items-center gap-1 p-1.5 bg-black/5 dark:bg-white/10 rounded-full border border-black/5 dark:border-white/5 backdrop-blur-xl">
                    <button
                      onClick={() => { setAccent('US'); handlePlayAudio('US'); }}
                      className={`px-4 py-1 rounded-full text-[10px] font-black tracking-widest transition-all duration-300 ${accent === 'US' ? 'bg-orange-500 text-white shadow-[0_4px_12px_rgba(249,115,22,0.4)]' : 'text-gray-400 dark:text-white/20'}`}>
                      US
                    </button>
                    <button
                      onClick={() => { setAccent('UK'); handlePlayAudio('UK'); }}
                      className={`px-4 py-1 rounded-full text-[10px] font-black tracking-widest transition-all duration-300 ${accent === 'UK' ? 'bg-orange-500 text-white shadow-[0_4px_12px_rgba(249,115,22,0.4)]' : 'text-gray-400 dark:text-white/20'}`}>
                      UK
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <button
                  onClick={handleSave}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 active:scale-90 border shadow-lg ${isSaved ? 'bg-green-500 text-white border-green-600 shadow-green-500/20' : 'bg-white/80 dark:bg-white/5 text-gray-400 dark:text-white/20 border-white/40 dark:border-white/10'}`}>
                  <span className="material-symbols-outlined text-[20px] fill-current">
                    {isSaved ? 'bookmark' : 'bookmark_border'}
                  </span>
                </button>
                <button
                  onClick={() => handlePlayAudio()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-500 text-white shadow-lg shadow-orange-500/20 active:scale-90 transition-all">
                  <span className="material-symbols-outlined text-[20px]">volume_up</span>
                </button>
              </div>
            </div>

            {/* 内容滚动区：悬浮波浪感 */}
            <div className="space-y-6 relative z-10 max-h-[55vh] overflow-y-auto no-scrollbar pb-3 pr-1">
              <AnimatePresence mode="popLayout">
                <div className="space-y-6">
                  {currentDefinition ? (
                    <>
                      {/* 情境王牌卡片 (语境翻译) - 仅在有内容且未明确隐藏时显示 */}
                      {currentDefinition.context_meaning_cn && !hideContextMeaning && (
                        <motion.div
                          initial={{ y: 30, opacity: 0, scale: 0.95 }}
                          animate={{ y: 0, opacity: 1, scale: 1 }}
                          className="group relative p-4 rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30 overflow-hidden ring-2 ring-white/10">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-[30px] rounded-full -mr-12 -mt-12 opacity-50" />
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2.5">
                              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/20 rounded-lg backdrop-blur-sm border border-white/10 shrink-0">
                                <span className="material-symbols-outlined text-white text-[12px] fill-current">auto_awesome</span>
                                <span className="text-[12px] font-black uppercase tracking-[0.05em] opacity-95">语境理解</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setShowDopaHint(!showDopaHint); }}
                                  className="w-4 h-4 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors shrink-0">
                                  <span className="material-symbols-outlined text-white text-[10px]">info</span>
                                </button>
                                <AnimatePresence>
                                  {showDopaHint && (
                                    <motion.div
                                      initial={{ width: 0, opacity: 0 }}
                                      animate={{ width: 'auto', opacity: 1 }}
                                      exit={{ width: 0, opacity: 0 }}
                                      className="overflow-hidden whitespace-nowrap">
                                      <p className="text-[9px] font-bold text-orange-200 leading-tight">
                                        这是小哆吧根据当前语境分析出来的哦
                                      </p>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>

                            <p className="text-xl font-black leading-tight mb-2 tracking-tight">
                              {currentDefinition.context_meaning_cn}
                            </p>
                            <p className="text-[12px] font-bold opacity-80 leading-relaxed italic bg-black/10 p-2.5 rounded-xl border border-white/10">
                              "{currentDefinition.context_meaning_en}"
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {/* 词典归档卡片 (字典/词书) - 仅在有内容时显示 */}
                      {currentDefinition.definition_cn && (
                        <motion.div
                          initial={{ y: 30, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="p-4 rounded-[2rem] bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 backdrop-blur-2xl shadow-xl space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-8 h-8 flex items-center justify-center bg-green-500/10 rounded-lg">
                              <span className="material-symbols-outlined text-green-500 text-[18px]">menu_book</span>
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">字典/词书</span>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-start gap-4">
                              <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-green-500/10 text-green-600 rounded-full text-[9px] font-black border border-green-500/20">CN</div>
                              <p className="text-gray-900 dark:text-gray-100 text-lg font-bold leading-snug pt-0.5">
                                {currentDefinition.definition_cn}
                              </p>
                            </div>
                            <div className="h-[1px] w-full bg-black/5 dark:bg-white/5" />
                            <div className="flex items-start gap-4">
                              <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-white/10 text-gray-400 rounded-full text-[9px] font-black border border-black/5 dark:border-white/10">EN</div>
                              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold leading-relaxed pt-0.5">
                                {currentDefinition.definition_en}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* 词源卡片 (词源) */}
                      {currentDefinition.roots && (
                        <motion.div
                          initial={{ y: 30, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="p-4 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 backdrop-blur-xl shadow-md">
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">词源</span>
                          </div>
                          <div className="font-mono text-[11px] font-bold leading-relaxed text-orange-700 dark:text-orange-300 py-2.5 px-3.5 bg-orange-500/5 rounded-2xl border border-orange-500/10">
                            {currentDefinition.roots}
                          </div>
                        </motion.div>
                      )}

                      {/* [新增] 单词博物馆 (多个语境历史) */}
                      {currentDefinition.contexts && currentDefinition.contexts.length > 0 && (
                        <motion.div
                          initial={{ y: 30, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="p-4 rounded-3xl bg-blue-500/5 dark:bg-white/5 border border-blue-500/20 dark:border-white/10 backdrop-blur-xl"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px] text-blue-500">history_edu</span>
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">遇见历史 (博物馆)</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[8px] font-black">{currentDefinition.contexts.length} SITES</span>
                          </div>
                          <div className="space-y-3">
                            {currentDefinition.contexts.map((ctx, idx) => (
                              <div key={idx} className="group/ctx">
                                <p className="text-[11px] font-bold text-gray-700 dark:text-white/80 leading-relaxed mb-1 italic">
                                  "{ctx.text}"
                                </p>
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-bold text-blue-500/60">{ctx.meaning || '查看语境义'}</span>
                                  <span className="text-[8px] font-medium text-gray-300 dark:text-white/10 pr-1">
                                    {new Date(ctx.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                {idx < (currentDefinition.contexts?.length || 0) - 1 && (
                                  <div className="mt-3 h-[1px] w-full bg-blue-500/10 dark:bg-white/5" />
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <div className="py-20 flex flex-col items-center justify-center gap-6">
                      <div className="relative w-20 h-20">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 border-[6px] border-orange-500/10 border-t-orange-500 rounded-full"
                        />
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute inset-4 bg-orange-500 rounded-full blur-xl opacity-20"
                        />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500/60 animate-pulse">Analyzing...</span>
                    </div>
                  )}
                </div>
              </AnimatePresence>
            </div>

            {/* 底部控制区域 */}
            <div className="relative z-10 flex justify-between items-center mt-3 pt-2 border-t border-black/5 dark:border-white/5">
              <button
                onClick={handleForget}
                className="py-2.5 px-4 rounded-full bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/20 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                取消划线
              </button>

              <button
                onClick={onClose}
                className="px-10 py-3 rounded-2xl bg-orange-500 text-white font-black text-[13px] shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
                关闭
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default WordDetailOverlay
