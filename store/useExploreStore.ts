
import { create } from 'zustand'

interface ExploreState {
    // Data
    categories: any[]
    trendingPosts: any[]
    categorySubreddits: Record<string, any[]>
    activeCategoryId: string | null

    // Navigation & Scroll
    scrollPos: number
    trendingScrollPos: number

    // Search state
    searchQuery: string
    searchResults: { communities: any[]; posts: any[] }
    showResults: boolean

    // Refresh optimization
    excludedTrendingIds: string[]

    // Actions
    setCategories: (categories: any[]) => void
    setTrendingPosts: (posts: any[]) => void
    setCategorySubreddits: (categoryId: string, subreddits: any[]) => void
    setActiveCategoryId: (id: string | null) => void
    setScrollPos: (pos: number) => void
    setTrendingScrollPos: (pos: number) => void
    setSearchQuery: (query: string) => void
    setSearchResults: (results: { communities: any[]; posts: any[] }) => void
    setShowResults: (show: boolean) => void
    addExcludedTrendingIds: (ids: string[]) => void
    resetSearch: () => void
}

export const useExploreStore = create<ExploreState>((set) => ({
    categories: [],
    trendingPosts: [],
    categorySubreddits: {},
    activeCategoryId: null,
    scrollPos: 0,
    trendingScrollPos: 0,
    searchQuery: '',
    searchResults: { communities: [], posts: [] },
    showResults: false,
    excludedTrendingIds: [],

    setCategories: (categories) => set({ categories }),
    setTrendingPosts: (posts) => set({ trendingPosts: posts }),
    setCategorySubreddits: (categoryId, subreddits) =>
        set((state) => ({
            categorySubreddits: { ...state.categorySubreddits, [categoryId]: subreddits }
        })),
    setActiveCategoryId: (id) => set({ activeCategoryId: id }),
    setScrollPos: (pos) => set({ scrollPos: pos }),
    setTrendingScrollPos: (pos) => set({ trendingScrollPos: pos }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSearchResults: (results) => set({ searchResults: results }),
    setShowResults: (show) => set({ showResults: show }),
    addExcludedTrendingIds: (ids) => set((state) => ({
        excludedTrendingIds: Array.from(new Set([...state.excludedTrendingIds, ...ids])).slice(-50)
    })),
    resetSearch: () => set({ searchQuery: '', searchResults: { communities: [], posts: [] }, showResults: false }),
}))
