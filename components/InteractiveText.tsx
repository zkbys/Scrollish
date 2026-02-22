import React, { useMemo } from 'react'
import { useDictionaryStore } from '../store/useDictionaryStore'
import { useUserStore } from '../store/useUserStore'

interface InteractiveTextProps {
  text: string
  contextSentence?: string
  className?: string
  externalOnClick?: (word: string, context: string) => void
  highlightWords?: string[]
}

const InteractiveText: React.FC<
  InteractiveTextProps & { disabled?: boolean }
> = ({
  text,
  contextSentence = '',
  className = '',
  externalOnClick,
  disabled = false,
  highlightWords = [],
}) => {
  const { triggerAnalysis, isAnalyzing } = useDictionaryStore()
  const { registerWordLookup, isWordStarred } = useUserStore()

  // 1. [修复] 预先计算出所有完整短语在原句中的字符区间 (避免短语拆分导致的错误高亮)
  const highlightRanges = useMemo(() => {
    const ranges: { start: number; end: number }[] = []
    if (!text || !highlightWords.length) return ranges

    const lowerText = text.toLowerCase()
    highlightWords.forEach((phrase) => {
      const lowerPhrase = phrase.trim().toLowerCase()
      if (!lowerPhrase) return

      // 查找所有匹配该短语的起始位置
      let startIndex = 0
      while ((startIndex = lowerText.indexOf(lowerPhrase, startIndex)) !== -1) {
        ranges.push({ start: startIndex, end: startIndex + lowerPhrase.length })
        // 移动到下一个可能的位置
        startIndex += lowerPhrase.length
      }
    })
    return ranges
  }, [text, highlightWords])

  // 2. 切词并记录每个单词在原句中的真实索引 (Index)
  const segments = useMemo(() => {
    if (!text) return []

    const boldRegex = /(\*[^*]+\*)/g
    const rawSegments = text.split(boldRegex)

    const finalSegments: {
      segment: string
      isWordLike: boolean
      isBold: boolean
      start: number
      end: number
    }[] = []

    // 追踪当前在原文本中的偏移量
    let currentIndex = 0

    rawSegments.forEach((piece) => {
      if (!piece) return

      const isBold = piece.startsWith('*') && piece.endsWith('*')
      const cleanPiece = isBold ? piece.slice(1, -1) : piece

      const subSegments: { segment: string; isWordLike: boolean }[] = []
      try {
        // @ts-ignore
        const segmenter = new Intl.Segmenter('en', { granularity: 'word' })
        subSegments.push(
          ...[...segmenter.segment(cleanPiece)].map((s) => ({
            segment: s.segment,
            isWordLike: s.isWordLike,
          })),
        )
      } catch (e) {
        subSegments.push(
          ...cleanPiece
            .split(/(\s+|[.,!?;:"'()])/)
            .filter(Boolean)
            .map((s) => ({
              segment: s,
              isWordLike: /^[a-zA-Z0-9'-]+$/.test(s),
            })),
        )
      }

      let cleanIndex = 0
      subSegments.forEach((sub) => {
        const segLength = sub.segment.length
        // 如果是被 * 包裹的文本，首个单词的 start 需加上 '*' 的偏移量 (1)
        const startInOriginal = currentIndex + (isBold ? 1 : 0) + cleanIndex
        const endInOriginal = startInOriginal + segLength

        finalSegments.push({
          segment: sub.segment,
          isWordLike: sub.isWordLike,
          isBold,
          start: startInOriginal,
          end: endInOriginal,
        })

        cleanIndex += segLength
      })

      currentIndex += piece.length
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

        const isLoading = isAnalyzing(word, finalContext)
        const isStarred = isWordStarred(word)

        // [修复核心] 判断当前单词的索引区间，是否被包含在某个高亮短语的区间内
        const isHighlighted =
          isWord &&
          highlightRanges.some((r) => seg.start >= r.start && seg.end <= r.end)

        if (isWord) {
          return (
            <span
              key={i}
              onClick={(e) => {
                if (disabled) return
                e.stopPropagation()
                handleWordClick(word)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              className={`
              relative inline-block select-none -webkit-user-select-none ${disabled ? '' : 'cursor-pointer transition-all duration-200 rounded-sm px-0.5 -mx-0.5 hover:bg-white/10 active:scale-95'}
              ${!disabled && isLoading ? 'animate-pulse text-orange-400/80' : ''} 
              ${!disabled && isStarred ? 'decoration-green-500 decoration-wavy underline underline-offset-4 decoration-2' : ''}
              ${!disabled && isHighlighted ? 'border-b-2 border-orange-400/80' : ''} 
              ${isBold ? 'font-black' : ''}
            `}>
              {word}
              {isLoading && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500/50 animate-progress-line" />
              )}
            </span>
          )
        }
        return (
          <span key={i} className={isBold ? 'font-black' : ''}>
            {word}
          </span>
        )
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
