import { create } from 'zustand'
import { supabase } from '../supabase'

export interface ProductionPost {
  id: string
  community_id: string
  title_en: string
  title_cn: string
  content_en: string
  content_cn: string
  image_url: string
  video_url: string | null
  image_type: 'original' | 'generated'
  upvotes: number
  subreddit: string
}

interface AppState {
  posts: ProductionPost[]
  hasLoaded: boolean
  isLoading: boolean
  isLoadingMore: boolean
  currentPostIndex: number

  // Actions
  initFeed: () => Promise<void>
  refreshFeed: () => Promise<void>
  loadMore: () => Promise<void>
  setCurrentPostIndex: (index: number) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  posts: [],
  hasLoaded: false,
  isLoading: false,
  isLoadingMore: false,
  currentPostIndex: 0,

  initFeed: async () => {
    // 缓存策略：如果已经有数据，直接返回，不再请求
    if (get().hasLoaded && get().posts.length > 0) return

    set({ isLoading: true })
    try {
      const { data, error } = await supabase.rpc('get_random_posts', {
        limit_count: 15,
      })
      if (error) throw error
      if (data) {
        set({ posts: data, hasLoaded: true, currentPostIndex: 0 })
      }
    } catch (err) {
      console.error('Feed init failed (Did you run the RPC SQL?):', err)
    } finally {
      set({ isLoading: false })
    }
  },

  refreshFeed: async () => {
    if (get().isLoading) return
    set({ isLoading: true })
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const { data, error } = await supabase.rpc('get_random_posts', {
        limit_count: 15,
      })
      if (error) throw error
      if (data) {
        set({ posts: data, currentPostIndex: 0 })
      }
    } catch (err) {
      console.error('Feed refresh failed:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  loadMore: async () => {
    if (get().isLoadingMore || get().isLoading) return

    set({ isLoadingMore: true })
    try {
      // 这里的 limit_count 决定每次追加多少条
      const { data, error } = await supabase.rpc('get_random_posts', {
        limit_count: 10,
      })

      if (error) {
        console.error('RPC Error:', error.message)
        throw error
      }

      if (data && data.length > 0) {
        // [无限回环关键] 直接追加 data，不过滤重复 ID
        // 注意：React 渲染列表时我们会用 `${post.id}-${index}` 作为 key 来规避 ID 重复报错
        set((state) => ({
          posts: [...state.posts, ...data],
        }))
        console.log(
          `Loaded ${data.length} more posts. Total: ${get().posts.length + data.length}`,
        )
      }
    } catch (err) {
      console.error(
        'Load more failed. Ensure get_random_posts RPC exists in Supabase.',
        err,
      )
    } finally {
      set({ isLoadingMore: false })
    }
  },

  setCurrentPostIndex: (index: number) => set({ currentPostIndex: index }),
}))
