import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface WordDetailOverlayProps {
  word: string | null
  definition?: string | null // 新增：接收真实释义
  onClose: () => void
  onSave?: (word: string) => void
}

const WordDetailOverlay: React.FC<WordDetailOverlayProps> = ({
  word,
  definition, // 获取传入的释义
  onClose,
  onSave,
}) => {
  const [isSaved, setIsSaved] = useState(false)

  // 简单的解析逻辑：把 AI 返回的纯文本拆解成结构化数据
  const parsedContent = useMemo(() => {
    if (!definition) return null

    // 默认回退内容
    const result = {
      pronunciation: '/.../',
      main: definition,
      nuance: '',
    }

    try {
      // 尝试匹配 AI 的 "1. ... 2. ... 3. ..." 格式
      const lines = definition.split('\n').filter((l) => l.trim())

      // 简单启发式提取 (根据 Prompt 的格式)
      const ipaLine = lines.find(
        (l) => l.includes('1.') || l.includes('Pronunciation'),
      )
      const defLine = lines.find(
        (l) => l.includes('2.') || l.includes('Definition'),
      )
      const nuanceLine = lines.find(
        (l) => l.includes('3.') || l.includes('Nuance'),
      )

      if (ipaLine)
        result.pronunciation = ipaLine
          .replace(/^\d+\.\s*|Pronunciation.*?:/gi, '')
          .trim()
      if (defLine)
        result.main = defLine.replace(/^\d+\.\s*|Definition.*?:/gi, '').trim()
      if (nuanceLine)
        result.nuance = nuanceLine.replace(/^\d+\.\s*|Nuance.*?:/gi, '').trim()

      // 如果格式完全不匹配，直接显示全文
      if (!ipaLine && !defLine) {
        result.main = definition
      }
    } catch (e) {
      console.warn('Parse definition failed', e)
    }
    return result
  }, [definition])

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
              <h2 className="text-3xl font-black text-white tracking-tight mb-1 capitalize">
                {word}
              </h2>
              <div className="flex items-center gap-3 text-white/40 text-sm font-medium">
                {parsedContent ? (
                  <span className="font-mono text-orange-400/80">
                    {parsedContent.pronunciation}
                  </span>
                ) : (
                  <span className="animate-pulse">Loading definition...</span>
                )}
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
            {parsedContent ? (
              <>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">
                    Meaning
                  </h4>
                  <p className="text-gray-200 leading-relaxed font-medium text-[15px]">
                    {parsedContent.main}
                  </p>
                </div>

                {parsedContent.nuance && (
                  <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500/50 mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">
                        lightbulb
                      </span>
                      Context Nuance
                    </h4>
                    <p className="text-white/60 text-sm italic border-l-2 border-orange-500/50 pl-3">
                      {parsedContent.nuance}
                    </p>
                  </div>
                )}
              </>
            ) : (
              // Loading Skeleton
              <div className="space-y-3 animate-pulse">
                <div className="h-20 bg-white/5 rounded-xl" />
                <div className="h-12 bg-white/5 rounded-xl" />
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
