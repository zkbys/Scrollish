import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  const [isSaved, setIsSaved] = useState(false)
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
    setIsSaved(!isSaved)
    if (onSave && !isSaved) onSave(word)
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

  const handlePlayAudio = () => {
    if (!word) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(word)
    const voice = getBestVoice(accent)

    if (voice) {
      utterance.voice = voice
      // 电脑端某些神经语音语速较快，稍微调慢一点更像字典发音
      utterance.rate = 0.9
      console.log(`Using voice: ${voice.name} (${voice.lang})`)
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
        onClick={onClose}>
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-white dark:bg-[#1C1C1E] border-t sm:border border-gray-200 dark:border-white/10 sm:rounded-2xl rounded-t-[2rem] p-6 shadow-2xl relative overflow-hidden transition-colors duration-300"
          onClick={(e) => e.stopPropagation()}>
          {/* 装饰背景 */}
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
                {/* 显式显示当前口音，点击可切换 */}
                <span
                  className="text-[10px] bg-gray-100 dark:bg-white/5 px-1.5 rounded border border-gray-200 dark:border-white/5 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  onClick={() => setShowVoiceSettings(!showVoiceSettings)}>
                  {accent}
                </span>
              </div>
            </div>

            <div className="flex gap-2 relative">
              {/* 发音设置面板 */}
              {showVoiceSettings && (
                <div className="absolute top-12 right-0 bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-white/10 rounded-xl p-2 flex flex-col gap-1 shadow-xl animate-in fade-in zoom-in-95 duration-200 z-50 min-w-[100px]">
                  <button
                    onClick={() => {
                      setAccent('US')
                      setShowVoiceSettings(false)
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 ${accent === 'US' ? 'bg-green-600 text-white' : 'text-gray-700 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                    <span>🇺🇸 US</span>
                    {accent === 'US' && (
                      <span className="material-symbols-outlined text-[10px]">
                        check
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setAccent('UK')
                      setShowVoiceSettings(false)
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 ${accent === 'UK' ? 'bg-green-600 text-white' : 'text-gray-700 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                    <span>🇬🇧 UK</span>
                    {accent === 'UK' && (
                      <span className="material-symbols-outlined text-[10px]">
                        check
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* 设置按钮 */}
              <button
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 border ${showVoiceSettings ? 'bg-gray-200 dark:bg-white/20 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/40 border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-white/10'}`}>
                <span className="material-symbols-outlined text-[20px]">
                  settings_voice
                </span>
              </button>

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
                  ${
                    isSaved
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
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-green-600 dark:text-green-500 mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">
                      radar
                    </span>
                    Context Meaning
                  </h4>
                  <p className="text-gray-900 dark:text-white text-[16px] font-bold leading-relaxed">
                    {definition.context_meaning_cn}
                  </p>
                  <p className="text-gray-600 dark:text-white/60 text-[13px] mt-1 leading-relaxed">
                    {definition.context_meaning_en}
                  </p>
                </div>

                {definition.roots && (
                  <div className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/30 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">
                        account_tree
                      </span>
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
