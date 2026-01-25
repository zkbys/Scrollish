import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Page } from '../types'
import { useCommentStore } from '../store/useCommentStore'

interface TopicHubProps {
  onNavigate: (page: Page) => void
  onSelectComment: (commentId: string) => void
  post: any
  initialCommentId?: string | null // [新增] 用于恢复上次阅读位置
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

  const startPos = useRef({ x: 0, y: 0 })
  const contentRef = useRef<HTMLDivElement>(null)

  // [关键修复] 用于记录是否已经执行过恢复操作
  const hasRestoredPosition = useRef(false)

  // Store
  const { fetchComments, getComments, isLoading } = useCommentStore()

  useEffect(() => {
    if (post?.id) {
      fetchComments(post.id)
    }
  }, [post.id, fetchComments])

  const allComments = getComments(post.id)

  const comments = useMemo(() => {
    const topLevel = allComments.filter((c) => c.depth === 0)
    if (topLevel.length === 0 && !isLoading[post.id]) {
      return [
        {
          id: 'mock-1',
          author: 'ScrollishBot',
          content:
            'Be the first to share your thoughts on this topic! What do you think?',
          upvotes: 0,
          created_at: new Date().toISOString(),
        } as any,
      ]
    }
    return topLevel.sort((a, b) => b.upvotes - a.upvotes)
  }, [allComments, isLoading, post.id])

  // --- [关键修复] 位置恢复逻辑 ---
  useEffect(() => {
    // 只有当：
    // 1. 还没恢复过 (避免用户滑动后数据刷新导致跳回)
    // 2. 传入了 initialCommentId
    // 3. 数据已经加载好了
    if (
      !hasRestoredPosition.current &&
      initialCommentId &&
      comments.length > 0
    ) {
      const targetIndex = comments.findIndex((c) => c.id === initialCommentId)
      if (targetIndex !== -1) {
        setCurrentIndex(targetIndex)
        hasRestoredPosition.current = true // 标记已恢复
        // console.log('Restored position to index:', targetIndex);
      }
    }
  }, [comments, initialCommentId])

  // -------------------------------------

  const isPageLoading =
    isLoading[post.id] && comments.length === 0 && allComments.length === 0

  const getMessageBubbles = (text: string) => {
    if (!text) return []
    const sentences = text.match(
      /[^.!?。！？\n]+[.!?。！？\n]+|[^.!?。！？\n]+$/g,
    )
    return sentences || [text]
  }

  const activeComment = comments[currentIndex] || comments[0]
  const bubbles = activeComment ? getMessageBubbles(activeComment.content) : []

  const goToChatRoom = () => {
    if (activeComment) {
      onSelectComment(activeComment.id)
      onNavigate(Page.ChatRoom)
    }
  }

  const handleBack = () => {
    setIsExiting(true)
    if (navigator.vibrate) navigator.vibrate(20)
    setTimeout(() => onNavigate(Page.Home), 600)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = e.changedTouches[0].clientX - startPos.current.x
    const diffY = e.changedTouches[0].clientY - startPos.current.y

    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > 50) {
        if (diffX < 0) nextCard()
        else prevCard()
      }
    } else {
      if (diffY < -50) {
        const container = contentRef.current
        if (container) {
          const isAtBottom =
            Math.ceil(container.scrollTop + container.clientHeight) >=
            container.scrollHeight - 10
          const isScrollable = container.scrollHeight > container.clientHeight
          if (isScrollable && !isAtBottom) return
        }
        goToChatRoom()
      }
    }
  }

  const nextCard = () => {
    if (currentIndex >= comments.length - 1) return
    if (navigator.vibrate) navigator.vibrate(10)
    setAnimationClass('slide-out-left')
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1)
      setAnimationClass('slide-in-right')
      setTimeout(() => setAnimationClass(''), 400)
    }, 200)
  }

  const prevCard = () => {
    if (currentIndex <= 0) return
    if (navigator.vibrate) navigator.vibrate(10)
    setAnimationClass('slide-out-right')
    setTimeout(() => {
      setCurrentIndex((prev) => prev - 1)
      setAnimationClass('slide-in-left')
      setTimeout(() => setAnimationClass(''), 400)
    }, 200)
  }

  const titleEn = post.title_en || post.titleEn || ''
  const imageUrl = post.image_url || post.image || ''
  const subreddit = post.subreddit || post.user || 'Community'

  return (
    <div className="h-full flex flex-col bg-[#050505] overflow-hidden select-none perspective-container relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-[-50%] bg-cover bg-center blur-[100px] opacity-40 animate-pulse-slow saturate-150"
          style={{ backgroundImage: `url("${imageUrl}")` }}
        />
        <div className="absolute inset-0 bg-black/60 mix-blend-multiply" />
      </div>

      <div
        className={`bg-cover bg-center flex flex-col justify-end p-7 relative overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-white/10 z-50 transition-all duration-[600ms] ease-apple will-change-transform ${
          isExiting
            ? 'fixed inset-0 z-[100] h-full w-full rounded-none scale-100 rotate-0 translate-y-0 brightness-100'
            : 'mx-4 mt-12 h-56 rounded-[2.5rem] animate-in fade-in zoom-in-95 duration-[600ms] brightness-110'
        }`}
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%), url("${imageUrl}")`,
        }}>
        <button
          onClick={handleBack}
          className={`absolute top-5 left-5 text-white flex items-center justify-center h-11 w-11 bg-black/20 backdrop-blur-md rounded-2xl border border-white/20 active:scale-90 transition-all shadow-lg ${isExiting ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
          <span className="material-symbols-outlined text-[26px]">
            arrow_back
          </span>
        </button>

        <div
          className={`flex flex-col gap-2 transition-opacity duration-200 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-[0.1em] shadow-[0_0_15px_rgba(249,115,22,0.4)]">
              Trending
            </span>
            <div className="h-1 w-1 rounded-full bg-white/60" />
            <span className="text-white/80 text-[10px] font-bold uppercase tracking-widest">
              {subreddit}
            </span>
          </div>
          <h1 className="text-white text-2xl font-black leading-tight drop-shadow-lg line-clamp-2">
            {titleEn}
          </h1>
        </div>
      </div>

      <main
        className={`flex-1 flex flex-col items-center justify-start pt-6 bg-transparent transition-all duration-[600ms] ease-apple z-40 ${
          isExiting
            ? 'opacity-0 translate-y-40'
            : 'animate-in slide-in-from-bottom-24 fade-in duration-700 delay-200'
        }`}>
        <div className="w-full px-8 flex justify-between items-center mb-5">
          <span className="text-white/40 text-[11px] font-black uppercase tracking-[0.2em] drop-shadow-md">
            {isPageLoading
              ? 'Thinking...'
              : `Opinion ${currentIndex + 1} / ${comments.length}`}
          </span>
          <div className="flex items-center gap-2">
            <div className="h-[4px] w-16 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 transition-all duration-300 animate-gradient-x"
                style={{
                  width: `${((currentIndex + 1) / Math.max(comments.length, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div
          className="relative w-full px-4 h-[52vh]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}>
          <div
            className={`absolute inset-x-4 top-0 bottom-0 bg-[#121212]/80 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden flex flex-col transition-all duration-300 ${animationClass}`}>
            <div
              className="h-18 pt-4 pb-2 border-b border-white/5 flex items-center justify-between px-6 shrink-0 cursor-pointer"
              onClick={goToChatRoom}>
              <div className="flex items-center gap-3">
                <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-500">
                  <div className="w-9 h-9 rounded-full bg-[#121212] flex items-center justify-center text-white text-xs font-black border border-white/10">
                    {activeComment?.author.substring(0, 2).toUpperCase()}
                  </div>
                </div>
                <div>
                  <div className="font-black text-[14px] text-white tracking-wide drop-shadow-sm">
                    {activeComment?.author}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px] text-orange-500">
                      favorite
                    </span>
                    <span className="text-[10px] text-white/60 font-bold">
                      {activeComment?.upvotes || 0}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-white/5 text-white/60 p-2 rounded-full hover:bg-white/10 transition-colors border border-white/5">
                <span className="material-symbols-outlined text-[20px] font-bold">
                  expand_less
                </span>
              </div>
            </div>

            <div
              ref={contentRef}
              className="flex-1 p-6 space-y-4 overflow-y-auto no-scrollbar mask-image-gradient">
              {isPageLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                </div>
              ) : (
                bubbles.map((sentence, i) => {
                  return (
                    <div
                      key={i}
                      className={`
                        relative p-4 rounded-[1.2rem] text-[15px] leading-relaxed font-medium 
                        animate-in slide-in-from-bottom-4 fade-in duration-500 
                        bg-white/5 border border-white/5 
                        text-gray-100 shadow-sm backdrop-blur-md rounded-tl-none
                        hover:bg-white/10 transition-colors
                        border-l-[3px] border-l-orange-500/50 
                      `}
                      style={{ animationDelay: `${i * 80}ms` }}>
                      {sentence.trim()}
                    </div>
                  )
                })
              )}
              <div className="h-12" />
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#121212] to-transparent pointer-events-none flex items-end justify-center pb-6">
              <div className="flex flex-col items-center gap-1 animate-bounce-subtle opacity-50">
                <span className="material-symbols-outlined text-[16px] text-white">
                  keyboard_double_arrow_up
                </span>
                <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">
                  Full Thread
                </span>
              </div>
            </div>
          </div>

          <div className="absolute inset-x-8 top-4 bottom-[-10px] bg-white/5 rounded-[2.5rem] -z-10 scale-[0.96] border border-white/5 backdrop-blur-sm" />
          <div className="absolute inset-x-12 top-8 bottom-[-20px] bg-white/5 rounded-[2.5rem] -z-20 scale-[0.92] border border-white/5 backdrop-blur-sm" />
        </div>
      </main>

      <style>{`
        .animate-pulse-slow { animation: pulse-slow 8s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse-slow { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.1); } }
        .slide-out-left { animation: slideOutLeft 0.3s forwards cubic-bezier(0.2, 0.8, 0.2, 1); }
        .slide-in-right { animation: slideInRight 0.3s forwards cubic-bezier(0.2, 0.8, 0.2, 1); }
        .slide-out-right { animation: slideOutRight 0.3s forwards cubic-bezier(0.2, 0.8, 0.2, 1); }
        .slide-in-left { animation: slideInLeft 0.3s forwards cubic-bezier(0.2, 0.8, 0.2, 1); }
        @keyframes slideOutLeft { to { transform: translateX(-120%) scale(0.9) rotate(-5deg); opacity: 0; } }
        @keyframes slideInRight { from { transform: translateX(100%) scale(0.9); opacity: 0; } to { transform: translateX(0) scale(1); opacity: 1; } }
        @keyframes slideOutRight { to { transform: translateX(120%) scale(0.9) rotate(5deg); opacity: 0; } }
        @keyframes slideInLeft { from { transform: translateX(-100%) scale(0.9); opacity: 0; } to { transform: translateX(0) scale(1); opacity: 1; } }
      `}</style>
    </div>
  )
}

export default TopicHub
