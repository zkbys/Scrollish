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

  // A. 难度变体处理 (适配新版数组 & 旧版对象/字符串)
  const variant = comment.enrichment?.difficulty_variants?.[difficulty]

  if (difficulty !== 'Original' && variant) {
    // 情况 1: 新版数组结构 (DifficultySegment[])
    if (Array.isArray(variant)) {
      rawSegments = variant.map((v: any) => {
        // 尝试从原句分段中寻找对应的翻译 (基于 index)
        const originalSeg = comment.enrichment.sentence_segments?.find(
          (s: any) => s.index === v.index || s.en === v.original,
        )
        return {
          en: decodeHtmlEntity(v.rewritten),
          zh: originalSeg?.zh || null, // 尽量对齐翻译
        }
      })
    }
    // 情况 2: 旧版对象结构 ({ content: string })
    else if (typeof variant === 'object' && 'content' in variant) {
      rawSegments = [
        { en: decodeHtmlEntity(variant.content), zh: comment.content_cn },
      ]
    }
    // 情况 3: 旧版纯字符串结构
    else if (typeof variant === 'string') {
      rawSegments = [{ en: decodeHtmlEntity(variant), zh: comment.content_cn }]
    }
  }
  // B. Enrichment 后端分句数据 (Priority 2)
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
  // C. 前端智能分句兜底
  else {
    let content = comment.content || ''
    content = parseGiphy(content)

    if (!isImageUrl(content)) {
      const sentences = segmentText(content)
      rawSegments = sentences.map((s) => ({
        en: decodeHtmlEntity(s),
        zh: sentences.length === 1 ? comment.content_cn : null,
      }))
    } else {
      rawSegments = [{ en: decodeHtmlEntity(content), zh: null }]
    }
  }

  // E. 二次处理：处理 GIF/图片 混排在句子中的情况
  const finalSegments: { en: string; zh: string | null }[] = []

  rawSegments.forEach((seg) => {
    const parts = splitContentWithMedia(seg.en)

    if (parts.length === 1 && parts[0] === seg.en) {
      finalSegments.push(seg)
    } else {
      parts.forEach((part) => {
        if (isImageUrl(part)) {
          finalSegments.push({ en: part, zh: null })
        } else {
          if (part.length > 0) {
            // 只有当它是原句子的唯一文本部分时，才继承翻译
            const textParts = parts.filter((p) => !isImageUrl(p))
            const shouldKeepTrans =
              textParts.length === 1 && textParts[0] === part
            finalSegments.push({
              en: part,
              zh: shouldKeepTrans ? seg.zh : null,
            })
          }
        }
      })
    }
  })

  return finalSegments
}
