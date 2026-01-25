import React, { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../supabase'
import { ChatMessage } from '../types'
import { useCommentStore } from '../store/useCommentStore'

interface ChatRoomProps {
  postId: string
  postImage?: string
  focusCommentId?: string | null
  onBack: () => void
}

interface ThreadMessage extends ChatMessage {
  replyToName?: string
  replyText?: string
}

const ChatRoom: React.FC<ChatRoomProps> = ({
  postId,
  postImage,
  focusCommentId,
  onBack,
}) => {
  const [fetchedImage, setFetchedImage] = useState<string>('')

  const [quotedMessage, setQuotedMessage] = useState<ThreadMessage | null>(null)
  const [activeAnalysis, setActiveAnalysis] = useState<
    ChatMessage['analysis'] | null
  >(null)

  // --- [新增] 下拉返回相关状态 ---
  const [pullY, setPullY] = useState(0) // 下拉距离
  const [isDragging, setIsDragging] = useState(false) // 是否正在拖拽
  const touchStartRef = useRef(0) // 记录手指起始位置
  const scrollContainerRef = useRef<HTMLDivElement>(null) // 内容容器引用，用于判断 scrollTop

  const { getComments, fetchComments } = useCommentStore()

  useEffect(() => {
    fetchComments(postId)
    if (!postImage) {
      const fetchImage = async () => {
        const { data } = await supabase
          .from('production_posts')
          .select('image_url')
          .eq('id', postId)
          .single()
        if (data) setFetchedImage(data.image_url)
      }
      fetchImage()
    }
  }, [postId, postImage, fetchComments])

  const rawComments = getComments(postId)

  const messages = useMemo(() => {
    if (!rawComments || rawComments.length === 0) return []

    const commentMap = new Map<string, any>()
    const childrenMap = new Map<string, any[]>()

    rawComments.forEach((c) => {
      commentMap.set(c.id, c)
      const pid = c.parent_id
      if (pid) {
        if (!childrenMap.has(pid)) childrenMap.set(pid, [])
        childrenMap.get(pid)?.push(c)
      }
    })

    const result: ThreadMessage[] = []

    const traverse = (comment: any) => {
      const parent = comment.parent_id
        ? commentMap.get(comment.parent_id)
        : null
      const node: ThreadMessage = {
        id: comment.id,
        user: comment.author,
        avatar: comment.author_avatar,
        contentEn: comment.content,
        contentZh: comment.content_zh,
        level: comment.depth,
        isAi: comment.is_ai,
        analysis: comment.analysis,
        replyToName: parent ? parent.author : undefined,
        replyText: parent ? parent.content : undefined,
      }
      result.push(node)
      const children = childrenMap.get(comment.id) || []
      children.sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0))
      children.forEach((child) => traverse(child))
    }

    if (focusCommentId) {
      const targetRoot = rawComments.find((c) => c.id === focusCommentId)
      if (targetRoot) {
        traverse(targetRoot)
      } else {
        rawComments
          .filter((c) => c.depth === 0)
          .sort((a, b) => b.upvotes - a.upvotes)
          .forEach((root) => traverse(root))
      }
    } else {
      rawComments
        .filter((c) => c.depth === 0)
        .sort((a, b) => b.upvotes - a.upvotes)
        .forEach((root) => traverse(root))
    }

    return result
  }, [rawComments, focusCommentId])

  const getInitials = (name: string) =>
    name ? name.substring(0, 2).toUpperCase() : '??'

  const splitTextToBubbles = (text: string): string[] => {
    if (!text) return []
    if (text.includes('http')) return [text]
    const sentences = text.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g)
    return sentences || [text]
  }

  const renderFragmentWithGlow = (text: string, analysis: any) => {
    if (!analysis || !text.includes(analysis.keyword)) return text
    const parts = text.split(analysis.keyword)
    return (
      <>
        {parts[0]}
        <span
          onClick={(e) => {
            e.stopPropagation()
            setActiveAnalysis(analysis)
          }}
          className="text-orange-400 font-black relative animate-glow cursor-help px-1 rounded-sm bg-orange-500/10 border-b-2 border-orange-500/40">
          {analysis.keyword}
        </span>
        {parts[1]}
      </>
    )
  }

  // --- [新增] 手势处理逻辑 ---
  const handleTouchStart = (e: React.TouchEvent) => {
    // 只有当内容滚动条在顶部时，才允许检测下拉
    if (scrollContainerRef.current?.scrollTop === 0) {
      touchStartRef.current = e.touches[0].clientY
      setIsDragging(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return

    const currentY = e.touches[0].clientY
    const diff = currentY - touchStartRef.current

    // 只有向下拉 (diff > 0) 且滚动条在顶部时生效
    if (diff > 0 && scrollContainerRef.current?.scrollTop === 0) {
      // 增加阻尼感 (除以 2.5)，并限制最大拉动距离
      const dampedPull = Math.pow(diff, 0.8) // 非线性阻尼
      setPullY(dampedPull)
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (pullY > 100) {
      // 拉动超过 100px，触发返回
      // 稍微震动一下
      if (navigator.vibrate) navigator.vibrate(10)
      onBack()
    }
    // 无论是否触发返回，都要重置 pullY (如果是返回，页面会卸载；如果不返回，需要回弹)
    setPullY(0)
    touchStartRef.current = 0
  }

  const bgImage = postImage || fetchedImage
  const isLoading = messages.length === 0

  return (
    // [关键修改]
    // 1. 绑定 touch 事件到最外层容器
    // 2. style transform: 根据 pullY 移动整个页面
    // 3. transition: 非拖拽状态下添加过渡，实现松手回弹效果
    <div
      className={`fixed inset-0 z-[60] flex flex-col bg-[#0B0A09] overflow-hidden overscroll-none shadow-2xl ${!isDragging ? 'transition-transform duration-300 ease-out' : ''}`}
      style={{
        transform: `translateY(${pullY}px)`,
        // 当下拉时，稍微把圆角加大，看起来像是一张卡片被拉走
        borderRadius: pullY > 0 ? `${Math.min(pullY / 10, 40)}px` : '0px',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}>
      {/* 顶部指示器 (下拉时显示 "Release to close") */}
      <div
        className="absolute top-0 left-0 right-0 h-16 flex items-center justify-center pointer-events-none transition-opacity duration-200 z-[70]"
        style={{
          opacity: Math.min(pullY / 80, 1),
          transform: `translateY(-${30 - Math.min(pullY / 3, 30)}px)`,
        }}>
        <div className="flex flex-col items-center gap-1">
          <span className="material-symbols-outlined text-white/50 text-[20px] animate-bounce">
            keyboard_arrow_down
          </span>
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
            Release to Close
          </span>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {bgImage ? (
          <div
            className="absolute inset-[-50%] bg-cover bg-center blur-[100px] opacity-40 saturate-150 transform scale-110"
            style={{ backgroundImage: `url("${bgImage}")` }}
          />
        ) : (
          <div className="absolute inset-[-20%] bg-gradient-to-br from-purple-900/30 via-black to-blue-900/30 blur-[80px] opacity-60" />
        )}
        <div className="absolute inset-0 bg-black/80 mix-blend-multiply" />
      </div>

      {activeAnalysis && (
        <div
          className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-end animate-in fade-in duration-200"
          onClick={() => setActiveAnalysis(null)}>
          <div
            className="w-full bg-[#1A1A1A] rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 border-t border-white/10"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-500 fill-[1]">
                    auto_awesome
                  </span>
                  <span className="bg-orange-500/10 text-orange-500 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest">
                    {activeAnalysis.type}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white capitalize tracking-tight">
                  {activeAnalysis.keyword}
                </h3>
              </div>
              <button
                onClick={() => setActiveAnalysis(null)}
                className="text-white/40 bg-white/5 p-2 rounded-full">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-gray-300 leading-relaxed text-[16px] font-medium">
              {activeAnalysis.explanation}
            </p>
            <div className="mt-8 flex gap-3">
              <button className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-transform">
                Collect
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="relative z-50 bg-[#0B0A09]/80 backdrop-blur-xl border-b border-white/5 h-16 flex items-center px-4 shrink-0 justify-between">
        <button
          onClick={onBack}
          className="text-white flex items-center justify-center w-10 h-10 rounded-full bg-white/5 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[24px]">
            keyboard_arrow_down
          </span>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-white font-bold text-[15px]">Discussion</span>
          <span className="text-white/40 text-[10px] font-medium tracking-wider">
            {isLoading ? 'Syncing...' : `${messages.length} replies`}
          </span>
        </div>
        <button className="text-white flex items-center justify-center w-10 h-10 rounded-full bg-white/5 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[20px]">
            more_horiz
          </span>
        </button>
      </header>

      {/* [关键修改] 将 ref={scrollContainerRef} 绑定到这里
         确保我们能正确检测 scrollTop 是否为 0
      */}
      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 no-scrollbar relative z-10 overflow-x-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
            <p className="text-orange-500/50 text-[10px] font-black tracking-widest uppercase animate-pulse">
              Building Context Tree...
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-center pb-4 opacity-50">
              <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">
                Thread Start
              </div>
            </div>

            {messages.map((msg, index) => (
              <div
                key={`${msg.id}-${index}`}
                className="flex items-start gap-3 group animate-in slide-in-from-bottom-4 duration-500 fill-mode-backwards"
                style={{ animationDelay: `${index * 50}ms` }}>
                <div className="shrink-0 pt-1">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-black p-[1px] shadow-lg">
                    {msg.avatar ? (
                      <div
                        className="w-full h-full rounded-full bg-cover bg-center border border-white/10"
                        style={{ backgroundImage: `url("${msg.avatar}")` }}
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-[#1A1A1A] flex items-center justify-center border border-white/10">
                        <span className="text-[10px] font-black text-white/60">
                          {getInitials(msg.user)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-1.5 min-w-0 max-w-full">
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-300 text-[12px] font-bold truncate">
                      {msg.user}
                    </span>
                  </div>

                  {msg.replyText && (
                    <div className="mb-1 pl-3 py-1 border-l-[3px] border-orange-500/30 bg-white/5 rounded-r-lg max-w-[90%]">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="material-symbols-outlined text-[10px] text-orange-500">
                          reply
                        </span>
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                          {msg.replyToName}
                        </span>
                      </div>
                      <p className="text-[12px] text-white/30 line-clamp-1 italic">
                        "{msg.replyText}"
                      </p>
                    </div>
                  )}

                  <div
                    className="flex flex-col gap-2 items-start w-full cursor-pointer group-hover:brightness-110 transition-all"
                    onClick={() => setQuotedMessage(msg)}>
                    {splitTextToBubbles(msg.contentEn).map(
                      (bubbleText, bubbleIdx) => (
                        <div
                          key={bubbleIdx}
                          className={`
                          relative px-4 py-3 shadow-sm bg-[#1A1A1A]/80 backdrop-blur-md text-gray-100 border border-white/5 
                          text-[15px] leading-relaxed font-medium break-words max-w-full
                          ${bubbleIdx === 0 ? 'rounded-2xl rounded-tl-none' : 'rounded-2xl'} 
                        `}>
                          {renderFragmentWithGlow(bubbleText, msg.analysis)}
                        </div>
                      ),
                    )}

                    {msg.contentZh && (
                      <div className="px-4 py-2 bg-white/5 border border-white/5 rounded-xl rounded-tl-none text-[13px] font-normal leading-relaxed text-white/40 italic max-w-full break-words">
                        {msg.contentZh}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="h-32" />
          </>
        )}
      </main>

      <div className="absolute bottom-0 left-0 right-0 z-50 bg-[#0B0A09]/90 backdrop-blur-xl border-t border-white/5 px-4 pt-3 pb-8 safe-area-bottom">
        {quotedMessage && (
          <div className="flex justify-between items-center bg-white/5 rounded-t-xl px-4 py-2 mx-2 -mt-14 mb-2 border border-white/5 border-b-0 animate-in slide-in-from-bottom">
            <span className="text-[11px] text-white/50 truncate max-w-[80%]">
              Replying to{' '}
              <span className="font-bold text-white">{quotedMessage.user}</span>
            </span>
            <button onClick={() => setQuotedMessage(null)}>
              <span className="material-symbols-outlined text-[16px] text-white/40">
                close
              </span>
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/10 rounded-full h-11 flex items-center px-4 border border-white/5 focus-within:border-orange-500/50 focus-within:bg-white/15 transition-all">
            <input
              className="bg-transparent border-none outline-none text-white text-sm w-full placeholder-white/30"
              placeholder={
                quotedMessage ? 'Write a reply...' : 'Add to the discussion...'
              }
            />
          </div>
          <button className="w-11 h-11 rounded-full bg-gradient-to-tr from-orange-500 to-red-600 flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform">
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .animate-glow { animation: glow 2s ease-in-out infinite; }
        .fill-mode-backwards { animation-fill-mode: backwards; }
      `}</style>
    </div>
  )
}

export default ChatRoom
