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
  created_at: string
}

interface AppState {
  posts: ProductionPost[]
  hasLoaded: boolean
  isLoading: boolean
  isLoadingMore: boolean
  currentPostIndex: number

  // Actions
  initFeed: (filters?: { communityId?: string; followedIds?: string[] }) => Promise<void>
  refreshFeed: (filters?: { communityId?: string; followedIds?: string[] }) => Promise<void>
  loadMore: (filters?: { communityId?: string; followedIds?: string[] }) => Promise<void>
  setCurrentPostIndex: (index: number) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  posts: [],
  hasLoaded: false,
  isLoading: false,
  isLoadingMore: false,
  currentPostIndex: 0,

  initFeed: async (filters) => {
    // 缓存策略：如果有过滤器或者是首次加载
    const isFiltered = !!(filters?.communityId || filters?.followedIds?.length)
    if (!isFiltered && get().hasLoaded && get().posts.length > 0) return

    set({ isLoading: true })
    try {
      let data, error

      if (filters?.communityId) {
        // 单个社区过滤
        ; ({ data, error } = await supabase
          .from('production_posts')
          .select('*')
          .eq('community_id', filters.communityId)
          .order('created_at', { ascending: false })
          .limit(15))
      } else if (filters?.followedIds && filters.followedIds.length > 0) {
        // 关注列表过滤
        ; ({ data, error } = await supabase
          .from('production_posts')
          .select('*')
          .in('community_id', filters.followedIds)
          .order('created_at', { ascending: false })
          .limit(15))
      } else {
        // 默认随机推荐
        ; ({ data, error } = await supabase.rpc('get_random_posts', {
          limit_count: 15,
        }))
      }

      if (error) throw error
      if (data) {
        set({ posts: data, hasLoaded: !isFiltered, currentPostIndex: 0 })
      }
    } catch (err) {
      console.error('Feed init failed:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  refreshFeed: async (filters) => {
    if (get().isLoading) return
    set({ isLoading: true })
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      let data, error

      if (filters?.communityId) {
        ; ({ data, error } = await supabase
          .from('production_posts')
          .select('*')
          .eq('community_id', filters.communityId)
          .order('created_at', { ascending: false })
          .limit(15))
      } else if (filters?.followedIds && filters.followedIds.length > 0) {
        ; ({ data, error } = await supabase
          .from('production_posts')
          .select('*')
          .in('community_id', filters.followedIds)
          .order('created_at', { ascending: false })
          .limit(15))
      } else {
        ; ({ data, error } = await supabase.rpc('get_random_posts', {
          limit_count: 15,
        }))
      }

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

  loadMore: async (filters) => {
    if (get().isLoadingMore || get().isLoading) return

    set({ isLoadingMore: true })
    try {
      let data, error

      if (filters?.communityId) {
        // 单个社区加载更多
        const lastPost = get().posts[get().posts.length - 1]
          ; ({ data, error } = await supabase
            .from('production_posts')
            .select('*')
            .eq('community_id', filters.communityId)
            .lt('created_at', lastPost?.created_at || new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(10))
      } else if (filters?.followedIds && filters.followedIds.length > 0) {
        // 关注列表加载更多
        const lastPost = get().posts[get().posts.length - 1]
          ; ({ data, error } = await supabase
            .from('production_posts')
            .select('*')
            .in('community_id', filters.followedIds)
            .lt('created_at', lastPost?.created_at || new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(10))
      } else {
        ; ({ data, error } = await supabase.rpc('get_random_posts', {
          limit_count: 10,
        }))
      }

      if (error) throw error

      if (data && data.length > 0) {
        set((state) => ({
          posts: [...state.posts, ...data],
        }))
      }
    } catch (err) {
      console.error('Load more failed:', err)
    } finally {
      set({ isLoadingMore: false })
    }
  },

  setCurrentPostIndex: (index: number) => set({ currentPostIndex: index }),
}))
