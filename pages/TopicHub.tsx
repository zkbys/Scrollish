import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../supabase'
import { Page } from '../types'
import { useCommentStore } from '../store/useCommentStore'

interface TopicHubProps {
  onNavigate: (page: Page) => void
  onSelectComment: (commentId: string) => void
  post: any
  initialCommentId?: string | null
}

const TopicHub: React.FC<TopicHubProps> = ({
  onNavigate,
  onSelectComment,
  post,
  initialCommentId,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [animationClass, setAnimationClass] = useState('')
  const [isExiting, setIsExiting] = useState(false)
  const [videoError, setVideoError] = useState(false)


  // 独立状态存储 OP 内容，防止 props 中缺失
  const [opContent, setOpContent] = useState<{ en: string; cn: string } | null>(
    null,
  )

  const startPos = useRef({ x: 0, y: 0 })
  const contentRef = useRef<HTMLDivElement>(null)
  const hasRestoredPosition = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const { fetchComments, getComments, isLoading } = useCommentStore()

  // 1. 获取 OP 正文 (修复 Loading content 问题)
  useEffect(() => {
    if (post?.id) {
      fetchComments(post.id)

      // 优先使用 props 里的内容，如果缺失则去数据库查
      if (post.content_en && post.content_en.length > 10) {
        setOpContent({ en: post.content_en, cn: post.content_cn })
      } else {
        const fetchOp = async () => {
          const { data } = await supabase
            .from('production_posts')
            .select('content_en, content_cn, title_en, title_cn')
            .eq('id', post.id)
            .single()
          if (data) {
            setOpContent({
              en: data.content_en || data.title_en || '',
              cn: data.content_cn || data.title_cn || '',
            })
          }
        }
        fetchOp()
      }
    }
  }, [post, fetchComments])

  const allComments = getComments(post.id)

  const comments = useMemo(() => {
    // 2. 构造第0张卡片 (OP)
    // 优先级: state -> props -> fallback
    const finalContentEn =
      opContent?.en || post.content_en || post.title_en || 'Loading content...'
    const finalContentCn =
      opContent?.cn || post.content_cn || post.title_cn || ''

    const opCard = {
      id: 'op-card-0',
      isOpCard: true,
      author: post.author || post.subreddit || 'OP',
      content: finalContentEn,
      content_cn: finalContentCn,
      upvotes: post.upvotes || 0,
      depth: -1,
      enrichment: null, // OP 卡片通常没有 enrichment 分句数据
    }

    const topLevel = allComments.filter((c) => c.depth === 0)
    const sortedComments = topLevel.sort((a, b) => b.upvotes - a.upvotes)

    // 即使评论没加载完，也要先显示 OP 卡片，而不是空列表
    if (topLevel.length === 0 && isLoading[post.id]) {
      return [opCard]
    }

    return [opCard, ...sortedComments]
  }, [allComments, isLoading, post, opContent])

  const replyCounts = useMemo(() => {
    if (allComments.length === 0) return {}
    const childrenMap: Record<string, string[]> = {}
    allComments.forEach((c) => {
      if (c.parent_id) {
        if (!childrenMap[c.parent_id]) childrenMap[c.parent_id] = []
        childrenMap[c.parent_id].push(c.id)
      }
    })
    const countDescendants = (id: string): number => {
      const children = childrenMap[id] || []
      return children.reduce(
        (acc, childId) => acc + 1 + countDescendants(childId),
        0,
      )
    }
    const counts: Record<string, number> = {}
    comments.forEach((c) => {
      if (!c.isOpCard) counts[c.id] = countDescendants(c.id)
    })
    return counts
  }, [allComments, comments])

  useEffect(() => {
    if (
      !hasRestoredPosition.current &&
      initialCommentId &&
      comments.length > 1
    ) {
      const targetIndex = comments.findIndex((c) => c.id === initialCommentId)
      if (targetIndex !== -1) {
        setCurrentIndex(targetIndex)
        hasRestoredPosition.current = true
      }
    }
  }, [comments, initialCommentId])

  const imageUrl = post.image_url || post.image || ''
  const videoUrl = post.videoUrl || post.video_url || ''
  const hasVideo = !!videoUrl && !videoError

  useEffect(() => {
    if (hasVideo && videoRef.current) {
      videoRef.current.muted = true
      videoRef.current.play().catch(() => { })
    }
  }, [hasVideo])

  const activeComment = comments[currentIndex] || comments[0]
  const currentReplyCount =
    activeComment && !activeComment.isOpCard
      ? replyCounts[activeComment.id] || 0
      : 0

  // --- 分句逻辑 ---
  const displaySegments = useMemo(() => {
    if (!activeComment) return []

    // OP Card: 走正则分句 + 底部整段翻译
    if (activeComment.isOpCard) {
      const text = activeComment.content || ''
      const rawSentences = text.match(
        /[^.!?。！？\n]+[.!?。！？\n]+|[^.!?。！？\n]+$/g,
      ) || [text]
      return rawSentences.map((en) => ({ en: en.trim(), zh: null }))
    }

    // Comment Card: 优先使用 enrichment 数据
    // 注意：Store 中已经处理了 enrichment 为数组的情况，这里直接判断
    if (
      activeComment.enrichment?.sentence_segments &&
      Array.isArray(activeComment.enrichment.sentence_segments)
    ) {
      return activeComment.enrichment.sentence_segments
    }

    // 降级：正则分句，zh 为 null (显示在底部)
    const rawSentences = activeComment.content.match(
      /[^.!?。！？\n]+[.!?。！？\n]+|[^.!?。！？\n]+$/g,
    ) || [activeComment.content]
    return rawSentences.map((en) => ({
      en: en.trim(),
      zh: null,
    }))
  }, [activeComment])

  const goToChatRoom = () => {
    if (activeComment?.isOpCard) {
      if (navigator.vibrate) navigator.vibrate([20, 50, 20])
      return
    }
    if (activeComment) {
      onSelectComment(activeComment.id)
      onNavigate(Page.ChatRoom)
    }
  }

  const handleBack = () => {
    if (navigator.vibrate) navigator.vibrate(20)
    setIsExiting(true)
    setTimeout(() => onNavigate(Page.Home), 50)
  }


  const handleTouchStart = (e: React.TouchEvent) => {
    startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = e.changedTouches[0].clientX - startPos.current.x
    const diffY = e.changedTouches[0].clientY - startPos.current.y
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > 50) diffX < 0 ? nextCard() : prevCard()
    } else {
      if (diffY < -50) {
        if (activeComment.isOpCard) return
        const container = contentRef.current
        if (container) {
          const isAtBottom =
            Math.ceil(container.scrollTop + container.clientHeight) >=
            container.scrollHeight - 5
          const isContentShort =
            container.scrollHeight <= container.clientHeight
          if (isAtBottom || isContentShort) goToChatRoom()
        } else {
          goToChatRoom()
        }
      }
    }
  }

  const nextCard = () => {
    if (currentIndex >= comments.length - 1) return
    setAnimationClass('slide-out-left')
    setTimeout(() => {
      setCurrentIndex((p) => p + 1)
      setAnimationClass('slide-in-right')
      setTimeout(() => setAnimationClass(''), 400)
    }, 200)
  }

  const prevCard = () => {
    if (currentIndex <= 0) return
    setAnimationClass('slide-out-right')
    setTimeout(() => {
      setCurrentIndex((p) => p - 1)
      setAnimationClass('slide-in-left')
      setTimeout(() => setAnimationClass(''), 400)
    }, 200)
  }

  const isPageLoading = isLoading[post.id] && comments.length <= 1

  return (
    <div
      className={`h-full flex flex-col bg-[#FDFCFB] dark:bg-[#0B0A09] overflow-hidden select-none relative transition-colors duration-500 ${isExiting ? 'opacity-0 scale-95' : 'opacity-100'}`}>

      {/* 活力开朗背景体系 (与 Profile 同步) */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="frost-overlay" />
        <div className="blob-pastel -top-20 -left-20 bg-[#FFEDD5] dark:bg-orange-500/20 opacity-60 dark:opacity-40" />
        <div className="blob-pastel top-1/4 -right-40 bg-[#FED7AA] dark:bg-red-500/10 opacity-60 dark:opacity-30" />
        <div className="blob-pastel -bottom-20 -left-20 bg-[#FFEDD5] dark:bg-orange-500/10 opacity-60 dark:opacity-30" />

        {/* 图片相关的氛围光晕 */}
        <div
          className="absolute inset-[-50%] bg-cover bg-center blur-[120px] opacity-10 dark:opacity-20 animate-pulse-slow"
          style={{ backgroundImage: `url("${imageUrl}")` }}
        />
      </div>

      <div className="mx-4 mt-12 h-56 relative z-50">
        {/* 透明镜头框容器：作为移动的显示窗口 */}
        <motion.div
          initial={{ y: -300, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            type: 'spring',
            stiffness: 100,
            damping: 22,
            mass: 0.8,
          }}
          className="absolute inset-0 rounded-[2.5rem] border-2 border-white/40 dark:border-white/20 shadow-2xl overflow-hidden transform-gpu z-10 bg-gray-200 dark:bg-[#1C1C1E]">

          {/* 内部容器：承载 HUD 与主媒体 */}
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            transition={{
              type: 'spring',
              stiffness: 100,
              damping: 22,
              mass: 0.8,
            }}
            className="absolute inset-0 w-full h-full bg-black/10 dark:bg-black/40 flex items-center justify-center overflow-hidden">

            {/* 内容感知增强动态环境光 (Enhanced Content-Aware Ambient) */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              <div
                className="absolute inset-[-15%] bg-cover bg-center blur-[50px] opacity-60 dark:opacity-70 animate-pulse-slow scale-110 saturate-[1.8]"
                style={{ backgroundImage: `url("${imageUrl}")` }}
              />
              <div className="absolute inset-0 bg-white/10 dark:bg-black/20" />
            </div>

            {/* 内容感知增强动态环境光 (Enhanced Content-Aware Ambient) */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              <div
                className="absolute inset-[-15%] bg-cover bg-center blur-[60px] opacity-60 dark:opacity-70 animate-pulse-slow scale-110 saturate-[1.8]"
                style={{ backgroundImage: `url("${imageUrl}")` }}
              />
              <div className="absolute inset-0 bg-white/5 dark:bg-black/20" />
            </div>

            {/* 主媒体内容 */}
            {hasVideo ? (
              <video ref={videoRef} src={videoUrl} className="w-full h-full object-cover relative z-10" loop muted playsInline autoPlay />
            ) : (
              <img src={imageUrl} className="max-h-[85%] max-w-[calc(100%-120px)] object-contain relative z-10 shadow-2xl rounded-sm" alt="" />
            )}
          </motion.div>

          {/* 渐变遮罩放在镜头框内，跟随下落 */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 dark:to-black/80 rounded-[2.5rem] z-20 pointer-events-none" />
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 p-6 z-[70] pointer-events-none">
          <span className="text-white/80 text-[10px] font-bold uppercase tracking-widest drop-shadow-lg">
            {post.subreddit || 'Community'}
          </span>
          <h1 className="text-white text-xl font-black leading-tight line-clamp-2 mt-1 drop-shadow-lg">
            {post.titleEn}
          </h1>
        </div>

        <button
          onClick={handleBack}
          className="absolute top-5 left-5 w-10 h-10 bg-black/20 backdrop-blur rounded-full flex items-center justify-center text-white border border-white/20 z-[80]">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
      </div>

      <main className="flex-1 flex flex-col items-center justify-start pt-6 z-40">
        <div className="w-full px-8 flex justify-between items-center mb-4">
          <span className="text-gray-500 dark:text-white/40 text-[10px] font-bold uppercase tracking-widest">
            {activeComment?.isOpCard
              ? 'Original Post'
              : `Opinion ${currentIndex}/${comments.length - 1}`}
          </span>
          <div className="h-1 w-16 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / Math.max(comments.length, 1)) * 100}%`,
              }}
            />
          </div>
        </div>

        <div
          className="relative w-full px-4 h-[52vh]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}>
          <div
            className={`absolute inset-x-4 top-0 bottom-0 bg-white/90 dark:bg-[#121212]/80 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden transition-all duration-300 shadow-2xl dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] ${animationClass} transform-gpu`}>
            <div
              className="h-16 border-b border-gray-100 dark:border-white/5 flex items-center justify-between px-6 shrink-0"
              onClick={goToChatRoom}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full p-[2px] ${activeComment?.isOpCard ? 'bg-gray-200 dark:bg-white' : 'bg-gradient-to-tr from-orange-500 to-red-500'}`}>
                  <div className="w-full h-full rounded-full bg-white dark:bg-[#121212] flex items-center justify-center text-[10px] font-black text-gray-900 dark:text-white">
                    {activeComment?.isOpCard
                      ? 'OP'
                      : activeComment?.author.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-900 dark:text-white font-bold text-sm">
                    {activeComment?.author}
                  </span>
                  {!activeComment?.isOpCard && (
                    <div className="flex gap-2 text-[10px] text-gray-500 dark:text-white/50">
                      <span className="flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">
                          favorite
                        </span>
                        {activeComment?.upvotes}
                      </span>
                      <span className="flex items-center gap-0.5 ml-2">
                        <span className="material-symbols-outlined text-[10px] text-orange-500 dark:text-orange-400">
                          chat_bubble
                        </span>
                        {currentReplyCount}
                      </span>
                    </div>
                  )}
                  {activeComment?.isOpCard && (
                    <span className="text-[10px] text-gray-400 dark:text-white/40 font-medium">
                      Post Content
                    </span>
                  )}
                </div>
              </div>
              {!activeComment?.isOpCard && (
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-gray-400 dark:text-white/50 text-[18px]">
                    expand_less
                  </span>
                </div>
              )}
            </div>

            <div
              ref={contentRef}
              className="flex-1 p-6 overflow-y-auto no-scrollbar mask-image-gradient">
              {isPageLoading ? (
                <div className="flex justify-center mt-10">
                  <span className="animate-spin text-orange-500 material-symbols-outlined">
                    progress_activity
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  {displaySegments.map((seg, i) => (
                    <div
                      key={i}
                      className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 rounded-xl rounded-tl-none border-l-2 border-l-orange-500/50 select-none touch-callout-none"
                      onContextMenu={(e) => e.preventDefault()}>
                      <span className="text-gray-800 dark:text-gray-100 text-[15px] font-medium">
                        {seg.en}
                      </span>
                      {/* 只有在 enrichment 数据存在时，才按句显示中文 */}
                      {seg.zh && (
                        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-white/10">
                          <p className="text-gray-500 dark:text-white/60 text-sm leading-relaxed italic">
                            {seg.zh}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 如果没有分句中文，显示底部整段翻译 */}
                  {(!activeComment?.enrichment?.sentence_segments ||
                    activeComment?.isOpCard) &&
                    activeComment?.content_cn && (
                      <div
                        className="px-2 mt-4 select-none touch-callout-none"
                        onContextMenu={(e) => e.preventDefault()}>
                        <div className="flex items-center gap-2 mb-2 opacity-50">
                          <div className="h-[1px] flex-1 bg-gray-300 dark:bg-white/20" />
                          <span className="text-[9px] uppercase tracking-widest text-gray-400 dark:text-white">
                            Full Translation
                          </span>
                          <div className="h-[1px] flex-1 bg-gray-300 dark:bg-white/20" />
                        </div>
                        <p className="text-gray-600 dark:text-white/60 text-sm leading-relaxed italic px-2">
                          {activeComment.content_cn}
                        </p>
                      </div>
                    )}
                </div>
              )}
              <div className="h-12" />
            </div>

            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-white dark:from-[#121212] to-transparent pointer-events-none flex items-end justify-center pb-4 opacity-50">
              {activeComment?.isOpCard ? (
                <div className="flex flex-col items-center animate-bounce-subtle">
                  <span className="material-symbols-outlined text-gray-400 dark:text-white text-[16px] rotate-90">
                    keyboard_double_arrow_up
                  </span>
                  <span className="text-[8px] font-black text-gray-400 dark:text-white uppercase tracking-widest mt-1">
                    Swipe for Opinions
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center animate-bounce-subtle">
                  <span className="material-symbols-outlined text-gray-400 dark:text-white text-[16px]">
                    keyboard_double_arrow_up
                  </span>
                  <span className="text-[8px] font-black text-gray-400 dark:text-white uppercase tracking-widest">
                    Discussion
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main >

      {/* 底部氛围律动条 (Ambient Ticker) - 解决空旷且避开冗余功能 */}
      <div className="h-14 w-full relative z-40 overflow-hidden flex items-center bg-gray-100/50 dark:bg-white/5 backdrop-blur-md border-t border-gray-200 dark:border-white/5 opacity-80">
        <div className="flex whitespace-nowrap animate-ticker items-center gap-10 px-8">
          {[1, 2, 3].map((v) => (
            <div key={v} className="flex items-center gap-12">
              <span className="text-[10px] font-black text-orange-500 dark:text-orange-300 tracking-[0.15em]">
                欢 迎 来 到 SCROLLISH · 如 果 遇 到 问 题 请 及 时 向 我 们 反 馈 谢 谢！❤
              </span>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-2 h-2 bg-orange-300 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
              <span className="text-[11px] font-black text-orange-500 dark:text-orange-400 tracking-wider font-mono">
                Welcome to Scrollish!
              </span>
              <div className="flex gap-1">
                {[1, 2, 3].map(i => <div key={i} className="w-1 h-3 bg-white/20 rounded-full rotate-12" />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .animate-ticker {
          animation: ticker 40s linear infinite;
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .slide-out-left { animation: slideOutLeft 0.3s forwards ease-in; }
        .slide-in-right { animation: slideInRight 0.3s forwards ease-out; }
        .slide-out-right { animation: slideOutRight 0.3s forwards ease-in; }
        .slide-in-left { animation: slideInLeft 0.3s forwards ease-out; }
        @keyframes slideOutLeft { to { transform: translateX(-120%) rotate(-5deg); opacity: 0; } }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOutRight { to { transform: translateX(120%) rotate(5deg); opacity: 0; } }
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .touch-callout-none { -webkit-touch-callout: none; }

        /* 活力开朗背景样式 (Profile 同步) */
        .blob-pastel {
            position: absolute;
            width: 500px;
            height: 500px;
            filter: blur(100px);
            border-radius: 50%;
            z-index: 0;
            pointer-events: none;
        }
        .frost-overlay {
            position: fixed;
            inset: 0;
            background: url('https://grainy-gradients.vercel.app/noise.svg');
            opacity: 0.03;
            pointer-events: none;
            z-index: 5;
        }
      `}</style>
    </div >
  )
}

export default TopicHub
