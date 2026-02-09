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
  // [新增] 专门用于构建聊天树的 helper
  buildMessageThread: (
    postId: string,
    focusCommentId: string | null | undefined,
    opData: any,
  ) => Comment[]
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: {},
  isLoading: {},

  fetchComments: async (postId) => {
    // 缓存策略：如果已有数据且不为空，暂时不重复请求（可根据需要优化）
    if (get().comments[postId]?.length > 0) return

    set((state) => ({ isLoading: { ...state.isLoading, [postId]: true } }))

    try {
      const { data, error } = await supabase
        .from('comments')
        .select(
          `
          *,
          enrichment:comments_enrichment (
            native_polished,
            sentence_segments,
            difficulty_variants,
            cultural_notes
          )
        `,
        )
        .eq('post_id', postId)
        .order('upvotes', { ascending: false })

      if (error) throw error

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

  // [重点优化] 将 ChatRoom 中昂贵的 useMemo 逻辑迁移至此
  // 这样虽然每次 render 还是会调用，但逻辑被封装，且未来可以配合 selector 进行缓存优化
  buildMessageThread: (postId, focusCommentId, opData) => {
    const allComments = get().comments[postId] || []
    if (!opData || !allComments.length || !focusCommentId) return []

    // A. 构造 OP 消息
    const opMessage: Comment = {
      id: 'op-message',
      post_id: postId,
      author: opData.author,
      content: opData.content,
      content_cn: opData.content_cn,
      upvotes: 0,
      depth: -1,
      parent_id: null,
      created_at: new Date().toISOString(),
      enrichment: { sentence_segments: null, cultural_notes: [] } as any,
    }

    const rootComment = allComments.find((c) => c.id === focusCommentId)
    // 如果还没加载到 focus 的评论，至少返回 OP
    if (!rootComment) return [opMessage]

    // B. 建立索引
    const childrenMap = new Map<string, Comment[]>()
    const opChildren: Comment[] = []

    allComments.forEach((c) => {
      if (c.parent_id === 'op-message') {
        opChildren.push(c)
      } else if (c.parent_id) {
        if (!childrenMap.has(c.parent_id)) childrenMap.set(c.parent_id, [])
        childrenMap.get(c.parent_id)?.push(c)
      }
    })

    const result: Comment[] = []

    // C. 压入 OP
    result.push(opMessage)

    // D. OP 追问
    const traverseOpChildren = (nodes: Comment[]) => {
      nodes.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      nodes.forEach((child) => {
        result.push({
          ...child,
          replyToName: 'OP',
          replyText: opMessage.content,
        })
        if (childrenMap.has(child.id)) traverse(child.id) // 递归处理本地追问
      })
    }
    traverseOpChildren(opChildren)

    // E. 压入 Top Comment
    result.push({ ...rootComment, replyToName: 'OP' })

    // F. 遍历子树
    const traverse = (parentId: string) => {
      const children = childrenMap.get(parentId) || []
      children.sort((a, b) => {
        if (a.isLocal && !b.isLocal) return -1
        if (!a.isLocal && b.isLocal) return 1
        if (a.isLocal && b.isLocal) {
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        }
        return (b.upvotes || 0) - (a.upvotes || 0)
      })

      children.forEach((child) => {
        // 查找 parentNode 用于显示 replyText
        const parentNode =
          allComments.find((p) => p.id === parentId) ||
          (parentId === 'op-message' ? opMessage : null)

        result.push({
          ...child,
          replyToName: parentNode?.author,
          replyText: parentNode?.content,
        })
        traverse(child.id)
      })
    }
    traverse(focusCommentId)

    return result
  },
}))
