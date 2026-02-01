import React, { useMemo } from 'react'

interface InteractiveTextProps {
  text: string
  onWordClick: (word: string) => void
  className?: string
  // 可选：如果需要高亮特定的短语（兼容 ChatRoom 的 Glow 逻辑）
  highlightPhrase?: string
}

const InteractiveText: React.FC<InteractiveTextProps> = ({
  text,
  onWordClick,
  className = '',
  highlightPhrase,
}) => {
  const segments = useMemo(() => {
    if (!text) return []
    try {
      // 使用浏览器原生分词器，granularity: 'word' 会自动处理标点和空格
      // @ts-ignore (部分 TS 版本可能未包含此定义，但现代浏览器支持)
      const segmenter = new Intl.Segmenter('en', { granularity: 'word' })
      return [...segmenter.segment(text)]
    } catch (e) {
      // 降级处理：简单的正则分词
      console.warn('Intl.Segmenter not supported, falling back to regex')
      return text.split(/(\s+|[.,!?;:"'()])/).map((s) => ({
        segment: s,
        isWordLike: /^[a-zA-Z0-9'-]+$/.test(s),
      }))
    }
  }, [text])

  // 处理高亮逻辑的辅助函数
  const isHighlighted = (word: string) => {
    if (!highlightPhrase) return false
    return highlightPhrase.toLowerCase().includes(word.toLowerCase())
  }

  return (
    <span className={`${className} inline-block`}>
      {segments.map((seg, i) => {
        const word = seg.segment
        const isWord = seg.isWordLike // Intl.Segmenter 提供的属性

        if (isWord) {
          return (
            <span
              key={i}
              onClick={(e) => {
                e.stopPropagation() // 防止冒泡触发父级容器点击
                onWordClick(word)
              }}
              className={`
                inline-block cursor-pointer rounded-sm transition-all duration-200
                hover:text-orange-400 hover:bg-white/10 active:scale-95
                ${
                  isHighlighted(word)
                    ? 'text-orange-400 font-bold border-b-2 border-orange-500/40'
                    : ''
                }
              `}>
              {word}
            </span>
          )
        }
        // 标点符号或空格，原样渲染但不可点击
        return <span key={i}>{word}</span>
      })}
    </span>
  )
}

export default InteractiveText
