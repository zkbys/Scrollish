import React, { useMemo } from 'react'
import { useDictionaryStore } from '../store/useDictionaryStore'

interface InteractiveTextProps {
  text: string
  contextSentence?: string // 新增：传入完整句子作为上下文
  onWordClick?: (word: string) => void // 可选，主要由 Store 接管
  className?: string
}

const InteractiveText: React.FC<InteractiveTextProps> = ({
  text,
  contextSentence = '', // 默认为空，最好从父组件传入
  className = '',
}) => {
  const { triggerAnalysis, isAnalyzing, cachedDefinitions } =
    useDictionaryStore()

  const segments = useMemo(() => {
    if (!text) return []
    try {
      // @ts-ignore
      const segmenter = new Intl.Segmenter('en', { granularity: 'word' })
      return [...segmenter.segment(text)]
    } catch (e) {
      return text.split(/(\s+|[.,!?;:"'()])/).map((s) => ({
        segment: s,
        isWordLike: /^[a-zA-Z0-9'-]+$/.test(s),
      }))
    }
  }, [text])

  const handleWordClick = (word: string) => {
    if (navigator.vibrate) navigator.vibrate(20)
    // 触发 Store 的异步动作
    // 如果没有传入专门的 contextSentence，就用当前 text
    triggerAnalysis(word, contextSentence || text)
  }

  return (
    <span className={`${className} inline-block leading-relaxed`}>
      {segments.map((seg, i) => {
        const word = seg.segment
        const isWord = seg.isWordLike
        const isLoading = isAnalyzing(word)
        const isReady = !!cachedDefinitions[word]

        if (isWord) {
          return (
            <span
              key={i}
              onClick={(e) => {
                e.stopPropagation()
                handleWordClick(word)
              }}
              className={`
                relative inline-block cursor-pointer transition-all duration-300 rounded-sm px-0.5 -mx-0.5
                hover:bg-white/10 active:scale-95
                ${isLoading ? 'animate-pulse text-orange-400/80' : ''} 
                ${isReady ? 'text-white' : ''}
              `}>
              {word}
              {/* Loading 状态下的下划线动画 */}
              {isLoading && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500/50 animate-progress-line" />
              )}
              {/* Ready 状态下的标记 (可选，比如一个小点) */}
              {isReady && !isLoading && (
                <span className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-green-500 rounded-full shadow-[0_0_4px_#22c55e]" />
              )}
            </span>
          )
        }
        return <span key={i}>{word}</span>
      })}

      <style>{`
        @keyframes progress-line {
          0% { width: 0%; left: 50%; }
          50% { width: 100%; left: 0%; }
          100% { width: 0%; left: 50%; opacity: 0; }
        }
        .animate-progress-line {
          animation: progress-line 1.5s infinite ease-in-out;
        }
      `}</style>
    </span>
  )
}

export default InteractiveText
