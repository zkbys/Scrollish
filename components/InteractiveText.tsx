import React, { useMemo } from 'react'
import { useDictionaryStore } from '../store/useDictionaryStore'
import { useUserStore } from '../store/useUserStore'

interface InteractiveTextProps {
  text: string
  contextSentence?: string
  className?: string
  externalOnClick?: (word: string, context: string) => void
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
    const { registerWordLookup, isWordStarred } = useUserStore()

    const segments = useMemo(() => {
      if (!text) return []

      // 1. [新增] 识别 *text* 格式并标记为加粗，但不拆分单词
      const boldRegex = /(\*[^*]+\*)/g
      const rawSegments = text.split(boldRegex)

      const finalSegments: { segment: string; isWordLike: boolean; isBold: boolean }[] = []

      rawSegments.forEach((piece) => {
        const isBold = piece.startsWith('*') && piece.endsWith('*')
        // 去除星号
        const cleanPiece = isBold ? piece.slice(1, -1) : piece

        // 2. 对每一段进行词法分割
        const subSegments: { segment: string; isWordLike: boolean }[] = []
        try {
          // @ts-ignore
          const segmenter = new Intl.Segmenter('en', { granularity: 'word' })
          subSegments.push(...[...segmenter.segment(cleanPiece)].map(s => ({
            segment: s.segment,
            isWordLike: s.isWordLike
          })))
        } catch (e) {
          subSegments.push(...cleanPiece.split(/(\s+|[.,!?;:"'()])/).map((s) => ({
            segment: s,
            isWordLike: /^[a-zA-Z0-9'-]+$/.test(s),
          })))
        }

        subSegments.forEach(sub => {
          finalSegments.push({ ...sub, isBold })
        })
      })

      return finalSegments
    }, [text])

    const handleWordClick = async (word: string) => {
      if (disabled) return
      const finalContext = contextSentence || text

      if (externalOnClick) {
        externalOnClick(word, finalContext)
      } else {
        if (navigator.vibrate) navigator.vibrate(20)
        const result = await triggerAnalysis(word, finalContext)
        if (result) {
          registerWordLookup(result, finalContext)
        }
      }
    }

    return (
      <span className={`${className} inline-block leading-relaxed`}>
        {segments.map((seg, i) => {
          const word = seg.segment
          const isWord = seg.isWordLike
          const isBold = seg.isBold
          const finalContext = contextSentence || text
          const contextKey = finalContext.trim().slice(0, 30)
          // const cacheKey = `${word}:${contextKey}`

          const isLoading = isAnalyzing(word, finalContext)
          // [核心修复] 划线逻辑关联到全局词书，而非特定语境缓存
          const isStarred = isWordStarred(word)

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
              relative inline-block select-none -webkit-user-select-none ${disabled ? '' : 'cursor-pointer transition-all duration-200 rounded-sm px-0.5 -mx-0.5 hover:bg-white/10 active:scale-95'}
              ${!disabled && isLoading ? 'animate-pulse text-orange-400/80' : ''} 
              ${!disabled && isStarred ? 'decoration-green-500 decoration-wavy underline underline-offset-4 decoration-2' : ''}
              ${isBold ? 'font-black' : ''}
            `}>
                {word}
                {isLoading && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500/50 animate-progress-line" />
                )}
              </span>
            )
          }
          return <span key={i} className={isBold ? 'font-black' : ''}>{word}</span>
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
