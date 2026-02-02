import React, { useState, useEffect, useMemo } from 'react'
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

  const getBestVoice = (targetAccent: Accent) => {
    const langCode = targetAccent === 'US' ? 'en-US' : 'en-GB'

    // 优先级 1: 微软/谷歌的高级神经语音 (Edge/Chrome 特有)
    // 优先级 2: 匹配语言代码的本地语音
    return (
      availableVoices.find(
        (v) =>
          v.lang === langCode &&
          (v.name.includes('Natural') || v.name.includes('Google')),
      ) ||
      availableVoices.find((v) => v.lang === langCode) ||
      availableVoices.find((v) => v.lang.startsWith('en'))
    ) // 兜底
  }

  const handlePlayAudio = () => {
    if (!word) return

    // 这是一个防抖操作，防止连续点击导致声音堆叠
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(word)
    const voice = getBestVoice(accent)

    if (voice) {
      utterance.voice = voice
      // 电脑端某些声音语速较快，稍微调慢一点更像字典发音
      utterance.rate = 0.85
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
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}>
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-[#1C1C1E] border-t sm:border border-white/10 sm:rounded-2xl rounded-t-[2rem] p-6 shadow-2xl relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}>
          {/* 装饰背景 */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-[50px] rounded-full pointer-events-none" />

          {/* 头部区域 */}
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-3xl font-black text-white tracking-tight mb-1 capitalize">
                  {word}
                </h2>
                <button
                  onClick={handlePlayAudio}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/80 active:bg-green-500 active:text-white transition-colors hover:bg-white/20">
                  <span className="material-symbols-outlined text-[20px]">
                    volume_up
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-3 text-white/40 text-sm font-medium font-mono">
                {definition ? (
                  <span>{definition.ipa}</span>
                ) : (
                  <span className="animate-pulse">Analyzing...</span>
                )}
                {/* 显示当前口音标记 */}
                <span
                  className="text-[10px] bg-white/5 px-1.5 rounded border border-white/5 cursor-pointer hover:bg-white/10"
                  onClick={() => setShowVoiceSettings(!showVoiceSettings)}>
                  {accent}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              {/* 发音设置切换面板 (简单版) */}
              {showVoiceSettings && (
                <div className="absolute top-0 right-14 bg-[#2C2C2E] border border-white/10 rounded-xl p-2 flex flex-col gap-1 shadow-xl animate-in fade-in zoom-in-95 duration-200 z-50">
                  <button
                    onClick={() => {
                      setAccent('US')
                      setShowVoiceSettings(false)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 ${accent === 'US' ? 'bg-green-600 text-white' : 'text-white/60 hover:bg-white/5'}`}>
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 ${accent === 'UK' ? 'bg-green-600 text-white' : 'text-white/60 hover:bg-white/5'}`}>
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
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 border ${showVoiceSettings ? 'bg-white/20 border-white/20 text-white' : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'}`}>
                <span className="material-symbols-outlined text-[20px]">
                  settings_voice
                </span>
              </button>

              <button
                onClick={handleForget}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 text-white/40 border border-white/5 hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/30 transition-all active:scale-90">
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
                      : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'
                  }
                `}>
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
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">
                      radar
                    </span>
                    Context Meaning
                  </h4>
                  <p className="text-white text-[16px] font-bold leading-relaxed">
                    {definition.context_meaning_cn}
                  </p>
                  <p className="text-white/60 text-[13px] mt-1 leading-relaxed">
                    {definition.context_meaning_en}
                  </p>
                </div>

                {definition.roots && (
                  <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">
                        account_tree
                      </span>
                      Etymology
                    </h4>
                    <p className="text-orange-300 font-mono text-sm">
                      {definition.roots}
                    </p>
                  </div>
                )}

                <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">
                    Dictionary
                  </h4>
                  <div className="space-y-2">
                    <p className="text-gray-300 text-sm font-medium">
                      <span className="text-white/40 text-xs mr-2">CN</span>
                      {definition.definition_cn}
                    </p>
                    <div className="h-[1px] bg-white/5" />
                    <p className="text-gray-400 text-sm italic">
                      <span className="text-white/40 text-xs mr-2 not-italic">
                        EN
                      </span>
                      {definition.definition_en}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3 animate-pulse">
                <div className="h-24 bg-white/5 rounded-xl" />
                <div className="h-12 bg-white/5 rounded-xl" />
                <div className="h-16 bg-white/5 rounded-xl" />
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
