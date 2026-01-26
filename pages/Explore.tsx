
import React, { useEffect, useState, useRef } from 'react';
import { Page, Post } from '../types';
import { supabase } from '../supabase';
import { IMAGES } from '../constants';
import { useUserStore } from '../store/useUserStore';

interface ExploreProps {
  onNavigate?: (page: Page) => void;
  onPostSelect?: (post: Post) => void;
  onCommunitySelect?: (communityId: string) => void;
}

const Explore: React.FC<ExploreProps> = ({ onNavigate, onPostSelect, onCommunitySelect }) => {
  const { toggleFollowCommunity, isFollowing } = useUserStore();
  const [categories, setCategories] = useState<{ id: string, name_en: string, name_cn: string }[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [trendingCommunities, setTrendingCommunities] = useState<any[]>([]);
  const [categorySubreddits, setCategorySubreddits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    communities: any[];
    posts: any[];
  }>({ communities: [], posts: [] });
  const [showResults, setShowResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load Search History
  useEffect(() => {
    const savedHistory = localStorage.getItem('explore-search-history');
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory));
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: catData } = await supabase
          .from('categories')
          .select('*')
          .order('name_en');

        if (catData) {
          setCategories(catData);
          if (catData.length > 0) setActiveCategory(catData[0].id);
        }

        const { data: trendCommData } = await supabase
          .from('communities')
          .select('*')
          .eq('is_active', true)
          .order('subscriber_count', { ascending: false })
          .limit(10);

        if (trendCommData) setTrendingCommunities(trendCommData);

      } catch (error) {
        console.error('Error fetching explore initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchSubreddits = async () => {
      if (!activeCategory) return;
      setIsListLoading(true);
      try {
        const { data } = await supabase
          .from('communities')
          .select('*')
          .eq('category_id', activeCategory)
          .order('subscriber_count', { ascending: false });
        if (data) setCategorySubreddits(data);
      } catch (error) {
        console.error('Error fetching category communities:', error);
      } finally {
        setIsListLoading(false);
      }
    };

    fetchSubreddits();
  }, [activeCategory]);

  // Search Logic with Debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ communities: [], posts: [] });
      setIsSearching(false);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Save to history
        const updatedHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 5);
        setSearchHistory(updatedHistory);
        localStorage.setItem('explore-search-history', JSON.stringify(updatedHistory));

        const communityQuery = supabase
          .from('communities')
          .select('*')
          .or(`name.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
          .limit(5);

        const postQuery = supabase
          .from('production_posts')
          .select('*')
          .or(`title_en.ilike.%${searchQuery}%,title_cn.ilike.%${searchQuery}%`)
          .limit(5);

        const [commRes, postRes] = await Promise.all([communityQuery, postQuery]);

        setSearchResults({
          communities: commRes.data || [],
          posts: postRes.data || [],
        });
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const handlePostClick = (rawPost: any) => {
    if (onPostSelect) {
      const mappedPost: Post = {
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
      };
      onPostSelect(mappedPost);
    }
  };

  const handleCommunityClick = (community: any) => {
    if (onCommunitySelect) {
      onCommunitySelect(community.id);
    }
  };

  const handleJoinClick = (e: React.MouseEvent, communityId: string) => {
    e.stopPropagation();
    toggleFollowCommunity(communityId);
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const formatSubscribers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  // Helper to pick a placeholder image based on name
  const getSubredditImages = (name: string) => {
    const keys = Object.keys(IMAGES);
    const index = Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % keys.length;
    return IMAGES[keys[index] as keyof typeof IMAGES];
  };

  // Dynamic Avatar Gradient Generator
  const getCommunityGradient = (name: string) => {
    const gradients = [
      'from-indigo-500 to-purple-600',
      'from-blue-600 to-cyan-500',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-pink-500 to-rose-600',
      'from-violet-600 to-fuchsia-500',
      'from-amber-500 to-orange-600',
      'from-lime-500 to-green-600',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return gradients[hash % gradients.length];
  };

  // Search Highlighting Logic
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="text-primary font-black underline decoration-primary/30 underline-offset-2">{part}</span>
          ) : part
        )}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#0B0A09] text-white overflow-y-auto no-scrollbar select-none relative">
      {/* Header Area */}
      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center px-5 pt-12 pb-4 justify-between">
          <button className="h-9 w-9 flex items-center justify-center bg-white/10 rounded-full active:scale-90 transition-transform border border-white/5">
            <span className="material-symbols-outlined text-[20px] text-white/90">menu</span>
          </button>

          <h1 className="text-white text-[17px] font-black tracking-tight flex-1 text-center">Discovery</h1>

          <button className="h-9 w-9 flex items-center justify-center bg-white/10 rounded-full active:scale-90 transition-transform border border-white/5">
            <span className="material-symbols-outlined text-[20px] text-white/90">notifications</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-5 pb-4 relative">
          <div className="flex w-full items-center rounded-2xl h-11 bg-white/10 border border-white/10 px-4 gap-3 focus-within:border-primary/50 transition-all">
            {isSearching ? (
              <div className="w-5 h-5 flex items-center justify-center">
                <div className="w-3.5 h-3.5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : (
              <span className="material-symbols-outlined text-[20px] text-white/40">search</span>
            )}
            <input
              className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder:text-white/30 text-sm font-medium"
              placeholder="Search subreddits or topics"
              value={searchQuery}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-white/40 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Search History Chips */}
          {isInputFocused && !searchQuery && searchHistory.length > 0 && (
            <div className="absolute top-[calc(100%+8px)] left-5 right-5 z-[110] animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="bg-[#121111] border border-white/10 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Recent Searches</h3>
                  <button
                    onClick={() => {
                      setSearchHistory([]);
                      localStorage.removeItem('explore-search-history');
                    }}
                    className="text-[9px] font-bold text-white/20 hover:text-primary transition-colors"
                  >
                    CLEAR ALL
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => setSearchQuery(item)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-xs font-bold text-white/60 transition-all active:scale-95"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Search Results Overlay */}
          {showResults && searchQuery && (
            <div className="absolute top-[calc(100%-8px)] left-5 right-5 bg-[#121111] border border-white/10 rounded-2xl shadow-2xl z-[100] max-h-[70vh] overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 space-y-6">
                <section>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3 px-1">Communities</h3>
                  {searchResults.communities.length > 0 ? (
                    <div className="space-y-1">
                      {searchResults.communities.map((comm) => (
                        <div
                          key={comm.id}
                          onClick={() => handleCommunityClick(comm)}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                        >
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getCommunityGradient(comm.name)} flex items-center justify-center border border-white/10 shadow-lg`}>
                            <span className="text-xs font-black text-white group-hover:scale-110 transition-transform">
                              {comm.name.substring(0, 1).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white/90">r/{highlightText(comm.name, searchQuery)}</span>
                            <span className="text-[10px] text-white/30 font-medium">{highlightText(comm.display_name, searchQuery)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !isSearching && (
                    <p className="text-[11px] text-white/20 px-1 italic">No communities found</p>
                  )}
                </section>

                <section>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3 px-1">Matched Content</h3>
                  {searchResults.posts.length > 0 ? (
                    <div className="space-y-3">
                      {searchResults.posts.map((post) => (
                        <div
                          key={post.id}
                          onClick={() => handlePostClick(post)}
                          className="flex gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                        >
                          <div
                            className="w-12 h-16 rounded-lg bg-cover bg-center shrink-0 border border-white/5 shadow-md relative overflow-hidden"
                          >
                            <img
                              src={post.image_url}
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              alt=""
                            />
                          </div>
                          <div className="flex flex-col justify-center gap-1 min-w-0">
                            <span className="text-[13px] font-black text-white/90 line-clamp-1 tracking-tight">{highlightText(post.title_en, searchQuery)}</span>
                            <p className="text-[11px] text-white/40 line-clamp-1 font-medium">{post.title_cn}</p>
                            <span className="text-[9px] text-primary font-black uppercase tracking-widest mt-0.5">r/{post.subreddit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !isSearching && (
                    <p className="text-[11px] text-white/20 px-1 italic">No content matching "{searchQuery}"</p>
                  )}
                </section>

                {isSearching && (
                  <div className="py-4 flex flex-col items-center justify-center opacity-40">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${showResults ? 'blur-md grayscale opacity-40' : 'blur-0 grayscale-0 opacity-100'}`}>
        {/* Trending Subreddits Section */}
        <section className="mt-2">
          <div className="flex items-center justify-between px-5 pb-3 pt-4">
            <h2 className="text-white text-xl font-black tracking-tight">Trending Subreddits</h2>
            <span className="text-primary text-xs font-bold uppercase tracking-widest text-[#FF4500]">Top Communities</span>
          </div>

          <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory px-5 gap-4 pb-6">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="w-64 aspect-[16/10] bg-white/5 rounded-2xl animate-pulse shrink-0" />
              ))
            ) : (
              trendingCommunities.map((comm) => (
                <div
                  key={comm.id}
                  onClick={() => handleCommunityClick(comm)}
                  className="flex flex-col gap-3 shrink-0 w-64 snap-start active:scale-95 transition-transform group"
                >
                  <div
                    className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden border border-white/5 bg-[#1A1A1A] bg-cover bg-center"
                    style={{ backgroundImage: `url("${getSubredditImages(comm.name)}")` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-primary text-white text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-lg">Trending</span>
                        <span className="text-[10px] text-white/60 font-bold bg-white/10 backdrop-blur-md px-2 py-0.5 rounded border border-white/5">
                          {comm.sub_category || 'Topic'}
                        </span>
                      </div>
                      <p className="text-lg font-black text-white tracking-tight">r/{comm.name}</p>
                    </div>
                  </div>
                  <div className="px-1 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-white/90 truncate max-w-[180px]">{comm.display_name}</p>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{formatSubscribers(comm.subscriber_count)} Subscribers</p>
                    </div>
                    <span className="material-symbols-outlined text-white/20 group-hover:text-primary transition-colors">arrow_forward_ios</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Category Tabs (Dynamic 13 categories) */}
        <nav className="sticky top-[156px] z-40 bg-[#0B0A09]/80 backdrop-blur-md border-b border-white/5">
          <div className="flex overflow-x-auto no-scrollbar px-5 gap-8">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex flex-col items-center justify-center pb-3 pt-4 shrink-0 transition-all ${activeCategory === cat.id ? 'text-white' : 'text-white/40'
                  }`}
              >
                <span className="text-sm font-black tracking-tight">{cat.name_en}</span>
                {activeCategory === cat.id && (
                  <div className="mt-1 w-4 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]" />
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Community List for selected Category */}
        <main className="flex-1 p-5 space-y-4 mb-24 min-h-[400px]">
          {isListLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-20">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white">Loading...</p>
            </div>
          ) : categorySubreddits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/20 animate-in fade-in zoom-in-95 duration-500">
              <span className="material-symbols-outlined text-6xl mb-4 opacity-10">explore_off</span>
              <p className="text-xs font-black uppercase tracking-[0.2em]">No Communities Found</p>
              <p className="text-[10px] mt-2 font-bold opacity-40">Try another category or search above</p>
            </div>
          ) : (
            categorySubreddits.map((sub) => (
              <div
                key={sub.id}
                onClick={() => handleCommunityClick(sub)}
                className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className={`size-14 rounded-2xl bg-gradient-to-br ${getCommunityGradient(sub.name)} border border-white/10 flex items-center justify-center shrink-0 overflow-hidden shadow-lg relative`}>
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                  <span className="text-lg font-black text-white group-hover:scale-110 transition-transform">
                    {sub.name.substring(0, 1).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-black text-white truncate tracking-tight">r/{sub.name}</h3>
                    {sub.subscriber_count > 1000000 && (
                      <span className="material-symbols-outlined text-[14px] text-blue-400">verified</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{sub.sub_category || 'Discussion'}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[11px] text-primary font-black">{formatSubscribers(sub.subscriber_count)} Subs</span>
                    <div className="w-1 h-1 rounded-full bg-white/10"></div>
                    <button
                      onClick={(e) => handleJoinClick(e, sub.id)}
                      className={`text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${isFollowing(sub.id) ? 'text-primary' : 'text-white/40 hover:text-white'
                        }`}
                    >
                      {isFollowing(sub.id) ? 'Joined' : 'Join'}
                    </button>
                  </div>
                </div>
                <span className="material-symbols-outlined text-white/10 group-hover:text-white/40 transition-all -translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100">
                  {isFollowing(sub.id) ? 'done' : 'chevron_right'}
                </span>
              </div>
            ))
          )}
        </main>
      </div>
    </div>
  );
};

export default Explore;
