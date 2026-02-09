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
  highlightedId?: string | null
  className?: string
  difficulty?: string
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
}) => {
  const isOp = comment.id === 'op-message'
  const isHighlighted = highlightedId === comment.id
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)

  const segments = useMemo(
    () => getMessageSegments(comment, difficulty),
    [comment, difficulty],
  )

  // --- 长按逻辑修复 ---
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    // [核心修复] 阻止事件冒泡，防止触发背景的长按翻译
    e.stopPropagation()

    if (!onLongPress) return
    const event = e
    pressTimerRef.current = setTimeout(() => {
      onLongPress(event, comment)
    }, 500)
  }

  const handleTouchEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  // --- UI 样式恢复 (ChatRoom 同款) ---
  const baseBubbleClass = isUser
    ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-[1.8rem] rounded-tr-none shadow-orange-500/20 shadow-md'
    : comment.isLocalAi
      ? 'bg-white/80 dark:bg-white/5 backdrop-blur-3xl border border-orange-500/30 text-gray-800 dark:text-white/90 rounded-[1.8rem] rounded-tl-none ring-1 ring-orange-500/10 shadow-sm'
      : 'bg-white/80 dark:bg-white/5 backdrop-blur-3xl border border-gray-100 dark:border-white/5 text-gray-800 dark:text-white/90 rounded-[1.8rem] rounded-tl-none shadow-sm'

  const highlightClass = isHighlighted
    ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-[#0B0A09]'
    : ''

  return (
    <div
      className={`message-bubble relative px-4 py-2.5 transition-all duration-500 ${baseBubbleClass} ${highlightClass} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}>
      {/* 1. 文化注记指示器 */}
      {comment.enrichment?.cultural_notes &&
        comment.enrichment.cultural_notes.length > 0 && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-[#0B0A09] z-10 animate-pulse">
            <span className="material-symbols-outlined text-[12px] text-black font-black">
              lightbulb
            </span>
          </div>
        )}

      {/* 2. Loading 状态 */}
      {comment.isLoading ? (
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
      ) : (
        /* 3. 内容渲染循环 */
        <div className="text-[15px] leading-relaxed font-medium space-y-1 overflow-visible">
          {segments.length > 0 ? (
            segments.map((seg, i) => {
              // 3.1 [修复] GIF/图片渲染
              if (isImageUrl(seg.en)) {
                return (
                  <div
                    key={i}
                    className="my-2 rounded-xl overflow-hidden border border-white/10 shadow-sm">
                    <img
                      src={seg.en}
                      alt="content"
                      className="w-full h-auto object-cover min-h-[60px] bg-gray-100 dark:bg-white/5"
                      loading="lazy"
                    />
                  </div>
                )
              }

              // 3.2 引用块渲染
              const isQuote = seg.en.trim().startsWith('>')
              if (isQuote) {
                const quoteText = seg.en.replace(/^>\s?/, '')
                return (
                  <div
                    key={i}
                    className="border-l-4 border-white/30 pl-3 my-1 italic opacity-80">
                    <InteractiveText
                      text={quoteText}
                      contextSentence={seg.en}
                      externalOnClick={(w) => onWordClick(w, seg.en)}
                      disabled={isUser}
                    />
                  </div>
                )
              }

              // 3.3 普通文本
              return (
                <span key={i} className="inline mr-1">
                  <InteractiveText
                    text={seg.en}
                    contextSentence={seg.en}
                    externalOnClick={(w) => onWordClick(w, seg.en)}
                    disabled={isUser}
                  />
                  {/* 句级翻译 - 如果 getMessageSegments 返回了 null 这里就不会显示 */}
                  <AnimatePresence>
                    {showTranslation && seg.zh && (
                      <motion.span
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="block text-[13px] text-gray-500 dark:text-white/50 italic mt-1 mb-2 leading-snug">
                        {seg.zh}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              )
            })
          ) : (
            <span>{comment.content}</span>
          )}
        </div>
      )}

      {/* 4. 全文翻译兜底 (如果 sentence_segments 不存在或被清空时显示) */}
      {/* 解决了 TopicHub 重复翻译问题：如果上面 segments 里有 zh，这里就不会显示 */}
      <AnimatePresence>
        {showTranslation &&
          comment.content_cn &&
          (!comment.enrichment?.sentence_segments || isOp) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 pt-3 border-t border-gray-200 dark:border-white/10 text-[13px] text-gray-500 dark:text-white/50 italic leading-snug">
              {comment.content_cn}
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  )
}

export default MessageBubble
