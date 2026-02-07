import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { supabase } from '../supabase'
import { ProductionPost } from './useAppStore' // 确保路径正确，如果不引用 AppStore 类型可忽略

interface UserState {
  likedPosts: ProductionPost[]
  followedCommunities: string[]
  currentUser: any | null
  profile: any | null
  isLoading: boolean
  // [新增] 水合状态标记
  _hasHydrated: boolean

  // Actions
  toggleLike: (post: ProductionPost) => void
  isLiked: (postId: string) => boolean
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
      followedCommunities: [],
      currentUser: null,
      profile: null,
      isLoading: true,
      _hasHydrated: false, // 默认未完成

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

      // [核心修复] 乐观更新：先更新本地，再同步服务器，防止因网络问题卡在 Onboarding
      updateProfile: async (updates: any) => {
        const user = get().currentUser
        const currentProfile = get().profile

        // 1. 立即更新本地 Store (Optimistic Update)
        // 这样 App 就会检测到 profile.learning_reason 已存在，不会强制跳转回 Onboarding
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
          // 这里不回滚，优先保证用户体验流畅
        }
      },
    }),
    {
      name: 'scrollish-user-storage',
      storage: createJSONStorage(() => localStorage),
      // [关键] 监听 hydration 完成
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
