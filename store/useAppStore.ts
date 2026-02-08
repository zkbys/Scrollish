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
        // [修改] 获取所有帖子,然后在客户端随机排序
        ; ({ data, error } = await supabase
          .from('production_posts')
          .select('*'))
      }

      if (error) throw error
      if (data) {
        // [新增] 随机推送逻辑(仅对 For You 标签)
        let finalPosts = data
        if (!isFiltered) {
          const { useUserStore } = await import('./useUserStore')
          const viewedPostIds = useUserStore.getState().viewedPostIds

          // Fisher-Yates 洗牌算法
          const shuffleArray = (array: any[]) => {
            const shuffled = [...array]
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
            }
            return shuffled
          }

          // 分离未浏览和已浏览的帖子
          const unviewedPosts = data.filter(p => !viewedPostIds.includes(p.id))
          const viewedPosts = data.filter(p => viewedPostIds.includes(p.id))

          // 随机打乱
          const shuffledUnviewed = shuffleArray(unviewedPosts)
          const shuffledViewed = shuffleArray(viewedPosts)

          // 优先显示未浏览的,然后补充已浏览的
          finalPosts = [...shuffledUnviewed, ...shuffledViewed]
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
        // [修改] 获取所有帖子,然后在客户端随机排序
        ; ({ data, error } = await supabase
          .from('production_posts')
          .select('*'))
      }

      if (error) throw error
      if (data) {
        // [新增] 随机推送逻辑(仅对 For You 标签)
        let finalPosts = data
        const isFiltered = !!(filters?.communityId || filters?.followedIds?.length)
        if (!isFiltered) {
          const { useUserStore } = await import('./useUserStore')
          const viewedPostIds = useUserStore.getState().viewedPostIds

          // Fisher-Yates 洗牌算法
          const shuffleArray = (array: any[]) => {
            const shuffled = [...array]
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
            }
            return shuffled
          }

          // 分离未浏览和已浏览的帖子
          const unviewedPosts = data.filter(p => !viewedPostIds.includes(p.id))
          const viewedPosts = data.filter(p => viewedPostIds.includes(p.id))

          // 随机打乱
          const shuffledUnviewed = shuffleArray(unviewedPosts)
          const shuffledViewed = shuffleArray(viewedPosts)

          // 优先显示未浏览的,然后补充已浏览的
          finalPosts = [...shuffledUnviewed, ...shuffledViewed]
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
