import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Page, Post } from '../types';
import { supabase } from '../supabase';
import { IMAGES } from '../constants';
import { useUserStore } from '../store/useUserStore';
import { useExploreStore } from '../store/useExploreStore';

interface CommunityDetailProps {
    community: {
        id: string;
        name: string;
        display_name: string;
        description: string;
        icon_img?: string;
        subscribers?: number;
        banner_img?: string;
    };
    onBack: () => void;
    onPostSelect: (post: Post) => void;
}

const CommunityDetail: React.FC<CommunityDetailProps> = ({ community, onBack, onPostSelect }) => {
    const { scrollPositions, setScrollPosition, communityPostsCache, setCommunityPostsCache } = useExploreStore();

    // Initialize from cache if available to prevent flash
    const cachedPosts = communityPostsCache[community.id];
    const [posts, setPosts] = useState<Post[]>(cachedPosts || []);
    const [loading, setLoading] = useState(!cachedPosts);
    const [isRestored, setIsRestored] = useState(!!cachedPosts); // Logic: if cached, we are "restored" immediately (or will be in layout effect)
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { toggleFollowCommunity, isFollowing } = useUserStore();

    const isSubscribed = isFollowing(community.id);

    // Scroll restoration key unique to this community
    const scrollKey = `community-${community.id}`;
    const savedScrollPos = scrollPositions[scrollKey] || 0;

    useEffect(() => {
        if (cachedPosts) return;

        const fetchCommunityPosts = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('production_posts')
                    .select('*')
                    .eq('subreddit', community.name)
                    .order('upvotes', { ascending: false })
                    .limit(20);

                if (error) throw error;

                if (data) {
                    const mappedPosts: Post[] = data.map(p => ({
                        id: p.id,
                        user: p.author || community.name,
                        avatar: IMAGES.avatar1,
                        titleEn: p.title_en,
                        titleZh: p.title_cn || '',
                        hashtags: [],
                        image: p.image_url || '',
                        videoUrl: p.video_url || null,
                        likes: (p.upvotes || 0).toString(),
                        stars: '0',
                        comments: Math.floor(Math.random() * 50),
                        subreddit: p.subreddit
                    }));
                    setPosts(mappedPosts);
                    // Update cache
                    setCommunityPostsCache(community.id, mappedPosts);
                }
            } catch (err) {
                console.error('Error fetching community posts:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchCommunityPosts();
    }, [community.id, community.name, cachedPosts]);

    useLayoutEffect(() => {
        if (!loading && posts.length > 0) {
            // [关键] 立即执行滚动恢复，不给浏览器渲染 0 位置的机会
            if (savedScrollPos > 0 && scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = savedScrollPos;
            }

            // 恢复完成后立即显示内容
            setIsRestored(true);
        } else if (!loading && posts.length === 0) {
            // 如果没有数据，也直接显示
            setIsRestored(true);
        }
    }, [loading, posts.length]); // 移除 savedScrollPos 依赖，防止重复触发

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            setScrollPosition(scrollKey, scrollContainerRef.current.scrollTop);
        }
    };

    const communityIcon = community.icon_img && community.icon_img.startsWith('http')
        ? community.icon_img
        : IMAGES.avatar1;

    return (
        <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed inset-0 bg-[#0F0F0F] z-50 flex flex-col overflow-hidden transition-opacity duration-200 ${isRestored ? 'opacity-100' : 'opacity-0'
                }`}
        >
            {/* Header: Premium Frosted Glass Effect */}
            <div className="absolute top-0 left-0 right-0 h-14 border-b border-white/5 bg-[#0F0F0F]/60 backdrop-blur-xl z-[60] flex items-center px-4">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 text-white/70 hover:text-white transition-colors flex items-center justify-center active:scale-90"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex-1 ml-2 overflow-hidden">
                    <h1 className="text-lg font-bold text-white truncate drop-shadow-sm">{community.display_name}</h1>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold truncate">r/{community.name}</p>
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto pt-14 no-scrollbar"
            >
                {/* Banner & Info */}
                <div className="relative">
                    <div className="h-32 bg-gradient-to-b from-[#1A1A1A] to-[#0F0F0F]" />
                    <div className="px-4 -mt-10 pb-6 relative z-10">
                        <div className="flex items-end justify-between mb-4">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-2xl bg-[#1A1A1A] border-4 border-[#0F0F0F] overflow-hidden shadow-xl">
                                    <img src={communityIcon} alt={community.name} className="w-full h-full object-cover" />
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    toggleFollowCommunity(community.id);
                                    if (navigator.vibrate) navigator.vibrate(50);
                                }}
                                className={`px-6 py-2 font-bold rounded-full text-sm transition-all active:scale-95 ${isSubscribed
                                    ? 'bg-white/10 text-white border border-white/20'
                                    : 'bg-white text-black hover:bg-white/90 shadow-lg'
                                    }`}
                            >
                                {isSubscribed ? 'Following' : 'Join'}
                            </button>
                        </div>

                        <h2 className="text-2xl font-black text-white mb-1">{community.display_name}</h2>
                        <div className="flex items-center gap-4 text-sm text-white/60 mb-4">
                            <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[18px]">group</span>
                                <span>{community.subscribers?.toLocaleString() || '0'} members</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-green-400">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                <span>Online</span>
                            </div>
                        </div>

                        <p className="text-sm text-white/80 leading-relaxed max-w-2xl">
                            {community.description}
                        </p>
                    </div>
                </div>

                {/* Tab Switcher (Mock) */}
                <div className="flex border-b border-white/5 px-2">
                    {['Posts', 'About', 'Rules'].map((tab, i) => (
                        <div
                            key={tab}
                            className={`px-4 py-3 text-sm font-bold relative ${i === 0 ? 'text-white' : 'text-white/40'}`}
                        >
                            {tab}
                            {i === 0 && (
                                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white rounded-full" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Content Grid */}
                <div className="p-4">
                    {loading ? (
                        <div className="grid grid-cols-2 gap-3">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="aspect-[3/4] rounded-2xl bg-[#1A1A1A] animate-pulse relative overflow-hidden">
                                    <div className="absolute inset-x-3 bottom-8 h-3 bg-white/5 rounded-full mb-1.5" />
                                    <div className="absolute inset-x-3 bottom-4 h-3 bg-white/5 rounded-full w-2/3" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#222] to-transparent opacity-20" />
                                </div>
                            ))}
                        </div>
                    ) : posts.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                            {posts.map((post) => (
                                <div
                                    key={post.id}
                                    onClick={() => onPostSelect(post)}
                                    className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-[#1A1A1A] active:scale-95 transition-transform"
                                >
                                    {post.image ? (
                                        <img
                                            src={post.image}
                                            alt={post.titleEn}
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                        />
                                    ) : (
                                        <div className="w-full h-full p-3 flex flex-col justify-center items-center text-center">
                                            <p className="text-xs font-bold text-white/40 line-clamp-3">{post.titleEn}</p>
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                                    <div className="absolute bottom-0 left-0 right-0 p-3 pb-4">
                                        <div className="mb-2 flex flex-col gap-0.5">
                                            <p className="text-sm font-bold text-white line-clamp-1 leading-tight">
                                                {post.titleEn}
                                            </p>
                                            <p className="text-xs text-white/50 line-clamp-1 leading-tight font-medium">
                                                {post.titleZh}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-white/60">
                                            <div className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                                                <span>{post.likes}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                                                <span>{post.comments}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center">
                            <p className="text-white/40 italic">No posts found yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default CommunityDetail;
