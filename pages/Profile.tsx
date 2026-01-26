import React from 'react'
import { Page, Post } from '../types' // 引入 Post 类型以便类型转换
import { useUserStore } from '../store/useUserStore'
import { IMAGES } from '../constants' // 引入默认头像

interface ProfileProps {
  onNavigate?: (page: Page) => void
  onPostSelect?: (post: Post) => void // [修改] 这里接收 Post 对象
}

const Profile: React.FC<ProfileProps> = ({ onNavigate, onPostSelect }) => {
  const { likedPosts } = useUserStore()

  const handlePostClick = (rawPost: any) => {
    if (onPostSelect) {
      // [关键修复] 数据格式转换
      // Store里存的是 ProductionPost (数据库格式)，App.tsx 需要 Post (前端UI格式)
      // 我们在这里做一次映射，确保传给预览页的数据是完整的
      const mappedPost: Post = {
        id: rawPost.id,
        user: rawPost.author_name || rawPost.subreddit || 'Anonymous',
        avatar: rawPost.author_avatar || IMAGES.avatar1,
        titleEn: rawPost.title_en,
        titleZh: rawPost.title_cn || '',
        hashtags: rawPost.hashtags || [],
        image: rawPost.image_url || IMAGES.london, // 使用 image_url
        videoUrl: rawPost.video_url || null, // 使用 video_url
        likes: rawPost.upvotes?.toString() || '0',
        stars: '0',
        comments: 0,
        image_type: rawPost.image_type,
        subreddit: rawPost.subreddit,
      }

      onPostSelect(mappedPost)
    }
  }

  return (
    <div className="h-full w-full bg-[#0B0A09] text-white flex flex-col overflow-hidden select-none">
      {/* Header Area */}
      <div className="pt-14 pb-6 px-6 relative z-10 flex items-end justify-between border-b border-white/5 bg-[#0B0A09]">
        <div>
          <div className="text-[10px] font-black tracking-[0.2em] text-orange-500 mb-1 uppercase">
            Scrollish
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 p-[2px]">
              <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                <span className="text-xl font-black">M</span>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-2xl font-black leading-none tracking-tight">
                My Space
              </span>
              <span className="text-xs text-white/40 font-bold mt-1">
                Free Member
              </span>
            </div>
          </div>
        </div>

        <button className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-white/60">
            settings
          </span>
        </button>
      </div>

      {/* Stats Bar */}
      <div className="px-6 py-6 flex gap-8">
        <div className="flex flex-col">
          <span className="text-xl font-black text-white">
            {likedPosts.length}
          </span>
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
            Saved
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-black text-white">0</span>
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
            Following
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 flex items-center gap-6 border-b border-white/5 mb-6">
        <div className="pb-3 border-b-2 border-orange-500 text-orange-500 font-bold text-sm">
          Saved Posts
        </div>
        <div className="pb-3 border-b-2 border-transparent text-white/40 font-bold text-sm">
          History
        </div>
      </div>

      {/* Grid Content */}
      <main className="flex-1 overflow-y-auto px-4 pb-32 no-scrollbar">
        {likedPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-white/20">
            <span className="material-symbols-outlined text-6xl mb-4">
              bookmark_border
            </span>
            <p className="text-xs font-bold uppercase tracking-widest">
              No saved posts yet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {likedPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => handlePostClick(post)}
                className="aspect-[3/4] rounded-2xl bg-[#1A1A1A] relative overflow-hidden active:scale-95 transition-transform border border-white/5">
                {/* Media Thumbnail */}
                <div className="absolute inset-0 bg-black">
                  {post.video_url ? (
                    <video
                      src={post.video_url}
                      className="w-full h-full object-cover opacity-80"
                      muted
                      preload="metadata"
                      // 不自动播放，只展示首帧，节省性能
                    />
                  ) : (
                    <div
                      className="w-full h-full bg-cover bg-center"
                      // [修复] 使用 image_url (数据库字段名) 解决黑屏
                      style={{ backgroundImage: `url("${post.image_url}")` }}
                    />
                  )}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />

                {/* Type Indicator */}
                {post.video_url && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-[14px]">
                      play_arrow
                    </span>
                  </div>
                )}

                {/* Info Overlay */}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[9px] font-black bg-white/20 px-1.5 py-0.5 rounded text-white/90 border border-white/5">
                      r/{post.subreddit || 'RD'}
                    </span>
                  </div>
                  <p className="text-xs font-bold leading-tight line-clamp-2 text-white/90">
                    {post.title_en}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default Profile
