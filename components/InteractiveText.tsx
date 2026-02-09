import React, { useMemo } from 'react'
import { useDictionaryStore } from '../store/useDictionaryStore'

interface InteractiveTextProps {
  text: string
  contextSentence?: string
  className?: string
  externalOnClick?: (word: string) => void
}

const InteractiveText: React.FC<
  InteractiveTextProps & { disabled?: boolean }
> = ({
  text,
  contextSentence = '',
  className = '',
  externalOnClick,
  disabled = false,
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
    if (disabled) return
    if (externalOnClick) {
      externalOnClick(word)
    } else {
      if (navigator.vibrate) navigator.vibrate(20)
      triggerAnalysis(word, contextSentence || text)
    }
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
                if (disabled) return
                // 阻止冒泡，避免触发父级可能的点击事件
                e.stopPropagation()
                handleWordClick(word)
              }}
              // [核心修复] 阻止原生右键/长按菜单，避免与父组件长按逻辑冲突
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              className={`
                relative inline-block ${disabled ? '' : 'cursor-pointer transition-all duration-200 rounded-sm px-0.5 -mx-0.5 hover:bg-white/10 active:scale-95'}
                ${!disabled && isLoading ? 'animate-pulse text-orange-400/80' : ''} 
                ${!disabled && isReady ? 'decoration-green-500 decoration-wavy underline underline-offset-4 decoration-2' : ''}
              `}>
              {word}
              {isLoading && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500/50 animate-progress-line" />
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
