import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { ProductionPost } from './useAppStore'

export interface ViewHistoryItem {
    postId: string
    viewedAt: string
    post: ProductionPost
}

interface HistoryState {
    likedPosts: ProductionPost[]
    viewedPostIds: string[]
    viewHistory: ViewHistoryItem[]
    followedCommunities: string[]

    // Actions
    toggleLike: (post: ProductionPost) => void
    isLiked: (postId: string) => boolean
    addViewHistory: (post: ProductionPost) => void
    isViewed: (postId: string) => boolean
    clearViewHistory: () => void
    toggleFollowCommunity: (communityId: string) => void
    isFollowing: (communityId: string) => boolean
}

export const useHistoryStore = create<HistoryState>()(
    persist(
        (set, get) => ({
            likedPosts: [],
            viewedPostIds: [],
            viewHistory: [],
            followedCommunities: [],

            toggleLike: (post) => {
                const currentLikes = get().likedPosts
                const exists = currentLikes.find((p) => p.id === post.id)
                if (exists) {
                    set({ likedPosts: currentLikes.filter((p) => p.id !== post.id) })
                } else {
                    set({ likedPosts: [post, ...currentLikes] })
                }
            },

            isLiked: (postId) => get().likedPosts.some((p) => p.id === postId),

            addViewHistory: (post) => {
                const { viewedPostIds, viewHistory } = get()
                const filteredHistory = viewHistory.filter(h => h.postId !== post.id)
                const newHistoryItem: ViewHistoryItem = {
                    postId: post.id,
                    viewedAt: new Date().toISOString(),
                    post: post,
                }
                set({
                    viewedPostIds: viewedPostIds.includes(post.id)
                        ? viewedPostIds
                        : [...viewedPostIds, post.id],
                    viewHistory: [newHistoryItem, ...filteredHistory],
                })
            },

            isViewed: (postId) => get().viewedPostIds.includes(postId),

            clearViewHistory: () => set({ viewedPostIds: [], viewHistory: [] }),

            toggleFollowCommunity: (communityId) => {
                const currentFollows = get().followedCommunities
                if (currentFollows.includes(communityId)) {
                    set({ followedCommunities: currentFollows.filter(id => id !== communityId) })
                } else {
                    set({ followedCommunities: [...currentFollows, communityId] })
                }
            },

            isFollowing: (communityId) => get().followedCommunities.includes(communityId),
        }),
        {
            name: 'scrollish-history-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
)
