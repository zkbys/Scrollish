import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface WordDetailOverlayProps {
  word: string | null
  onClose: () => void
  onSave?: (word: string) => void
}

const WordDetailOverlay: React.FC<WordDetailOverlayProps> = ({
  word,
  onClose,
  onSave,
}) => {
  // 模拟一些状态，实际项目中这里可以接入 API 获取释义
  const [isSaved, setIsSaved] = useState(false)

  if (!word) return null

  const handleSave = () => {
    if (navigator.vibrate) navigator.vibrate(50)
    setIsSaved(!isSaved)
    if (onSave && !isSaved) onSave(word)
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
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-[50px] rounded-full pointer-events-none" />
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-1">
                {word}
              </h2>
              <div className="flex items-center gap-3 text-white/40 text-sm font-medium">
                <span>/uk · pəˈnʌn.si/</span>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="italic">noun</span>
              </div>
            </div>
            <button
              onClick={handleSave}
              className={`
                w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 border
                ${
                  isSaved
                    ? 'bg-orange-500 text-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]'
                    : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'
                }
              `}>
              <span className="material-symbols-outlined text-[24px] fill-current">
                {isSaved ? 'bookmark' : 'bookmark_border'}
              </span>
            </button>
          </div>
          <div className="space-y-4 relative z-10">
            {/* 模拟释义内容 */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <p className="text-gray-300 leading-relaxed font-medium">
                This is a mock definition for{' '}
                <span className="text-orange-400 font-bold">"{word}"</span>. In
                a real app, you would fetch the meaning from a dictionary API
                here.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">
                Example
              </h4>
              <p className="text-white/60 italic border-l-2 border-orange-500/50 pl-3">
                "The context of this word suggests a deeper meaning."
              </p>
            </div>
          </div>
          <div className="h-6" /> {/* Safe area */}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default WordDetailOverlay
