import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../supabase'

// 定义评论数据结构 (与数据库表结构一致)
export interface Comment {
  id: string
  post_id: string
  author: string
  author_avatar?: string
  content: string
  content_zh?: string
  upvotes: number
  depth: number
  parent_id: string | null
  created_at: string
  is_ai?: boolean
  analysis?: any
}

interface CommentState {
  // 数据结构：key 是 postId, value 是该帖子下的所有评论数组
  // 这样设计是为了同时缓存多个帖子的评论，互不冲突
  commentsByPost: Record<string, Comment[]>

  // 加载状态：key 是 postId, value 是 boolean
  isLoading: Record<string, boolean>

  // Actions
  fetchComments: (postId: string, force?: boolean) => Promise<void>
  getComments: (postId: string) => Comment[]
}

export const useCommentStore = create<CommentState>()(
  persist(
    (set, get) => ({
      commentsByPost: {},
      isLoading: {},

      // 获取某个帖子的评论（直接从内存/缓存拿，同步操作）
      getComments: (postId: string) => {
        return get().commentsByPost[postId] || []
      },

      // 从数据库拉取评论
      fetchComments: async (postId: string, force = false) => {
        // 1. 缓存优先策略 (Cache-First)
        // 如果缓存里有数据，且不是强制刷新(force=false)，直接返回，不请求数据库！
        const existingData = get().commentsByPost[postId]
        if (existingData && existingData.length > 0 && !force) {
          // console.log(`[Cache Hit] 命中缓存，不请求数据库: ${postId}`);
          return
        }

        // 2. 标记该帖子正在加载
        set((state) => ({
          isLoading: { ...state.isLoading, [postId]: true },
        }))

        try {
          // 3. 一次性获取该帖子下的“所有”评论
          // 我们不分批获取，而是一次拿完，这样 TopicHub 和 ChatRoom 都能直接用
          const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('post_id', postId)
            .order('upvotes', { ascending: false }) // 默认按热度排

          if (error) throw error

          if (data) {
            // 4. 更新 Store，Zustand 会自动把这个更新同步写入 LocalStorage
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
      name: 'scrollish-comments-storage', // 在浏览器 LocalStorage 中看到的 Key 名字
      storage: createJSONStorage(() => localStorage), // 指定存储引擎

      // [优化] partialize: 决定哪些字段需要持久化
      // 我们只持久化 `commentsByPost` (数据)，不持久化 `isLoading` (状态)
      // 因为用户刷新页面后，loading 状态应该重置为 false
      partialize: (state) => ({ commentsByPost: state.commentsByPost }),
    },
  ),
)
