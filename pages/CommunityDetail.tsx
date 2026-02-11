import React, { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Page, Post } from '../types'
import { supabase } from '../supabase'
import { useUserStore } from '../store/useUserStore'
import { IMAGES } from '../constants'

interface CommunityDetailProps {
  community: any
  onNavigate: (page: Page) => void
  onPostSelect: (post: Post) => void
  onBack: () => void
}

const CommunityDetail: React.FC<CommunityDetailProps> = ({
  community,
  onNavigate,
  onPostSelect,
  onBack,
}) => {
  const { toggleFollowCommunity, isFollowing, toggleLike, isLiked } =
    useUserStore()
  const [posts, setPosts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [scrollPos, setScrollPos] = useState(0)
  const headerRef = useRef<HTMLDivElement>(null)

  const isSubscribed = isFollowing(community.id)

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true)
      const { data } = await supabase
        .from('production_posts')
        .select('*')
        .eq('community_id', community.id)
        .order('upvotes', { ascending: false })
        .limit(20)

      if (data) setPosts(data)
      setIsLoading(false)
    }
    fetchPosts()
  }, [community.id])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPos(e.currentTarget.scrollTop)
  }

  const handlePostClick = (rawPost: any) => {
    onPostSelect({
      id: rawPost.id,
      user: rawPost.author || rawPost.subreddit,
      avatar: IMAGES.avatar1,
      titleEn: rawPost.title_en,
      titleZh: rawPost.title_cn || '',
      hashtags: [],
      image: rawPost.image_url,
      videoUrl: rawPost.video_url,
      likes: (rawPost.upvotes || 0).toString(),
      stars: '0',
      comments: 0,
      image_type: rawPost.image_type,
      subreddit: rawPost.subreddit,
      community_id: rawPost.community_id,
    })
  }

  const handleJoin = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFollowCommunity(community.id)
    if (navigator.vibrate) navigator.vibrate(50)
  }

  const getGradient = (name: string) => {
    const gradients = [
      'from-indigo-500 to-purple-600',
      'from-blue-600 to-cyan-500',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-pink-500 to-rose-600',
    ]
    return gradients[name.charCodeAt(0) % gradients.length]
  }

  return (
    <div className="h-full w-full bg-background-light dark:bg-[#0B0A09] flex flex-col relative overflow-hidden transition-colors duration-300 overscroll-x-none select-none">
      {/* Header */}
      <header
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrollPos > 100 ? 'bg-background-light/90 dark:bg-[#0B0A09]/90 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-white/5 py-3' : 'bg-transparent py-4'}`}>
        <div className="px-5 flex items-center justify-between">
          <button
            onClick={onBack}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${scrollPos > 100 ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' : 'bg-black/20 backdrop-blur text-white'}`}>
            <span className="material-symbols-outlined text-[20px]">
              arrow_back
            </span>
          </button>

          <div
            className={`flex flex-col items-center transition-opacity duration-300 ${scrollPos > 100 ? 'opacity-100' : 'opacity-0'}`}>
            <span className="font-bold text-gray-900 dark:text-white text-sm">
              r/{community.name}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-white/40">
              {community.subscriber_count} members
            </span>
          </div>

          <button
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${scrollPos > 100 ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' : 'bg-black/20 backdrop-blur text-white'}`}>
            <span className="material-symbols-outlined text-[20px]">
              more_horiz
            </span>
          </button>
        </div>
      </header>

      <main
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto no-scrollbar overscroll-x-none">
        {/* Banner Area */}
        <div
          className={`relative h-64 w-full bg-gradient-to-br ${getGradient(community.name)}`}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -bottom-10 left-6 flex items-end gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white dark:bg-[#1C1C1E] p-1 shadow-xl">
              <div
                className={`w-full h-full rounded-xl bg-gradient-to-br ${getGradient(community.name)} flex items-center justify-center`}>
                <span className="text-3xl font-black text-white">
                  {community.name.substring(0, 1).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="pt-14 px-6 pb-6 bg-background-light dark:bg-[#0B0A09]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                r/{community.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-white/40 font-medium mt-1">
                {community.sub_category} • {community.subscriber_count} members
              </p>
            </div>
            <button
              onClick={handleJoin}
              className={`px-5 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg ${isSubscribed ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white' : 'bg-primary text-white shadow-primary/30'}`}>
              {isSubscribed ? 'Joined' : 'Join'}
            </button>
          </div>
          <p className="text-gray-600 dark:text-white/70 text-sm leading-relaxed mb-6">
            {community.description ||
              `Welcome to the official r/${community.name} community. Discover trending discussions, memes, and more!`}
          </p>

          {/* Filter Tabs */}
          <div className="flex gap-4 border-b border-gray-200 dark:border-white/5 mb-4">
            {['Hot', 'New', 'Top'].map((tab, i) => (
              <button
                key={tab}
                className={`pb-3 text-sm font-bold transition-colors ${i === 0 ? 'text-primary border-b-2 border-primary' : 'text-gray-400 dark:text-white/30'}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* Posts Grid */}
          <div className="grid grid-cols-2 gap-3">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] bg-gray-200 dark:bg-white/5 rounded-2xl animate-pulse"
                />
              ))
            ) : posts.length > 0 ? (
              posts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => handlePostClick(post)}
                  className="aspect-[3/4] relative rounded-2xl overflow-hidden bg-gray-200 dark:bg-white/5 active:scale-95 transition-transform">
                  <img
                    src={post.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-white text-xs font-bold line-clamp-2 leading-tight drop-shadow-md">
                      {post.title_en}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-white/60 text-[10px]">
                      <span className="material-symbols-outlined text-[10px]">
                        favorite
                      </span>{' '}
                      {post.upvotes}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 py-10 text-center text-gray-400 dark:text-white/20 text-xs font-bold uppercase tracking-widest">
                No posts yet
              </div>
            )}
          </div>
        </div>
        <div className="h-20" />
      </main>
    </div>
  )
}

export default CommunityDetail
