
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

    // Page-specific scroll positions
    scrollPositions: Record<string, number>
    // Data cache
    communityPostsCache: Record<string, any[]>

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
    setScrollPosition: (key: string, pos: number) => void
    setCommunityPostsCache: (communityId: string, posts: any[]) => void
    initializeExplore: () => Promise<void>
}

export const useExploreStore = create<ExploreState>((set, get) => ({
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
    scrollPositions: {},
    communityPostsCache: {},
    setCommunityPostsCache: (communityId, posts) => set((state) => ({
        communityPostsCache: { ...state.communityPostsCache, [communityId]: posts }
    })),
    setScrollPosition: (key, pos) => set((state) => ({
        scrollPositions: { ...state.scrollPositions, [key]: pos }
    })),
    resetSearch: () => set({ searchQuery: '', searchResults: { communities: [], posts: [] }, showResults: false }),

    initializeExplore: async () => {
        const { categories, trendingPosts, excludedTrendingIds } = get()

        // If we already have categories, we don't need a full re-initialization
        // but we might want to refresh trending if it's empty
        const shouldFetchCategories = categories.length === 0
        const shouldFetchTrending = trendingPosts.length === 0

        if (!shouldFetchCategories && !shouldFetchTrending) return

        try {
            const promises: Promise<any>[] = []

            if (shouldFetchCategories) {
                promises.push(
                    import('../supabase').then(m =>
                        m.supabase.from('categories').select('*').order('name_en')
                    )
                )
            }

            if (shouldFetchTrending) {
                let query = import('../supabase').then(m => {
                    let q = m.supabase.from('production_posts').select('id, community_id, title_en, title_cn, image_url, video_url, image_type, upvotes, subreddit, created_at')
                    if (excludedTrendingIds.length > 0) {
                        const idsToExclude = excludedTrendingIds.slice(-30)
                        q = q.not('id', 'in', `(${idsToExclude.join(',')})`)
                    }
                    return q.order('upvotes', { ascending: false }).limit(8)
                })
                promises.push(query)
            }

            const results = await Promise.all(promises)
            let resultIdx = 0

            const newState: Partial<ExploreState> = {}

            if (shouldFetchCategories) {
                const catRes = results[resultIdx++]
                if (catRes.data) {
                    newState.categories = catRes.data
                    if (catRes.data.length > 0 && !get().activeCategoryId) {
                        newState.activeCategoryId = catRes.data[0].id
                    }
                }
            }

            if (shouldFetchTrending) {
                const trendRes = results[resultIdx++]
                if (trendRes.data && trendRes.data.length > 0) {
                    newState.trendingPosts = [...trendRes.data].sort(() => Math.random() - 0.5)
                }
            }

            if (Object.keys(newState).length > 0) {
                set(newState as any)
            }
        } catch (error) {
            console.error('Error pre-fetching explore data:', error)
        }
    }
}))

