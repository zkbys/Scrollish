// types.ts

export enum Page {
  Home = 'Home',
  TopicHub = 'TopicHub',
  ChatRoom = 'ChatRoom',
  Profile = 'Profile',
  Study = 'Study',
  Explore = 'Explore',
  CommunityDetail = 'CommunityDetail',
  Login = 'Login',
  Preview = 'Preview',
  Onboarding = 'Onboarding',
}

// 补全 Post 类型定义
export interface Post {
  id: string
  user: string
  avatar: string
  titleEn: string
  titleZh: string
  hashtags: string[]
  image: string
  videoUrl: string | null
  likes: string
  stars: string
  comments: number
  image_type?: 'original' | 'generated'
  subreddit?: string
  community_id?: string
}

/**
 * 单词高亮与释义结构
 */
export interface Highlight {
  word: string
  meaning: string
}

export interface DifficultySegment {
  index: number
  original: string
  rewritten: string
}

/**
 * 难度等级内容 (适配旧版对象结构与新版数组结构)
 */
export type Variant = string | { content: string; highlights?: Highlight[] } | DifficultySegment[]

/**
 * 文化背景或俚语解析
 */
export interface CulturalNote {
  trigger_word: string
  explanation: string
}

/**
 * 完整的评论增强数据 (来自 comments_enrichment 表)
 */
export interface EnrichmentData {
  comment_id: string
  native_polished: string
  sentence_segments: { en: string; zh: string }[]
  difficulty_variants: {
    Mixed?: Variant
    Basic?: Variant
    Intermediate?: Variant
    Expert?: Variant
    [key: string]: Variant | undefined
  }
  cultural_notes: CulturalNote[]
}

/**
 * 联表查询后的完整评论对象
 */
export interface Comment {
  id: string
  post_id: string
  parent_id: string | null
  author: string
  author_avatar?: string // 兼容前端现有逻辑
  content: string
  content_cn: string
  upvotes: number
  depth: number
  created_at: string

  // 业务逻辑字段
  isLocal?: boolean
  isQuestion?: boolean
  isLocalAi?: boolean
  isLoading?: boolean // AI 回复加载状态
  replyToName?: string
  replyText?: string
  replyAvatar?: string

  // 增强数据
  enrichment?: EnrichmentData
}

export interface ChatMessage {
  id: string
  user?: string
  avatar?: string
  contentEn?: string
  contentZh?: string
  level?: number
  role?: 'user' | 'assistant'
  content?: string
  isAi?: boolean
  analysis?: {
    keyword: string
    type: string
    explanation: string
  }
  replyTo?: string
  replyContent?: string
}

export interface GroupChat {
  id: string
  user: string
  avatar: string
  lastMessage: string
  time: string
  isActive?: boolean
  isAi?: boolean
  previewMessages: { text: string; isMe: boolean }[]
}
