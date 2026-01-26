import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ProductionPost } from './useAppStore'

interface UserState {
  likedPosts: ProductionPost[]
  followedCommunities: string[] // 存储关注的社区 ID

  // Actions
  toggleLike: (post: ProductionPost) => void
  isLiked: (postId: string) => boolean
  toggleFollowCommunity: (communityId: string) => void
  isFollowing: (communityId: string) => boolean
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      likedPosts: [],
      followedCommunities: [],

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
            followedCommunities: currentFollows.filter((id) => id !== communityId),
          })
        } else {
          set({ followedCommunities: [...currentFollows, communityId] })
        }
      },

      isFollowing: (communityId: string) => {
        return get().followedCommunities.includes(communityId)
      },
    }),
    {
      name: 'scrollish-user-storage', // LocalStorage Key
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
