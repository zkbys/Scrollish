import { create } from 'zustand'
import { supabase } from '../supabase'
import { Comment } from '../types'

interface CommentState {
  comments: Record<string, Comment[]>
  isLoading: Record<string, boolean>
  fetchComments: (postId: string) => Promise<void>
  getComments: (postId: string) => Comment[]
  addLocalComment: (postId: string, comment: Comment) => void
  deleteLocalComment: (postId: string, commentId: string) => void
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: {},
  isLoading: {},

  fetchComments: async (postId) => {
    if (get().comments[postId]?.length > 0) return

    set((state) => ({ isLoading: { ...state.isLoading, [postId]: true } }))

    try {
      // 联表查询 comments_enrichment
      const { data, error } = await supabase
        .from('comments')
        .select(
          `
          *,
          enrichment:comments_enrichment (
            corrected_content,
            sentence_segments,
            difficulty_variants,
            cultural_notes
          )
        `,
        )
        .eq('post_id', postId)
        .order('upvotes', { ascending: false })

      if (error) throw error

      // 处理数据，确保 enrichment 是对象而不是数组（Supabase 1:1 关系有时返回数组）
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        enrichment: Array.isArray(item.enrichment)
          ? item.enrichment[0]
          : item.enrichment,
      }))

      set((state) => ({
        comments: { ...state.comments, [postId]: formattedData as Comment[] },
      }))
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      set((state) => ({ isLoading: { ...state.isLoading, [postId]: false } }))
    }
  },

  getComments: (postId) => get().comments[postId] || [],

  addLocalComment: (postId, comment) => {
    set((state) => {
      const current = state.comments[postId] || []
      return {
        comments: { ...state.comments, [postId]: [...current, comment] },
      }
    })
  },

  deleteLocalComment: (postId, commentId) => {
    set((state) => {
      const current = state.comments[postId] || []
      return {
        comments: {
          ...state.comments,
          [postId]: current.filter((c) => c.id !== commentId),
        },
      }
    })
  },
}))
