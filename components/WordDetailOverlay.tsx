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
  onClose: () => void
  onSave?: (word: string) => void
}

type Accent = 'US' | 'UK'

const WordDetailOverlay: React.FC<WordDetailOverlayProps> = ({
  word,
  definition,
  onClose,
  onSave,
}) => {
  const { toggleStarWord, isWordStarred } = useUserStore()
  const isSaved = word ? isWordStarred(word) : false
  const { forgetWord } = useDictionaryStore()

  // TTS 状态
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([])
  const [accent, setAccent] = useState<Accent>('US')
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)

  // 1. 修复电脑端 TTS：异步加载声音列表
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        setAvailableVoices(voices)
        // 调试用：看看浏览器到底支持哪些声音
        console.log(
          'Available Voices:',
          voices.map((v) => `${v.name} (${v.lang})`),
        )
      }
    }

    loadVoices()

    // Chrome/Edge 需要监听此事件才能获取到声音列表
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [])

  if (!word) return null

  const handleSave = () => {
    if (navigator.vibrate) navigator.vibrate(50)
    if (word && definition) {
      toggleStarWord(definition)
    }
  }

  // --- 核心修复：更智能的声音匹配逻辑 ---
  const getBestVoice = (targetAccent: Accent) => {
    // 统一将目标转换为 ISO 格式 (en-US / en-GB)
    const targetLang = targetAccent === 'US' ? 'en-US' : 'en-GB'

    // 辅助函数：标准化语言代码 (把 en_US 变成 en-US)
    const normalize = (lang: string) => lang.replace('_', '-')

    // 1. 第一梯队：高质量神经网络语音 (Edge/Chrome/Safari 高级语音)
    // 关键词：Natural, Google, Siri, Premium, Enhanced
    const bestVoice = availableVoices.find(
      (v) =>
        normalize(v.lang) === targetLang &&
        (v.name.includes('Natural') || // Edge
          v.name.includes('Google') || // Chrome
          v.name.includes('Siri') || // Apple
          v.name.includes('Premium') || // Apple
          v.name.includes('Enhanced')), // Apple
    )

    if (bestVoice) return bestVoice

    // 2. 第二梯队：只要语言代码匹配就行
    const exactLangVoice = availableVoices.find(
      (v) => normalize(v.lang) === targetLang,
    )
    if (exactLangVoice) return exactLangVoice

    // 3. 第三梯队：同语言系的任何声音 (比如找不到 en-GB 就找 en-US 顶替，总比没有好)
    // 但为了区分口音，这里我们尽量不混用，除非真的找不到
    return availableVoices.find((v) => normalize(v.lang).startsWith('en'))
  }

  const handlePlayAudio = (targetAccent?: Accent) => {
    if (!word) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(word)
    // [修复] 使用传入的口音或当前状态的口音
    const voice = getBestVoice(targetAccent || accent)

    if (voice) {
      utterance.voice = voice
      // 电脑端某些神经语音语速较快，稍微调慢一点更像字典发音
      utterance.rate = 0.9
      console.log(`Using voice: ${voice.name} (${voice.lang}) for ${targetAccent || accent}`)
    } else {
      console.warn('No suitable voice found, using system default.')
    }

    window.speechSynthesis.speak(utterance)
  }

  const handleForget = () => {
    if (navigator.vibrate) navigator.vibrate(20)
    forgetWord(word)
    onClose()
  }

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center transition-colors"
        onClick={(e) => {
          // 点击背景关闭弹窗和下拉菜单
          setShowVoiceSettings(false)
          onClose()
        }}>
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-white dark:bg-[#1C1C1E] border-t sm:border border-gray-200 dark:border-white/10 sm:rounded-2xl rounded-t-[2rem] p-6 shadow-2xl relative overflow-hidden transition-colors duration-300"
          onClick={(e) => e.stopPropagation()}>
          {/* 装饰背景 - 增强版 */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-green-500/10 to-orange-500/10 dark:from-green-500/20 dark:to-orange-500/20 blur-[60px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-orange-500/5 to-green-500/5 dark:from-orange-500/10 dark:to-green-500/10 blur-[50px] rounded-full pointer-events-none" />

          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-1 capitalize">
                  {word}
                </h2>
                <button
                  onClick={() => handlePlayAudio()}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-green-500/10 to-green-600/10 dark:from-green-500/20 dark:to-green-600/20 text-green-600 dark:text-green-400 border border-green-500/20 active:scale-95 active:bg-green-500 active:text-white transition-all hover:shadow-lg hover:shadow-green-500/20">
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
                {/* [重新设计] 语音选择器 - 点击弹出菜单 */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowVoiceSettings(!showVoiceSettings)
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-green-500/10 to-green-600/10 dark:from-green-500/20 dark:to-green-600/20 border border-green-500/30 dark:border-green-500/20 hover:from-green-500/20 hover:to-green-600/20 transition-all active:scale-95 group">
                    <span className="text-[11px] font-bold text-green-600 dark:text-green-400">
                      {accent === 'US' ? '🇺🇸 US' : '🇬🇧 UK'}
                    </span>
                    <span className={`material-symbols-outlined text-[14px] text-green-600 dark:text-green-400 transition-transform duration-200 ${showVoiceSettings ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>

                  {/* 下拉菜单 - 向上弹出避免遮挡 */}
                  {showVoiceSettings && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-full mb-1 left-0 bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-white/10 rounded-xl p-1.5 flex flex-col gap-1 shadow-xl z-50 min-w-[100px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setAccent('US')
                          setShowVoiceSettings(false)
                          setTimeout(() => handlePlayAudio('US'), 50)
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-all ${accent === 'US' ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-md' : 'text-gray-700 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                        <span>🇺🇸 US</span>
                        {accent === 'US' && (
                          <span className="material-symbols-outlined text-[14px]">
                            check
                          </span>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setAccent('UK')
                          setShowVoiceSettings(false)
                          setTimeout(() => handlePlayAudio('UK'), 50)
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-all ${accent === 'UK' ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-md' : 'text-gray-700 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                        <span>🇬🇧 UK</span>
                        {accent === 'UK' && (
                          <span className="material-symbols-outlined text-[14px]">
                            check
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 relative">
              {/* 移除语音设置面板,改为内联按钮 */}

              {/* Removed: 设置按钮 */}
              {/*
              <button
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 border ${showVoiceSettings ? 'bg-gray-200 dark:bg-white/20 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/40 border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-white/10'}`}>
                <span className="material-symbols-outlined text-[20px]">
                  settings_voice
                </span>
              </button>
              */}

              <button
                onClick={handleForget}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/40 border border-gray-200 dark:border-white/5 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-all active:scale-90">
                <span className="material-symbols-outlined text-[22px]">
                  visibility_off
                </span>
              </button>

              <button
                onClick={handleSave}
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 border
                  ${isSaved
                    ? 'bg-green-600 text-white border-green-600 shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/40 border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-white/10'
                  }
                `}>
                <span className="material-symbols-outlined text-[24px] fill-current">
                  {isSaved ? 'bookmark' : 'bookmark_border'}
                </span>
              </button>
            </div>
          </div>

          {/* 释义内容区域 */}
          <div className="space-y-4 relative z-10 max-h-[60vh] overflow-y-auto no-scrollbar">
            {definition ? (
              <>
                <div className="p-5 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-600/5 dark:from-green-500/20 dark:to-green-600/10 border border-green-500/30 dark:border-green-500/20 shadow-lg shadow-green-500/5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-green-600 dark:text-green-400 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">
                      radar
                    </span>
                    Context Meaning
                  </h4>
                  <p className="text-gray-900 dark:text-white text-[17px] font-bold leading-relaxed mb-2">
                    {definition.context_meaning_cn}
                  </p>
                  <p className="text-gray-600 dark:text-white/60 text-[14px] leading-relaxed">
                    {definition.context_meaning_en}
                  </p>
                </div>

                {definition.roots && (
                  <div className="px-5 py-4 rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-600/5 dark:from-orange-500/20 dark:to-orange-600/10 border border-orange-500/30 dark:border-orange-500/20 shadow-lg shadow-orange-500/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">
                        account_tree
                      </span>
                      Etymology
                    </h4>
                    <p className="text-orange-700 dark:text-orange-300 font-mono text-sm font-medium">
                      {definition.roots}
                    </p>
                  </div>
                )}

                <div className="px-5 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/40 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">
                      book
                    </span>
                    Dictionary
                  </h4>
                  <div className="space-y-3">
                    <p className="text-gray-800 dark:text-gray-200 text-[15px] font-semibold leading-relaxed">
                      <span className="text-gray-400 dark:text-white/40 text-xs mr-2 font-bold">
                        CN
                      </span>
                      {definition.definition_cn}
                    </p>
                    <div className="h-[1px] bg-gradient-to-r from-transparent via-gray-300 dark:via-white/10 to-transparent" />
                    <p className="text-gray-600 dark:text-gray-400 text-[14px] italic leading-relaxed">
                      <span className="text-gray-400 dark:text-white/40 text-xs mr-2 not-italic font-bold">
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
