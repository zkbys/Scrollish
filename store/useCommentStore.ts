import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../supabase'

// 1. 扩展 Comment 类型，支持引用信息和本地状态
export interface Comment {
  id: string
  post_id: string
  author: string
  author_avatar?: string
  content: string
  content_zh?: string // 兼容旧字段
  content_cn?: string // 数据库新字段
  upvotes: number
  depth: number
  parent_id: string | null
  created_at: string
  is_ai?: boolean
  analysis?: any

  // [新增] 引用相关字段
  replyToName?: string
  replyText?: string
  replyAvatar?: string // [新增] 支持引用头像

  // [新增] 本地状态字段
  isLocal?: boolean
  isQuestion?: boolean // 标记是否为用户提问
  isLocalAi?: boolean // 标记是否为本地 AI
}

interface CommentState {
  commentsByPost: Record<string, Comment[]>
  // [新增] 本地消息存储 (key: postId)
  localComments: Record<string, Comment[]>
  isLoading: Record<string, boolean>

  fetchComments: (postId: string, force?: boolean) => Promise<void>
  getComments: (postId: string) => Comment[]

  // [新增] 本地消息操作
  addLocalComment: (postId: string, comment: Comment) => void
  deleteLocalComment: (postId: string, commentId: string) => void
}

export const useCommentStore = create<CommentState>()(
  persist(
    (set, get) => ({
      commentsByPost: {},
      localComments: {}, // 初始化
      isLoading: {},

      getComments: (postId: string) => {
        const dbComments = get().commentsByPost[postId] || []
        const localComments = get().localComments[postId] || []
        // 合并 DB 消息和本地消息
        // 注意：这里简单的合并在 UI 层还需要通过 parent_id 重组树状结构
        return [...dbComments, ...localComments]
      },

      addLocalComment: (postId, comment) => {
        set((state) => {
          const current = state.localComments[postId] || []
          return {
            localComments: {
              ...state.localComments,
              [postId]: [...current, comment],
            },
          }
        })
      },

      deleteLocalComment: (postId, commentId) => {
        set((state) => {
          const current = state.localComments[postId] || []
          return {
            localComments: {
              ...state.localComments,
              [postId]: current.filter((c) => c.id !== commentId),
            },
          }
        })
      },

      fetchComments: async (postId: string, force = false) => {
        const existingData = get().commentsByPost[postId]
        if (existingData && existingData.length > 0 && !force) return

        set((state) => ({
          isLoading: { ...state.isLoading, [postId]: true },
        }))

        try {
          const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('post_id', postId)
            .order('upvotes', { ascending: false })

          if (error) throw error

          if (data) {
            set((state) => ({
              commentsByPost: { ...state.commentsByPost, [postId]: data },
            }))
          }
        } catch (err) {
          console.error('Fetch comments failed:', err)
        } finally {
          set((state) => ({
            isLoading: { ...state.isLoading, [postId]: false },
          }))
        }
      },
    }),
    {
      name: 'scrollish-comments-storage', // LocalStorage Key
      storage: createJSONStorage(() => localStorage),
      // [关键] 确保持久化 localComments
      partialize: (state) => ({
        commentsByPost: state.commentsByPost,
        localComments: state.localComments,
      }),
    },
  ),
)
