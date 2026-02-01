import React, { useState } from 'react'
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

const WordDetailOverlay: React.FC<WordDetailOverlayProps> = ({
  word,
  definition,
  onClose,
  onSave,
}) => {
  const [isSaved, setIsSaved] = useState(false)
  const { forgetWord } = useDictionaryStore()

  if (!word) return null

  const handleSave = () => {
    if (navigator.vibrate) navigator.vibrate(50)
    setIsSaved(!isSaved)
    if (onSave && !isSaved) onSave(word)
  }

  const handlePlayAudio = () => {
    // 关键修复：先取消之前的，防止阻塞
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    utterance.rate = 0.8
    window.speechSynthesis.speak(utterance)
  }

  const handleForget = () => {
    if (navigator.vibrate) navigator.vibrate(20)
    forgetWord(word)
    onClose() // 移除后直接关闭弹窗
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
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/80 active:bg-green-500 active:text-white transition-colors">
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
              </div>
            </div>

            <div className="flex gap-2">
              {/* 新增：移除高亮按钮 */}
              <button
                onClick={handleForget}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 text-white/40 border border-white/5 hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/30 transition-all active:scale-90"
                title="Remove Highlight">
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

          {/* 内容区域 */}
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
