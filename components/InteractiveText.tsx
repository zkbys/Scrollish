import React, { useMemo } from 'react'
import { useDictionaryStore } from '../store/useDictionaryStore'

interface InteractiveTextProps {
  text: string
  contextSentence?: string
  className?: string
  externalOnClick?: (word: string) => void
}

const InteractiveText: React.FC<InteractiveTextProps & { disabled?: boolean }> = ({
  text,
  contextSentence = '',
  className = '',
  externalOnClick,
  disabled = false,
}) => {
  const { triggerAnalysis, isAnalyzing, cachedDefinitions, getInteraction } =
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
    if (disabled) return
    if (externalOnClick) {
      externalOnClick(word)
    } else {
      if (navigator.vibrate) navigator.vibrate(20)
      triggerAnalysis(word, contextSentence || text)
    }
  }

  // 计算颜色深度的辅助函数
  const getHighlightClass = (count: number) => {
    if (count <= 1) return 'decoration-green-400/50' // 第一次查：浅绿
    if (count <= 3) return 'decoration-green-500' // 2-3次：标准绿
    if (count <= 5) return 'decoration-green-600 decoration-[3px]' // 4-5次：深绿且加粗
    return 'decoration-red-500 decoration-[3px]' // >5次：红色警示
  }

  return (
    <span className={`${className} inline-block leading-relaxed`}>
      {segments.map((seg, i) => {
        const word = seg.segment
        const isWord = seg.isWordLike
        const isLoading = isAnalyzing(word)
        const isReady = !!cachedDefinitions[word.toLowerCase()]

        // 获取交互数据
        const interaction = getInteraction(word)
        const highlightClass = isReady
          ? getHighlightClass(interaction.count)
          : ''

        if (isWord) {
          return (
            <span
              key={i}
              onClick={(e) => {
                if (disabled) return
                e.stopPropagation()
                handleWordClick(word)
              }}
              className={`
                relative inline-block 
                ${disabled ? '' : 'cursor-pointer transition-all duration-200 rounded-sm px-0.5 -mx-0.5 hover:bg-white/10 active:scale-95'}
                ${!disabled && isLoading ? 'animate-pulse text-orange-400/80' : ''} 
                ${!disabled && isReady ? `underline underline-offset-4 decoration-wavy ${highlightClass}` : ''}
              `}>
              {word}
              {/* Loading Line */}
              {!disabled && isLoading && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500/50 animate-progress-line" />
              )}
              {/* 收藏标记 */}
              {interaction.isSaved && (
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-orange-500 rounded-full shadow-sm" />
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