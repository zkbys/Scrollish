/**
 * utils/textProcessing.ts
 * 包含文本清洗、Giphy 解析、HTML 实体解码等通用逻辑
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

// 3. 判断是否为图片 URL (支持 Giphy CDN)
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

// 4. [新增] 智能拆分器：将混合了 GIF 的文本拆分为 [文本, 图片URL, 文本]
const splitContentWithMedia = (text: string): string[] => {
  // 先把 Giphy 语法替换成 URL
  const textWithUrls = parseGiphy(text)

  // 如果全是 URL，直接返回
  if (isImageUrl(textWithUrls)) return [textWithUrls]

  // 使用正则拆分 URL (匹配 http/https 开头的图片链接)
  // 这个正则会捕获 URL 作为分隔符的一部分
  const urlRegex =
    /(https?:\/\/[^\s]+?\.(?:jpeg|jpg|gif|png|webp)(?:\?[^\s]*)?|https:\/\/media\.giphy\.com\/media\/[a-zA-Z0-9]+\/giphy\.gif)/gi

  return textWithUrls
    .split(urlRegex)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// 5. 通用分句器 (用于纯文本部分)
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

  // A. 来源选择策略
  if (
    difficulty !== 'Original' &&
    comment.enrichment?.difficulty_variants?.[difficulty]
  ) {
    // 策略 1: 难度变体
    const content =
      comment.enrichment.difficulty_variants[difficulty].content || ''
    rawSegments = [{ en: content, zh: comment.content_cn }]
  } else if (comment.id === 'op-message') {
    // 策略 2: OP 消息 (强制拆分以防过长)
    const content = comment.content || ''
    // 先按换行符粗分，防止大段文本
    const paragraphs = content.split(/\n+/)
    rawSegments = paragraphs.map((p) => ({ en: decodeHtmlEntity(p), zh: null }))
  } else if (
    comment.enrichment?.sentence_segments &&
    Array.isArray(comment.enrichment.sentence_segments) &&
    comment.enrichment.sentence_segments.length > 0
  ) {
    // 策略 3: 使用数据库现成的分句 (Enrichment)
    rawSegments = comment.enrichment.sentence_segments.map((s: any) => ({
      en: decodeHtmlEntity(s.en),
      zh: s.zh,
    }))
  } else {
    // 策略 4: 降级到原始内容
    rawSegments = [
      { en: decodeHtmlEntity(comment.content || ''), zh: comment.content_cn },
    ]
  }

  // B. 二次处理：处理 GIF/图片混排 + 分句
  const finalSegments: { en: string; zh: string | null }[] = []

  rawSegments.forEach((seg) => {
    // 1. 拆分图片和文本
    const parts = splitContentWithMedia(seg.en)

    parts.forEach((part) => {
      if (isImageUrl(part)) {
        // 如果是图片，直接作为一个段落
        finalSegments.push({ en: part, zh: null })
      } else {
        // 如果是文本，进行分句处理 (如果之前已经是 sentence_segments 则不需要再分，但为了保险起见，这里只对长文本再次分句)
        // 这里的逻辑是：如果来源是 enrichment，通常已经是句子了；如果是 raw content，则需要分句。
        // 为简单起见，我们对非 URL 的部分统一做一次清洗
        if (part.length > 0) {
          // 如果本来就是短句（Enrichment来源），segmentText 会直接返回原样，所以这里安全
          const sentences = segmentText(part)
          sentences.forEach((s, idx) => {
            // 尝试尽量保留中文翻译的对应关系（只有当只有一个句子时才附带中文，否则中文放在最后）
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
