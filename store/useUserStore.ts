import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { supabase } from '../supabase'
import { ProductionPost } from './useAppStore'
import { DictionaryResult } from './useDictionaryStore' // 保留这个导入

interface UserState {
  likedPosts: ProductionPost[]
  starredWords: DictionaryResult[] // 保留单词收藏功能
  followedCommunities: string[] // 存储关注的社区 ID
  currentUser: any | null
  profile: any | null
  isLoading: boolean
  _hasHydrated: boolean

  // Actions
  toggleLike: (post: ProductionPost) => void
  isLiked: (postId: string) => boolean
  toggleStarWord: (word: DictionaryResult) => void // 保留单词收藏方法
  isWordStarred: (wordName: string) => boolean // 保留单词收藏检查
  toggleFollowCommunity: (communityId: string) => void
  isFollowing: (communityId: string) => boolean
  login: (user: any) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  fetchProfile: () => Promise<void>
  updateXP: (amount: number) => Promise<void>
  updateProfile: (updates: any) => Promise<void>
  setHasHydrated: (state: boolean) => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      likedPosts: [],
      starredWords: [], // 初始化 starredWords
      followedCommunities: [],
      currentUser: null,
      profile: null,
      isLoading: true,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

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

      login: (userData: any) => {
        set({ currentUser: userData, isLoading: false })
      },

      logout: () => {
        set({
          currentUser: null,
          likedPosts: [],
          starredWords: [], // 登出时清空 starredWords
          followedCommunities: [],
          profile: null,
        })
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      fetchProfile: async () => {
        const user = get().currentUser
        if (!user) return
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (data) set({ profile: data })
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

        // 1. 立即更新本地 Store (Optimistic Update)
        const newProfile = { ...(currentProfile || {}), ...updates }
        set({ profile: newProfile })

        if (!user) return

        // 2. 尝试同步到 Supabase
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)

        if (error) {
          console.error(
            'Failed to sync profile to DB, but local state updated:',
            error,
          )
        }
      },
    }),
    {
      name: 'scrollish-user-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)