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
  savedPostIndex: number
  currentFilters: { communityId?: string; followedIds?: string[] } | null
  homeActiveTab: 'following' | 'foryou'
  isRestoring: boolean

  // Actions
  initFeed: (filters?: { communityId?: string; followedIds?: string[] }) => Promise<void>
  refreshFeed: (filters?: { communityId?: string; followedIds?: string[] }) => Promise<void>
  loadMore: (filters?: { communityId?: string; followedIds?: string[] }) => Promise<void>
  setCurrentPostIndex: (index: number) => void
  setHomeActiveTab: (tab: 'following' | 'foryou') => void
  setIsRestoring: (status: boolean) => void
  saveCurrentPosition: () => void
  restoreSavedPosition: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  posts: [],
  hasLoaded: false,
  isLoading: false,
  isLoadingMore: false,
  currentPostIndex: 0,
  savedPostIndex: 0,
  currentFilters: null,
  homeActiveTab: 'foryou',
  isRestoring: false,

  initFeed: async (filters) => {
    const isFiltered = !!(filters?.communityId || filters?.followedIds?.length)
    const currentFilters = get().currentFilters
    const filtersChanged = JSON.stringify(filters || {}) !== JSON.stringify(currentFilters || {})

    // 如果过滤器没变且已经有数据，不重复加载
    if (!filtersChanged && get().posts.length > 0) return

    set({ isLoading: true, currentFilters: filters || {} })
    try {
      let data, error

      if (filters?.communityId) {
        ; ({ data, error } = await supabase
          .from('production_posts')
          .select('id, community_id, title_en, title_cn, image_url, video_url, image_type, upvotes, subreddit, created_at')
          .eq('community_id', filters.communityId)
          .order('created_at', { ascending: false })
          .limit(20))
      } else if (filters?.followedIds && filters.followedIds.length > 0) {
        ; ({ data, error } = await supabase
          .from('production_posts')
          .select('id, community_id, title_en, title_cn, image_url, video_url, image_type, upvotes, subreddit, created_at')
          .in('community_id', filters.followedIds)
          .order('created_at', { ascending: false })
          .limit(20))
      } else {
        // [优化] 随机采样代替固定 Top 30，解决重复刷新问题
        ; ({ data, error } = await supabase.rpc('get_random_posts', {
          limit_count: 40,
        }))
      }

      if (error) throw error
      if (data) {
        let finalPosts = data
        if (!isFiltered) {
          const { useUserStore } = await import('./useUserStore')
          const viewedPostIds = useUserStore.getState().viewedPostIds

          const shuffleArray = (array: any[]) => {
            const shuffled = [...array]
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
            }
            return shuffled
          }

          const unviewedPosts = data.filter(p => !viewedPostIds.includes(p.id))
          const viewedPosts = data.filter(p => viewedPostIds.includes(p.id))

          // 优先展示未看过的随机内容
          finalPosts = [...shuffleArray(unviewedPosts), ...shuffleArray(viewedPosts)]
        }

        set({ posts: finalPosts, hasLoaded: !isFiltered, currentPostIndex: 0 })
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
          .select('id, community_id, title_en, title_cn, image_url, video_url, image_type, upvotes, subreddit, created_at')
          .eq('community_id', filters.communityId)
          .order('created_at', { ascending: false })
          .limit(20))
      } else if (filters?.followedIds && filters.followedIds.length > 0) {
        ; ({ data, error } = await supabase
          .from('production_posts')
          .select('id, community_id, title_en, title_cn, image_url, video_url, image_type, upvotes, subreddit, created_at')
          .in('community_id', filters.followedIds)
          .order('created_at', { ascending: false })
          .limit(20))
      } else {
        // [优化] 刷新也使用随机 RPC
        ; ({ data, error } = await supabase.rpc('get_random_posts', {
          limit_count: 40,
        }))
      }

      if (error) throw error
      if (data) {
        let finalPosts = data
        const isFiltered = !!(filters?.communityId || filters?.followedIds?.length)
        if (!isFiltered) {
          const { useUserStore } = await import('./useUserStore')
          const viewedPostIds = useUserStore.getState().viewedPostIds

          const shuffleArray = (array: any[]) => {
            const shuffled = [...array]
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
            }
            return shuffled
          }
          const unviewedPosts = data.filter(p => !viewedPostIds.includes(p.id))
          const viewedPosts = data.filter(p => viewedPostIds.includes(p.id))
          finalPosts = [...shuffleArray(unviewedPosts), ...shuffleArray(viewedPosts)]
        }
        set({ posts: finalPosts })
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
        const lastPost = get().posts[get().posts.length - 1]
          ; ({ data, error } = await supabase
            .from('production_posts')
            .select('id, community_id, title_en, title_cn, image_url, video_url, image_type, upvotes, subreddit, created_at')
            .eq('community_id', filters.communityId)
            .lt('created_at', lastPost?.created_at || new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(10))
      } else if (filters?.followedIds && filters.followedIds.length > 0) {
        const lastPost = get().posts[get().posts.length - 1]
          ; ({ data, error } = await supabase
            .from('production_posts')
            .select('id, community_id, title_en, title_cn, image_url, video_url, image_type, upvotes, subreddit, created_at')
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
  setHomeActiveTab: (tab) => set({ homeActiveTab: tab }),
  setIsRestoring: (status) => set({ isRestoring: status }),
  saveCurrentPosition: () => {
    set({ savedPostIndex: get().currentPostIndex })
  },
  restoreSavedPosition: () => {
    const saved = get().savedPostIndex
    if (saved >= 0 && saved < get().posts.length) {
      set({ currentPostIndex: saved })
    }
  },
}))
