import React, { useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import InteractiveText from './InteractiveText'
import { getMessageSegments, isImageUrl } from '../utils/textProcessing'
import { Comment } from '../types'

interface MessageBubbleProps {
  comment: Comment
  isUser: boolean
  onWordClick: (word: string, context: string) => void
  onLongPress?: (
    e: React.TouchEvent | React.MouseEvent,
    comment: Comment,
  ) => void
  showTranslation?: boolean
  onNoteClick?: (notes: any[]) => void
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  comment,
  isUser,
  onWordClick,
  onLongPress,
  showTranslation = false,
  highlightedId,
  className = '',
  difficulty = 'Original',
  onNoteClick,
}) => {
  const isHighlighted = highlightedId === comment.id

  // Refs
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const isLongPressTriggered = useRef(false) // 长按锁

  const segments = useMemo(
    () => getMessageSegments(comment, difficulty),
    [comment, difficulty],
  )

  // --- 手势处理逻辑 ---

  const clearTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    // 阻止冒泡，避免触发卡片级别的点击
    e.stopPropagation()

    if (!onLongPress) return

    isLongPressTriggered.current = false // 重置锁

    // 记录起始坐标
    if ('touches' in e) {
      touchStartPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    } else {
      touchStartPos.current = { x: e.clientX, y: e.clientY }
    }

    clearTimer()

    const event = e // Capture event for callback
    // 设定 600ms 阈值，既不会太难触发，也不容易误触
    pressTimerRef.current = setTimeout(() => {
      // 再次检查是否已经移动或结束（双重保险）
      if (!touchStartPos.current) return

      if (navigator.vibrate) navigator.vibrate(50)
      isLongPressTriggered.current = true // 【上锁】标记长按已触发
      onLongPress(event, comment)
    }, 600)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return

    const moveX = Math.abs(e.touches[0].clientX - touchStartPos.current.x)
    const moveY = Math.abs(e.touches[0].clientY - touchStartPos.current.y)

    // 移动超过 10px 视为滑动，立即取消长按
    if (moveX > 10 || moveY > 10) {
      clearTimer()
      touchStartPos.current = null
    }
  }

  const handleTouchEnd = () => {
    clearTimer()
    // 延迟清空坐标，防止 InteractiveText 的 onClick 读取不到状态
    setTimeout(() => {
      touchStartPos.current = null
    }, 0)
  }

  // 点击查词代理函数
  const handleInteractiveClick = (word: string, context: string) => {
    // 【核心修复】如果长按锁是开着的，说明触发了菜单，坚决拦截查词
    if (isLongPressTriggered.current) {
      return
    }
    // 双重保险：如果有计时器还没清除（理论上 TouchEnd 会清，但防万一），也清除
    clearTimer()

    onWordClick(word, context)
  }

  // --- 样式定义 ---
  const getBubbleClass = (isImage: boolean) => {
    if (isImage) return 'my-1'

    if (isUser) {
      return 'bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-2xl rounded-tr-none shadow-orange-500/20 shadow-md border border-transparent'
    }
    if (comment.isLocalAi) {
      return 'bg-white/80 dark:bg-white/5 backdrop-blur-3xl border border-orange-500/30 text-gray-800 dark:text-white/90 rounded-2xl rounded-tl-none ring-1 ring-orange-500/10 shadow-sm'
    }
    return 'bg-white/80 dark:bg-white/5 backdrop-blur-3xl border border-gray-100 dark:border-white/5 text-gray-800 dark:text-white/90 rounded-2xl rounded-tl-none shadow-sm'
  }

  const containerClass = `message-bubble-container flex flex-col gap-2 select-none -webkit-user-select-none ${isUser ? 'items-end' : 'items-start'} ${className}`
  const highlightClass = isHighlighted
    ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-[#0B0A09] rounded-2xl'
    : ''

  return (
    <div className={containerClass}>
      {/* Loading 状态 */}
      {comment.isLoading ? (
        <div className={`px-4 py-2.5 ${getBubbleClass(false)} w-fit`}>
          <div className="flex items-center gap-2 animate-pulse py-1">
            <span className="text-sm font-medium">Replying</span>
            <div className="flex gap-1">
              <span
                className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        </div>
      ) : /* 内容渲染循环 */
        segments.length > 0 ? (
          segments.map((seg, i) => {
            // 图片... (省略图片渲染逻辑)
            if (isImageUrl(seg.en)) {
              return (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden border border-white/10 shadow-sm max-w-full"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onTouchMove={handleTouchMove}
                  onMouseDown={handleTouchStart}
                  onMouseUp={handleTouchEnd}
                  onMouseLeave={handleTouchEnd}
                  onContextMenu={(e) => e.preventDefault()}>
                  <img
                    src={seg.en}
                    alt="content"
                    className="w-full h-auto object-cover min-h-[60px] max-h-[300px] bg-gray-100 dark:bg-white/5"
                    loading="lazy"
                  />
                </div>
              )
            }

            // 文本
            const isQuote = seg.en.trim().startsWith('>')
            const displayText = isQuote ? seg.en.replace(/^>\s?/, '') : seg.en

            // 计算本分句包含的注记
            const segmentNotes =
              comment.enrichment?.cultural_notes?.filter((note) =>
                seg.en.toLowerCase().includes(note.trigger_word.toLowerCase()),
              ) || []

            return (
              <div
                key={i}
                className={`relative px-4 py-2.5 transition-all duration-300 max-w-full ${getBubbleClass(false)} ${highlightClass}`}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onTouchMove={handleTouchMove}
                onMouseDown={handleTouchStart}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onContextMenu={(e) => e.preventDefault()}>
                {/* 分句对应的注记灯泡 */}
                {segmentNotes.length > 0 && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onNoteClick) onNoteClick(segmentNotes)
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg border border-white dark:border-[#0B0A09] z-[15] cursor-pointer hover:scale-110 active:scale-90 transition-transform">
                    <span className="material-symbols-outlined text-[10px] text-black font-black">
                      lightbulb
                    </span>
                  </div>
                )}

                <div
                  className={`text-[15px] leading-relaxed font-medium ${isQuote ? 'italic opacity-90 border-l-2 border-current pl-2' : ''}`}>
                  <InteractiveText
                    text={displayText}
                    contextSentence={seg.en}
                    externalOnClick={(w) => handleInteractiveClick(w, seg.en)}
                    disabled={isUser}
                  />
                </div>

                {/* 句级翻译 */}
                <AnimatePresence>
                  {showTranslation && seg.zh && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[13px] opacity-70 italic mt-1.5 pt-1.5 border-t border-white/10 leading-snug">
                      {seg.zh}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })
        ) : (
          <span className="text-red-500 text-xs">No content</span>
        )}

      {/* 全文翻译兜底 */}
      <AnimatePresence>
        {showTranslation &&
          comment.content_cn &&
          !comment.enrichment?.sentence_segments &&
          segments.every((s) => !s.zh) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="max-w-full bg-black/5 dark:bg-white/5 px-3 py-2 rounded-xl text-[12px] text-gray-500 dark:text-white/50 italic leading-snug self-start">
              <span className="text-[9px] font-bold uppercase mr-1 opacity-50">
                Full Trans:
              </span>
              {comment.content_cn}
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  )
}

export default MessageBubble
