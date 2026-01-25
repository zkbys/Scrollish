import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { Page } from '../types'

// 严格对应 Supabase 表结构
interface ProductionPost {
  id: string
  community_id: string
  title_en: string // 修正字段名
  title_cn: string // 修正字段名
  content_en: string
  content_cn: string
  image_url: string
  video_url: string | null
  image_type: 'original' | 'generated'
  upvotes: number
  subreddit: string
}

interface HomeProps {
  onNavigate: (page: Page) => void
  onPostSelect: (postId: string) => void
}

const Home: React.FC<HomeProps> = ({ onNavigate, onPostSelect }) => {
  const [posts, setPosts] = useState<ProductionPost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'following' | 'foryou'>('foryou')

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const { data, error } = await supabase
          .from('production_posts')
          .select('*')
          .order('upvotes', { ascending: false })
          .limit(10)

        if (error) throw error
        if (data) setPosts(data)
      } catch (err) {
        console.error('Error fetching posts:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [])

  if (loading) {
    return (
      <div className="h-full w-full bg-[#0B0A09] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full bg-[#0B0A09] overflow-hidden">
      {/* 顶部 Header - 渐变优化 */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-5 pt-12 pb-8 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
        <button className="pointer-events-auto text-white/90 h-9 w-9 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-full active:scale-90 transition-transform border border-white/5">
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>

        <div className="flex gap-6 pointer-events-auto items-center">
          <button
            onClick={() => setActiveTab('following')}
            className={`text-[16px] font-bold transition-colors drop-shadow-md ${activeTab === 'following' ? 'text-white' : 'text-white/60'}`}>
            Following
          </button>
          <div className="h-4 w-[1px] bg-white/20"></div>
          <button
            onClick={() => setActiveTab('foryou')}
            className={`text-[16px] font-bold transition-colors relative drop-shadow-md ${activeTab === 'foryou' ? 'text-white' : 'text-white/60'}`}>
            For You
            {activeTab === 'foryou' && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-[3px] bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.8)]" />
            )}
          </button>
        </div>

        <button className="pointer-events-auto text-white/90 h-9 w-9 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-full active:scale-90 transition-transform border border-white/5">
          <span className="material-symbols-outlined text-[20px]">search</span>
        </button>
      </header>

      {/* 这里的 pb-20 是为了防止底部内容被新的 NavigationBar 遮挡 */}
      <div className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar pb-0">
        {posts.map((post) => (
          <FeedItem
            key={post.id}
            post={post}
            onOpenDiscussion={() => onPostSelect(post.id)}
          />
        ))}
      </div>
    </div>
  )
}

const FeedItem: React.FC<{
  post: ProductionPost
  onOpenDiscussion: () => void
}> = ({ post, onOpenDiscussion }) => {
  const [likes, setLikes] = useState(post.upvotes || 0)
  const [isLiked, setIsLiked] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasVideo = !!post.video_url

  // 4. 修复点赞逻辑：支持取消点赞
  const handleLike = async () => {
    const isCurrentlyLiked = isLiked
    // 乐观更新
    const newCount = isCurrentlyLiked ? likes - 1 : likes + 1

    setLikes(newCount)
    setIsLiked(!isCurrentlyLiked)

    if (navigator.vibrate) navigator.vibrate(50)

    // 异步更新后端
    try {
      await supabase
        .from('production_posts')
        .update({ upvotes: newCount })
        .eq('id', post.id)
    } catch (error) {
      console.error('Like update failed', error)
      // 如果失败，回滚状态
      setLikes(likes)
      setIsLiked(isCurrentlyLiked)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      navigator.share({
        title: post.title_en,
        text: post.title_cn,
        url: window.location.href,
      })
    }
  }

  return (
    <div className="relative h-full w-full snap-start overflow-hidden bg-[#121212]">
      {/* 1. 媒体层：氛围感增强版 (Ambient Glow) */}
      <div
        className="absolute inset-0 h-full w-full overflow-hidden" // 增加 overflow-hidden 防止模糊溢出
        onClick={(e) => {
          if (hasVideo && videoRef.current) {
            videoRef.current.paused
              ? videoRef.current.play()
              : videoRef.current.pause()
          }
        }}>
        {hasVideo ? (
          <video
            ref={videoRef}
            src={post.video_url!}
            className="h-full w-full object-cover"
            loop
            muted
            playsInline
            autoPlay
          />
        ) : (
          <>
            {/* 背景层：大幅增强氛围感 */}
            {/* 这里的改动：opacity-60 -> opacity-100, blur-2xl -> blur-3xl, 移除 brightness-75 */}
            <div
              className="absolute inset-0 bg-cover bg-center blur-3xl scale-125 opacity-80"
              style={{ backgroundImage: `url("${post.image_url}")` }}
            />

            {/* 增加一层轻微的暗色渐变，保证背景不会太亮抢了前景的风头 */}
            <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />

            {/* 前景层：保持内容完整 */}
            <img
              src={post.image_url}
              alt="Content"
              className="absolute inset-0 w-full h-full object-contain z-10 drop-shadow-2xl"
            />
          </>
        )}

        {/* 底部渐变遮罩：只在底部存在，保证文字可读，不再遮挡全屏 */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none z-20" />
      </div>

      {/* 双击点赞层 */}
      <div className="absolute inset-0 z-30" onDoubleClick={handleLike} />

      {/* 2. 底部信息层 (修正字段名显示) */}
      <div className="absolute bottom-0 left-0 w-[82%] z-40 p-5 pb-24 pointer-events-none">
        {/* 用户/社区 */}
        <div className="flex items-center gap-2 mb-3 pointer-events-auto">
          <div className="w-10 h-10 rounded-full border border-white/20 bg-black/40 backdrop-blur-md flex items-center justify-center overflow-hidden">
            {/* 既然没有头像，用 subreddit 的首字母，稍微美化一下 */}
            <span className="text-white font-black text-sm">
              {post.subreddit
                ? post.subreddit.substring(0, 2).toUpperCase()
                : 'RD'}
            </span>
          </div>
          <div className="flex flex-col drop-shadow-md">
            <span className="text-white font-bold text-[15px] leading-tight">
              r/{post.subreddit}
            </span>
            {post.image_type === 'generated' && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[10px] text-primary">
                  auto_awesome
                </span>
                <span className="text-primary text-[10px] font-bold">
                  AI Illustration
                </span>
              </div>
            )}
          </div>
          <button className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold px-3 py-1.5 rounded-full ml-2 transition-all active:scale-95">
            Subscribe
          </button>
        </div>

        {/* 标题 & 翻译 (注意这里使用的是 title_en 和 title_cn) */}
        <div className="pointer-events-auto mb-2 space-y-1">
          <h1 className="text-white text-[18px] font-black leading-snug drop-shadow-lg pr-4">
            {post.title_en}
          </h1>
          <p className="text-white/80 text-[15px] font-medium leading-snug drop-shadow-md line-clamp-3 pr-4">
            {post.title_cn}
          </p>
        </div>
      </div>

      {/* 右侧交互栏 */}
      <div className="absolute bottom-24 right-2 flex flex-col items-center gap-6 z-50 pointer-events-auto w-14">
        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleLike}
            className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-90">
            <span
              className={`material-symbols-outlined text-[30px] transition-colors ${isLiked ? 'text-[#ff2d55] fill-[1]' : 'text-white'}`}>
              favorite
            </span>
          </button>
          <span className="text-white text-[12px] font-bold drop-shadow-md">
            {likes}
          </span>
        </div>

        {/* Discuss */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onOpenDiscussion}
            className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-90 hover:bg-white/20">
            <span className="material-symbols-outlined text-[28px] text-white fill-[1]">
              mode_comment
            </span>
          </button>
          <span className="text-white text-[12px] font-bold drop-shadow-md">
            Discuss
          </span>
        </div>

        {/* Share */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleShare}
            className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-90 hover:bg-white/20">
            <span className="material-symbols-outlined text-[28px] text-white transform -rotate-12">
              reply
            </span>
          </button>
          <span className="text-white text-[12px] font-bold drop-shadow-md">
            Share
          </span>
        </div>
      </div>
    </div>
  )
}

export default Home
