/**
 * utils/textProcessing.ts
 */

// 1. HTML 实体解码
export const decodeHtmlEntity = (str: string | null | undefined): string => {
  if (!str) return ''
  return str
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

// 2. 解析 Reddit Giphy 语法 -> URL
const GIPHY_REGEX = /!\[gif\]\(giphy\|([a-zA-Z0-9]+)(?:\|[^)]*)?\)/g

export const parseGiphy = (text: string): string => {
  if (!text) return ''
  return text.replace(GIPHY_REGEX, (match, id) => {
    return `https://media.giphy.com/media/${id}/giphy.gif`
  })
}

// 3. 判断是否为图片 URL
export const isImageUrl = (text: string): boolean => {
  if (!text) return false
  const cleanText = text.trim()
  return (
    /^https?:\/\/.*\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i.test(cleanText) ||
    cleanText.includes('media.giphy.com') ||
    cleanText.includes('i.redd.it') ||
    cleanText.includes('preview.redd.it')
  )
}

// 4. 智能拆分器
const splitContentWithMedia = (text: string): string[] => {
  const textWithUrls = parseGiphy(text)
  if (isImageUrl(textWithUrls)) return [textWithUrls]

  const urlRegex =
    /(https?:\/\/[^\s]+?\.(?:jpeg|jpg|gif|png|webp)(?:\?[^\s]*)?|https:\/\/media\.giphy\.com\/media\/[a-zA-Z0-9]+\/giphy\.gif)/gi

  return textWithUrls
    .split(urlRegex)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// 5. 通用分句器
export const segmentText = (text: string): string[] => {
  try {
    // @ts-ignore
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
    return [...segmenter.segment(text)].map((s: any) => s.segment.trim())
  } catch (e) {
    return text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text]
  }
}

// 6. 核心逻辑：获取显示用的分句数据
export const getMessageSegments = (
  comment: any,
  difficulty: string = 'Original',
) => {
  let rawSegments: { en: string; zh: string | null }[] = []

  // A. 难度变体
  if (
    difficulty !== 'Original' &&
    comment.enrichment?.difficulty_variants?.[difficulty]
  ) {
    const content =
      comment.enrichment.difficulty_variants[difficulty].content || ''
    rawSegments = [{ en: content, zh: comment.content_cn }]
  }
  // B. OP 消息 (OP卡片底部固定显示翻译，这里段落内不显示)
  else if (comment.id === 'op-message') {
    const content = comment.content || ''
    const paragraphs = content.split(/\n+/)
    rawSegments = paragraphs.map((p) => ({ en: decodeHtmlEntity(p), zh: null }))
  }
  // C. Enrichment 分句数据 (这是唯一会有段落内翻译的情况)
  else if (
    comment.enrichment?.sentence_segments &&
    Array.isArray(comment.enrichment.sentence_segments) &&
    comment.enrichment.sentence_segments.length > 0
  ) {
    rawSegments = comment.enrichment.sentence_segments.map((s: any) => ({
      en: decodeHtmlEntity(s.en),
      zh: s.zh,
    }))
  }
  // D. [核心修复] 降级策略：强制 zh=null
  // 这样 MessageBubble 就不会在中间渲染翻译，而是触发底部的 content_cn 渲染
  else {
    rawSegments = [{ en: decodeHtmlEntity(comment.content || ''), zh: null }]
  }

  // E. 二次处理：处理 GIF 混排
  const finalSegments: { en: string; zh: string | null }[] = []

  rawSegments.forEach((seg) => {
    const parts = splitContentWithMedia(seg.en)

    parts.forEach((part) => {
      if (isImageUrl(part)) {
        finalSegments.push({ en: part, zh: null })
      } else {
        if (part.length > 0) {
          const sentences = segmentText(part)
          sentences.forEach((s) => {
            const zh =
              parts.length === 1 && sentences.length === 1 ? seg.zh : null
            finalSegments.push({ en: s, zh })
          })
        }
      }
    })
  })

  return finalSegments
}
