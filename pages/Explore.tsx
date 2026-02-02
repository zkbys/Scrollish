import React, {
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
} from 'react'
import { Page, Post } from '../types'
import { supabase } from '../supabase'
import { IMAGES } from '../constants'
import { useUserStore } from '../store/useUserStore'
import { useExploreStore } from '../store/useExploreStore'

interface ExploreProps {
  onNavigate?: (page: Page) => void
  onPostSelect?: (post: Post) => void
  onCommunitySelect?: (community: any) => void
}

const Explore: React.FC<ExploreProps> = ({
  onNavigate,
  onPostSelect,
  onCommunitySelect,
}) => {
  const { toggleFollowCommunity, isFollowing, toggleLike, isLiked } =
    useUserStore()
  const {
    categories,
    setCategories,
    trendingPosts,
    setTrendingPosts,
    categorySubreddits,
    setCategorySubreddits,
    activeCategoryId,
    setActiveCategoryId,
    scrollPos,
    setScrollPos,
    trendingScrollPos,
    setTrendingScrollPos,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    showResults,
    setShowResults,
    excludedTrendingIds,
    addExcludedTrendingIds,
    resetSearch,
  } = useExploreStore()

  const [isLoading, setIsLoading] = useState(categories.length === 0)
  const [isListLoading, setIsListLoading] = useState(false)
  const [isRefreshingTrending, setIsRefreshingTrending] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [isInputFocused, setIsInputFocused] = useState(false)

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const trendingContainerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        if (containerRef.current && scrollPos > 0) {
          containerRef.current.scrollTo({ top: scrollPos, behavior: 'instant' })
        }
        if (trendingContainerRef.current && trendingScrollPos > 0) {
          trendingContainerRef.current.scrollTo({
            left: trendingScrollPos,
            behavior: 'instant',
          })
        }
      })
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handleMainScroll = (e: React.UIEvent<HTMLDivElement>) =>
    setScrollPos(e.currentTarget.scrollTop)
  const handleTrendingScroll = (e: React.UIEvent<HTMLDivElement>) =>
    setTrendingScrollPos(e.currentTarget.scrollLeft)

  // Load Search History
  useEffect(() => {
    const savedHistory = localStorage.getItem('explore-search-history')
    if (savedHistory) setSearchHistory(JSON.parse(savedHistory))
  }, [])

  const fetchTrending = async (silent = false) => {
    if (!silent) {
      setIsRefreshingTrending(true)
      setTrendingScrollPos(0)
    }
    try {
      let query = supabase.from('production_posts').select('*')
      if (excludedTrendingIds.length > 0) {
        const idsToExclude = excludedTrendingIds.slice(-30)
        query = query.not('id', 'in', `(${idsToExclude.join(',')})`)
      }
      const { data } = await query
        .order('upvotes', { ascending: false })
        .limit(8)

      if (data && data.length > 0) {
        const shuffled = [...data].sort(() => Math.random() - 0.5)
        setTrendingPosts(shuffled)
        requestAnimationFrame(() =>
          addExcludedTrendingIds(shuffled.map((p) => p.id)),
        )
        if (!silent && trendingContainerRef.current) {
          setTimeout(
            () =>
              trendingContainerRef.current?.scrollTo({
                left: 0,
                behavior: 'smooth',
              }),
            100,
          )
        }
      } else if (excludedTrendingIds.length > 0) {
        const { data: retryData } = await supabase
          .from('production_posts')
          .select('*')
          .order('upvotes', { ascending: false })
          .limit(8)
        if (retryData) {
          const shuffled = [...retryData].sort(() => Math.random() - 0.5)
          setTrendingPosts(shuffled)
          if (!silent && trendingContainerRef.current) {
            setTimeout(
              () =>
                trendingContainerRef.current?.scrollTo({
                  left: 0,
                  behavior: 'smooth',
                }),
              100,
            )
          }
        }
      }
    } catch (err) {
      console.error('Error fetching trending:', err)
    } finally {
      setIsRefreshingTrending(false)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      if (categories.length > 0) {
        setIsLoading(false)
        if (trendingPosts.length === 0) fetchTrending(true)
        return
      }
      setIsLoading(true)
      try {
        const { data: catData } = await supabase
          .from('categories')
          .select('*')
          .order('name_en')
        if (catData) {
          setCategories(catData)
          if (catData.length > 0 && !activeCategoryId)
            setActiveCategoryId(catData[0].id)
        }
        await fetchTrending(true)
      } catch (error) {
        console.error('Error fetching explore data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const fetchSubreddits = useCallback(
    async (categoryId: string) => {
      if (categorySubreddits[categoryId]) return
      setIsListLoading(true)
      try {
        const { data } = await supabase
          .from('communities')
          .select('*')
          .eq('category_id', categoryId)
          .order('subscriber_count', { ascending: false })
        if (data) setCategorySubreddits(categoryId, data)
      } catch (error) {
        console.error('Error fetching subreddits:', error)
      } finally {
        setIsListLoading(false)
      }
    },
    [categorySubreddits, setCategorySubreddits],
  )

  useEffect(() => {
    if (activeCategoryId) fetchSubreddits(activeCategoryId)
  }, [activeCategoryId, fetchSubreddits])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    setShowResults(true)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const updatedHistory = [
          searchQuery,
          ...searchHistory.filter((h) => h !== searchQuery),
        ].slice(0, 5)
        setSearchHistory(updatedHistory)
        localStorage.setItem(
          'explore-search-history',
          JSON.stringify(updatedHistory),
        )
        const safeQuery = searchQuery.replace(/[%_]/g, '\\$&')
        const communityQuery = supabase
          .from('communities')
          .select('*')
          .or(`name.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%`)
          .limit(5)
        const postQuery = supabase
          .from('production_posts')
          .select('*')
          .or(`title_en.ilike.%${safeQuery}%,title_cn.ilike.%${safeQuery}%`)
          .limit(5)
        const [commRes, postRes] = await Promise.all([
          communityQuery,
          postQuery,
        ])
        setSearchResults({
          communities: commRes.data || [],
          posts: postRes.data || [],
        })
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 500)
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchQuery])

  const handlePostClick = (rawPost: any) => {
    if (onPostSelect) {
      onPostSelect({
        id: rawPost.id,
        user: rawPost.author || rawPost.subreddit || 'Anonymous',
        avatar: IMAGES.avatar1,
        titleEn: rawPost.title_en,
        titleZh: rawPost.title_cn || '',
        hashtags: [],
        image: rawPost.image_url || IMAGES.london,
        videoUrl: rawPost.video_url || null,
        likes: rawPost.upvotes?.toString() || '0',
        stars: '0',
        comments: 0,
        image_type: rawPost.image_type,
        subreddit: rawPost.subreddit,
        community_id: rawPost.community_id,
      })
    }
  }

  const handleCommunityClick = (community: any) =>
    onCommunitySelect && onCommunitySelect(community)
  const handleJoinClick = (e: React.MouseEvent, communityId: string) => {
    e.stopPropagation()
    toggleFollowCommunity(communityId)
    if (navigator.vibrate) navigator.vibrate(50)
  }

  const formatSubscribers = (count: number) =>
    count >= 1000000
      ? `${(count / 1000000).toFixed(1)}M`
      : count >= 1000
        ? `${(count / 1000).toFixed(1)}K`
        : count.toString()
  const getCommunityGradient = (name: string) =>
    [
      'from-indigo-500 to-purple-600',
      'from-blue-600 to-cyan-500',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-pink-500 to-rose-600',
      'from-violet-600 to-fuchsia-500',
      'from-amber-500 to-orange-600',
      'from-lime-500 to-green-600',
    ][name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 8]

  const highlightText = (text: string, query: string) => {
    if (!text) return null
    if (!query.trim()) return text
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    try {
      return (
        <>
          {text.split(new RegExp(`(${escapedQuery})`, 'gi')).map((part, i) =>
            part.toLowerCase() === query.toLowerCase() ? (
              <span
                key={i}
                className="text-primary font-black underline decoration-primary/30 underline-offset-2">
                {part}
              </span>
            ) : (
              part
            ),
          )}
        </>
      )
    } catch (e) {
      return text
    }
  }

  if (isLoading)
    return (
      <div className="h-full w-full bg-gray-50 dark:bg-[#0B0A09] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    )

  const currentCategoryData = activeCategoryId
    ? categorySubreddits[activeCategoryId] || []
    : []

  return (
    <div
      ref={containerRef}
      onScroll={handleMainScroll}
      className="h-full flex flex-col bg-background-light dark:bg-background-dark text-gray-900 dark:text-white overflow-y-auto no-scrollbar select-none relative transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-black/60 backdrop-blur-md border-b border-gray-100 dark:border-white/5 transition-colors">
        <div className="flex items-center px-5 pt-12 pb-4 justify-between">
          <button className="h-9 w-9 flex items-center justify-center bg-gray-100 dark:bg-white/10 rounded-full active:scale-90 transition-transform border border-gray-200 dark:border-white/5">
            <span className="material-symbols-outlined text-[20px] text-gray-700 dark:text-white/90">
              menu
            </span>
          </button>
          <h1 className="text-gray-900 dark:text-white text-[17px] font-black tracking-tight flex-1 text-center">
            Discovery
          </h1>
          <button className="h-9 w-9 flex items-center justify-center bg-gray-100 dark:bg-white/10 rounded-full active:scale-90 transition-transform border border-gray-200 dark:border-white/5">
            <span className="material-symbols-outlined text-[20px] text-gray-700 dark:text-white/90">
              notifications
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-5 pb-4 relative">
          <div className="flex w-full items-center rounded-2xl h-11 bg-gray-100 dark:bg-white/10 border border-transparent focus-within:border-primary/50 focus-within:bg-white dark:focus-within:bg-[#1C1C1E] px-4 gap-3 transition-all shadow-sm dark:shadow-none">
            {isSearching ? (
              <div className="w-5 h-5 flex items-center justify-center">
                <div className="w-3.5 h-3.5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : (
              <span className="material-symbols-outlined text-[20px] text-gray-400 dark:text-white/40">
                search
              </span>
            )}
            <input
              className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 text-sm font-medium"
              placeholder="Search subreddits or topics"
              value={searchQuery}
              onFocus={() => {
                setIsInputFocused(true)
                setShowResults(searchQuery.length > 0)
              }}
              onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  resetSearch()
                  setShowResults(false)
                }}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            )}
          </div>

          {/* Search Results */}
          {showResults && searchQuery && (
            <div className="absolute top-[calc(100%-8px)] left-5 right-5 bg-white dark:bg-[#121111] border border-gray-100 dark:border-white/10 rounded-2xl shadow-xl z-[100] max-h-[70vh] overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 space-y-6">
                <section>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-white/30 mb-3 px-1">
                    Communities
                  </h3>
                  {searchResults.communities.length > 0 ? (
                    <div className="space-y-1">
                      {searchResults.communities.map((comm) => (
                        <div
                          key={comm.id}
                          onClick={() => handleCommunityClick(comm)}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group">
                          <div
                            className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getCommunityGradient(comm.name)} flex items-center justify-center border border-white/10 shadow-md`}>
                            <span className="text-xs font-black text-white">
                              {comm.name.substring(0, 1).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 dark:text-white/90">
                              r/{highlightText(comm.name, searchQuery)}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-white/30 font-medium">
                              {highlightText(
                                comm.display_name || '',
                                searchQuery,
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !isSearching && (
                      <p className="text-[11px] text-gray-400 px-1 italic">
                        No communities found
                      </p>
                    )
                  )}
                </section>
                <section>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-white/30 mb-3 px-1">
                    Matched Content
                  </h3>
                  {searchResults.posts.length > 0 ? (
                    <div className="space-y-3">
                      {searchResults.posts.map((post) => (
                        <div
                          key={post.id}
                          onClick={() => handlePostClick(post)}
                          className="flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group">
                          <div className="w-12 h-16 rounded-lg bg-cover bg-center shrink-0 border border-gray-200 dark:border-white/5 shadow-md relative overflow-hidden">
                            <img
                              src={post.image_url}
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              alt=""
                            />
                          </div>
                          <div className="flex flex-col justify-center gap-1 min-w-0">
                            <span className="text-[13px] font-black text-gray-900 dark:text-white/90 line-clamp-1 tracking-tight">
                              {highlightText(post.title_en, searchQuery)}
                            </span>
                            <p className="text-[11px] text-gray-500 dark:text-white/40 line-clamp-1 font-medium">
                              {highlightText(post.title_cn || '', searchQuery)}
                            </p>
                            <span className="text-[9px] text-primary font-black uppercase tracking-widest mt-0.5">
                              r/{post.subreddit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !isSearching && (
                      <p className="text-[11px] text-gray-400 px-1 italic">
                        No content matching "{searchQuery}"
                      </p>
                    )
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </header>

      <div
        className={`transition-all duration-300 ${showResults ? 'blur-md opacity-40' : 'blur-0 opacity-100'}`}>
        {/* Trending */}
        <section className="mt-2">
          <div className="flex items-center justify-between px-5 pb-3 pt-4">
            <h2 className="text-gray-900 dark:text-white text-xl font-black tracking-tight underline decoration-primary/30 underline-offset-8">
              Trending Today
            </h2>
            <div className="flex items-center gap-2">
              {isRefreshingTrending && (
                <div className="w-3 h-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              )}
              <span
                onClick={() => fetchTrending()}
                className="text-primary text-xs font-bold uppercase tracking-widest cursor-pointer hover:opacity-80">
                Refresh
              </span>
            </div>
          </div>

          <div
            ref={trendingContainerRef}
            onScroll={handleTrendingScroll}
            className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory px-5 gap-4 pb-8">
            {trendingPosts.map((post) => (
              <div
                key={post.id}
                className="flex flex-col gap-3 shrink-0 w-56 snap-start transition-all duration-300 relative">
                <div
                  onClick={() => handlePostClick(post)}
                  className="relative w-full aspect-[3/4.2] rounded-[2rem] overflow-hidden border border-gray-100 dark:border-white/5 bg-gray-200 dark:bg-[#1A1A1A] active:scale-[0.98] transition-transform cursor-pointer group shadow-sm dark:shadow-none">
                  <div className="absolute inset-0">
                    {post.video_url ? (
                      <video
                        src={post.video_url}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        playsInline
                        autoPlay
                      />
                    ) : (
                      <img
                        src={post.image_url}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        alt=""
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/10" />
                  </div>
                  {post.image_type === 'generated' && (
                    <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-2.5 py-1 bg-black/30 backdrop-blur-md rounded-full border border-white/10">
                      <span className="material-symbols-outlined text-[12px] text-primary">
                        auto_awesome
                      </span>
                      <span className="text-[9px] font-black text-white/90 uppercase tracking-tighter">
                        AI Art
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-5 left-5 right-5 z-20">
                    <p className="text-[14px] font-black text-white leading-snug tracking-tight line-clamp-1">
                      {post.title_en}
                    </p>
                    <p className="text-[11px] font-medium text-white/70 line-clamp-1 mt-0.5">
                      {post.title_cn}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tabs */}
        <nav className="sticky top-[156px] z-40 bg-gray-50/90 dark:bg-[#0B0A09]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 transition-colors">
          <div className="flex overflow-x-auto no-scrollbar px-5 gap-8">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`flex flex-col items-center justify-center pb-3 pt-4 shrink-0 transition-all ${activeCategoryId === cat.id ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-white/40'}`}>
                <span className="text-sm font-black tracking-tight">
                  {cat.name_en}
                </span>
                {activeCategoryId === cat.id && (
                  <div className="mt-1 w-4 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]" />
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* List */}
        <main className="flex-1 p-5 space-y-4 mb-24 min-h-[400px]">
          {isListLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-20">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-white">
                Loading...
              </p>
            </div>
          ) : currentCategoryData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-white/20">
              <span className="material-symbols-outlined text-6xl mb-4 opacity-20">
                explore_off
              </span>
              <p className="text-xs font-black uppercase tracking-[0.2em]">
                No Communities Found
              </p>
            </div>
          ) : (
            currentCategoryData.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center gap-4 bg-white dark:bg-white/5 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm dark:shadow-none transition-all hover:bg-gray-50 dark:hover:bg-white/[0.07]">
                <div
                  className={`size-14 rounded-2xl bg-gradient-to-br ${getCommunityGradient(sub.name)} border border-white/10 flex items-center justify-center shrink-0 text-white shadow-md`}>
                  <span className="text-lg font-black">
                    {sub.name.substring(0, 1).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-black text-gray-900 dark:text-white truncate tracking-tight">
                      r/{sub.name}
                    </h3>
                    {sub.subscriber_count > 1000000 && (
                      <span className="material-symbols-outlined text-[14px] text-blue-400">
                        verified
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-white/40 uppercase tracking-widest mt-0.5">
                    {sub.sub_category || 'Discussion'}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={(e) => handleJoinClick(e, sub.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${isFollowing(sub.id) ? 'bg-gray-900 dark:bg-white text-white dark:text-black border-transparent' : 'bg-transparent text-primary border-primary/40 hover:border-primary/60'}`}>
                      <span className="material-symbols-outlined text-[14px] font-bold">
                        {isFollowing(sub.id) ? 'done' : 'add'}
                      </span>
                      {isFollowing(sub.id) ? 'Joined' : 'Join'}
                    </button>
                    <span className="text-[11px] text-gray-400 dark:text-white/20 font-bold tracking-tight">
                      {formatSubscribers(sub.subscriber_count)}
                    </span>
                  </div>
                </div>
                <div
                  onClick={() => handleCommunityClick(sub)}
                  className="size-11 bg-gray-50 dark:bg-white/5 hover:bg-primary rounded-full flex items-center justify-center border border-gray-200 dark:border-white/10 transition-all active:scale-90 cursor-pointer group hover:text-white">
                  <span className="material-symbols-outlined text-gray-400 dark:text-white/30 group-hover:text-white transition-colors text-[24px]">
                    chevron_right
                  </span>
                </div>
              </div>
            ))
          )}
        </main>
      </div>
    </div>
  )
}

export default Explore
