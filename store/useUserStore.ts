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
  followedCommunities: string[] // 存储关注的社区 ID
  viewedPostIds: string[] // 已浏览帖子的 ID 列表
  viewHistory: ViewHistoryItem[] // 完整的浏览历史

  currentUser: any | null
  profile: any | null
  isLoading: boolean
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
          set({ starredWords: currentStarred.filter((w) => w.word !== word.word) })
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
            followedCommunities: currentFollows.filter((id) => id !== communityId),
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

        // 如果已经浏览过,不重复添加
        if (viewedPostIds.includes(post.id)) {
          return
        }

        const newHistoryItem: ViewHistoryItem = {
          postId: post.id,
          viewedAt: new Date().toISOString(),
          post: post
        }

        set({
          viewedPostIds: [...viewedPostIds, post.id],
          viewHistory: [newHistoryItem, ...viewHistory] // 最新的在前面
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

        // 简单等级计算：LV = floor(sqrt(XP / 100)) + 1
        const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1

        const { error } = await supabase
          .from('profiles')
          .update({
            total_xp: newXP,
            study_days: currentProfile.study_days + (amount > 0 ? 1 : 0) // 临时演示：加 XP 就视为打卡
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
    }),
    {
      name: 'scrollish-user-storage', // LocalStorage Key
      storage: createJSONStorage(() => localStorage),
    },
  ),
)