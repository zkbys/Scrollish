import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ProductionPost } from './useAppStore'

interface UserState {
  likedPosts: ProductionPost[]

  // Actions
  toggleLike: (post: ProductionPost) => void
  isLiked: (postId: string) => boolean
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      likedPosts: [],

      toggleLike: (post: ProductionPost) => {
        const currentLikes = get().likedPosts
        const exists = currentLikes.find((p) => p.id === post.id)

        if (exists) {
          // 如果已存在，则移除 (取消点赞)
          set({ likedPosts: currentLikes.filter((p) => p.id !== post.id) })
        } else {
          // 如果不存在，则添加 (点赞/收藏)
          set({ likedPosts: [post, ...currentLikes] })
        }
      },

      isLiked: (postId: string) => {
        return get().likedPosts.some((p) => p.id === postId)
      },
    }),
    {
      name: 'scrollish-user-storage', // LocalStorage Key
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
