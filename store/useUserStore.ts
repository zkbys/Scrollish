import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { supabase } from '../supabase'
import { ProductionPost } from './useAppStore'
import { DictionaryResult } from './useDictionaryStore'

export interface ViewHistoryItem {
  postId: string
  viewedAt: string
  post: ProductionPost
}

interface UserState {
  likedPosts: ProductionPost[]
  starredWords: DictionaryResult[]
  followedCommunities: string[]
  viewedPostIds: string[]
  viewHistory: ViewHistoryItem[]

  currentUser: any | null
  profile: any | null
  isLoading: boolean
  _hasHydrated: boolean // [新增] 用于标识持久化存储是否已加载完成

  // Actions
  toggleLike: (post: ProductionPost) => void
  isLiked: (postId: string) => boolean
  toggleStarWord: (word: DictionaryResult) => void
  isWordStarred: (wordName: string) => boolean
  toggleFollowCommunity: (communityId: string) => void
  isFollowing: (communityId: string) => boolean
  addViewHistory: (post: ProductionPost) => void
  isViewed: (postId: string) => boolean
  clearViewHistory: () => void
  login: (user: any) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  fetchProfile: () => Promise<void>
  updateXP: (amount: number) => Promise<void>
  updateProfile: (updates: any) => Promise<void>
  setProfile: (profile: any) => void
  setHasHydrated: (state: boolean) => void // [新增] 设置加载完成状态
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      likedPosts: [],
      starredWords: [],
      followedCommunities: [],
      viewedPostIds: [],
      viewHistory: [],
      currentUser: null,
      profile: null,
      isLoading: true,
      _hasHydrated: false, // [新增] 初始状态为 false

      toggleLike: (post: ProductionPost) => {
        const currentLikes = get().likedPosts
        const exists = currentLikes.find((p) => p.id === post.id)
        if (exists) {
          set({ likedPosts: currentLikes.filter((p) => p.id !== post.id) })
        } else {
          set({ likedPosts: [post, ...currentLikes] })
        }
      },

      isLiked: (postId: string) => {
        return get().likedPosts.some((p) => p.id === postId)
      },

      toggleStarWord: (word: DictionaryResult) => {
        const currentStarred = get().starredWords
        const exists = currentStarred.find((w) => w.word === word.word)
        if (exists) {
          set({
            starredWords: currentStarred.filter((w) => w.word !== word.word),
          })
        } else {
          set({ starredWords: [word, ...currentStarred] })
        }
      },

      isWordStarred: (wordName: string) => {
        return get().starredWords.some((w) => w.word === wordName)
      },

      toggleFollowCommunity: (communityId: string) => {
        const currentFollows = get().followedCommunities
        const isFollowing = currentFollows.includes(communityId)
        if (isFollowing) {
          set({
            followedCommunities: currentFollows.filter(
              (id) => id !== communityId,
            ),
          })
        } else {
          set({ followedCommunities: [...currentFollows, communityId] })
        }
      },

      isFollowing: (communityId: string) => {
        return get().followedCommunities.includes(communityId)
      },

      addViewHistory: (post: ProductionPost) => {
        const { viewedPostIds, viewHistory } = get()
        if (viewedPostIds.includes(post.id)) return
        const newHistoryItem: ViewHistoryItem = {
          postId: post.id,
          viewedAt: new Date().toISOString(),
          post: post,
        }
        set({
          viewedPostIds: [...viewedPostIds, post.id],
          viewHistory: [newHistoryItem, ...viewHistory],
        })
      },

      isViewed: (postId: string) => {
        return get().viewedPostIds.includes(postId)
      },

      clearViewHistory: () => {
        set({ viewedPostIds: [], viewHistory: [] })
      },

      login: (userData: any) => {
        set({ currentUser: userData, isLoading: false })
      },

      logout: () => {
        set({ currentUser: null, likedPosts: [], followedCommunities: [] })
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      fetchProfile: async () => {
        const user = get().currentUser
        if (!user) return
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (data) {
          set({ profile: data })
        }
      },

      updateXP: async (amount: number) => {
        const user = get().currentUser
        const currentProfile = get().profile
        if (!user || !currentProfile) return
        const newXP = (currentProfile.total_xp || 0) + amount
        const { error } = await supabase
          .from('profiles')
          .update({
            total_xp: newXP,
            study_days: currentProfile.study_days + (amount > 0 ? 1 : 0),
          })
          .eq('id', user.id)
        if (!error) {
          set({ profile: { ...currentProfile, total_xp: newXP } })
        }
      },

      updateProfile: async (updates: any) => {
        const user = get().currentUser
        const currentProfile = get().profile
        if (!user) return
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
        if (!error) {
          set({ profile: { ...(currentProfile || {}), ...updates } })
        } else {
          throw error
        }
      },

      setProfile: (profile: any) => {
        set({ profile })
      },

      // [新增] 状态更新方法
      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },
    }),
    {
      name: 'scrollish-user-storage',
      storage: createJSONStorage(() => localStorage),
      // [新增] 监听 Hydration 完成
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true)
        }
      },
    },
  ),
)
