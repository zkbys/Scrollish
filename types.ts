export enum Page {
  Home = 'home',
  TopicHub = 'topichub',
  ChatRoom = 'chatroom',
  Explore = 'explore',
  Study = 'study',
  Profile = 'profile',
  Preview = 'preview', // [确保添加这一行]
}

export interface Post {
  id: string
  user: string
  avatar: string
  titleEn: string
  titleZh: string
  hashtags: string[]
  image: string
  videoUrl?: string | null // 确保有这个
  image_type?: string
  subreddit?: string
  likes: string
  stars: string
  comments: number
  community_id?: string
}

export interface ChatMessage {
  id: string
  user: string
  avatar: string
  contentEn: string
  contentZh?: string
  level: number // 1: Main, 2: Reply, 3+: Deep Reply
  isAi?: boolean
  isMe?: boolean
  replyTo?: string
  replyContent?: string
  analysis?: {
    keyword: string
    type: 'slang' | 'culture' | 'grammar' | 'irony'
    explanation: string
  }
}

export interface GroupChat {
  id: string
  user: string
  avatar: string
  lastMessage: string
  time: string
  isActive?: boolean
  isAi?: boolean
  previewMessages?: { text: string; isMe?: boolean }[]
}
