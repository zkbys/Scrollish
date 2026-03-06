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
  lastLoadTime: number // 上次加载成功的时间戳

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
  lastLoadTime: 0,

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
        // [优化] 增大采样池到 100，确保去重后依然有足够的条数返回
        ; ({ data, error } = await supabase.rpc('get_random_posts', {
          limit_count: 100,
        }))
      }

      if (error) throw error
      if (data) {
        let finalPosts = data
        if (!isFiltered) {
          const { useHistoryStore } = await import('./useHistoryStore')
          const viewedPostIds = useHistoryStore.getState().viewedPostIds

          const shuffleArray = (array: any[]) => {
            const shuffled = [...array]
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
            }
            return shuffled
          }

          // [逻辑升级] 1. 过滤掉已经看过的
          const unviewedPosts = data.filter(p => !viewedPostIds.includes(p.id))

          if (unviewedPosts.length >= 20) {
            // 数量足够，只选没看过的
            finalPosts = shuffleArray(unviewedPosts).slice(0, 20)
          } else {
            // 数量不足，用池子里的其他数据补齐到 20 条，确保刷得爽
            const otherPosts = shuffleArray(data.filter(p => !unviewedPosts.some(uv => uv.id === p.id)))
            finalPosts = [...shuffleArray(unviewedPosts), ...otherPosts.slice(0, 20 - unviewedPosts.length)]
          }
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
        // [优化] 刷新也使用 100 采样池
        ; ({ data, error } = await supabase.rpc('get_random_posts', {
          limit_count: 100,
        }))
      }

      if (error) throw error
      if (data) {
        let finalPosts = data
        const isFiltered = !!(filters?.communityId || filters?.followedIds?.length)
        if (!isFiltered) {
          const { useHistoryStore } = await import('./useHistoryStore')
          const viewedPostIds = useHistoryStore.getState().viewedPostIds

          const shuffleArray = (array: any[]) => {
            const shuffled = [...array]
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
            }
            return shuffled
          }
          const unviewedPosts = data.filter(p => !viewedPostIds.includes(p.id))

          if (unviewedPosts.length >= 20) {
            finalPosts = shuffleArray(unviewedPosts).slice(0, 20)
          } else {
            // 补齐 20 条
            const otherPosts = shuffleArray(data.filter(p => !unviewedPosts.some(uv => uv.id === p.id)))
            finalPosts = [...shuffleArray(unviewedPosts), ...otherPosts.slice(0, 20 - unviewedPosts.length)]
          }
        }
        set({ posts: finalPosts, currentPostIndex: 0 })
      }
    } catch (err) {
      console.error('Feed refresh failed:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  loadMore: async (filters) => {
    // [优化] 增加 5 秒载入冷却时间，防止在底部停留导致的连续触发
    const now = Date.now()
    if (get().isLoadingMore || get().isLoading || (now - get().lastLoadTime < 5000)) return

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
        // [优化] 采样池扩大到 100
        ; ({ data, error } = await supabase.rpc('get_random_posts', {
          limit_count: 100,
        }))
      }

      if (error) throw error

      if (data && data.length > 0) {
        // [修复] 处理浏览器环境中的动态导入
        const { useHistoryStore } = await import('./useHistoryStore')
        const viewedPostIds = useHistoryStore.getState().viewedPostIds

        set((state) => {
          // 1. 严格过滤：既不在当前列表，也没看过
          const strictNewPosts = data.filter(
            p => !viewedPostIds.includes(p.id) &&
              !state.posts.some(existing => existing.id === p.id)
          )

          // 2. 兜底逻辑：如果不重复于当前 Session，即便看过也可以再次出现
          const sessionNewPosts = data.filter(
            p => !state.posts.some(existing => existing.id === p.id)
          )

          // 3. 填充逻辑：目标追加 20 条
          let finalNewData = []
          if (strictNewPosts.length >= 20) {
            finalNewData = strictNewPosts.slice(0, 20)
          } else if (sessionNewPosts.length > 0) {
            // 用 sessionNewPosts 补齐
            const remaining = 20 - strictNewPosts.length
            finalNewData = [...strictNewPosts, ...sessionNewPosts.slice(0, remaining)]
          } else {
            // 全库全 Session 刷完的极端兜底
            finalNewData = data.slice(0, 20)
          }

          return {
            posts: [...state.posts, ...finalNewData],
            lastLoadTime: Date.now(),
          }
        })
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
