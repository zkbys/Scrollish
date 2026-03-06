import React, { useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import InteractiveText from './InteractiveText'
import { getMessageSegments, isImageUrl } from '../utils/textProcessing'
import { Comment } from '../types'
import { useTTS } from '../hooks/useTTS'

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
  highlightedId?: string | null
  className?: string
  difficulty?: string
  isOpCard?: boolean // [新增] 是否为楼主原帖，用于控制长文折叠
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
  isOpCard = false,
}) => {
  const isHighlighted = highlightedId === comment.id

  // Refs & States
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const isLongPressTriggered = useRef(false)

  // 移除之前的分句激活逻辑，改为气泡级常驻显示
  const { speak, isPlaying, isLoading: isSynthesizing, currentId } = useTTS()
  const [activeTtsIndex, setActiveTtsIndex] = useState<number | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({})

  const segments = useMemo(
    () => getMessageSegments(comment, difficulty),
    [comment, difficulty],
  )

  // [新增] 计算可视片段
  const visibleSegments = useMemo(() => {
    if (isOpCard && isOpFolded && segments.length > 3) {
      return segments.slice(0, 1) // 只显示第一段，剩余的折叠
    }
    return segments
  }, [segments, isOpCard, isOpFolded])

  // [新增] 判断是否有隐藏内容
  const hasHiddenSegments = isOpCard && segments.length > 3

  const allNoteTriggerWords = useMemo(() => {
    return (
      comment.enrichment?.cultural_notes?.map((note) => note.trigger_word) || []
    )
  }, [comment.enrichment])

  // --- 手势与点击处理逻辑 ---

  const clearTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation()
    if (!onLongPress) return

    isLongPressTriggered.current = false

    if ('touches' in e) {
      touchStartPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    } else {
      touchStartPos.current = { x: e.clientX, y: e.clientY }
    }

    clearTimer()
    const event = e
    pressTimerRef.current = setTimeout(() => {
      if (!touchStartPos.current) return
      if (navigator.vibrate) navigator.vibrate(50)
      isLongPressTriggered.current = true
      onLongPress(event, comment)
    }, 600)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return
    const moveX = Math.abs(e.touches[0].clientX - touchStartPos.current.x)
    const moveY = Math.abs(e.touches[0].clientY - touchStartPos.current.y)

    if (moveX > 10 || moveY > 10) {
      clearTimer()
      touchStartPos.current = null
    }
  }

  const handleTouchEnd = () => {
    clearTimer()
    setTimeout(() => {
      touchStartPos.current = null
    }, 0)
  }

  const handleInteractiveClick = (word: string, context: string) => {
    if (isLongPressTriggered.current) return
    clearTimer()
    onWordClick(word, context)
  }

  const handleSegmentClick = (i: number) => {
    if (isLongPressTriggered.current) return
    clearTimer()
    // 移除分句激活，保留交互
  }

  const handleTTS = (e: React.MouseEvent | React.TouchEvent, text: string, index: number) => {
    e.stopPropagation()
    const segmentId = `${comment.id}-${index}`
    speak(text, segmentId)
  }

  // --- 样式定义 ---
  const getBubbleClass = (isImage: boolean) => {
    if (isImage) return 'my-1'

    if (isUser) {
      return 'bg-primary text-white rounded-2xl rounded-tr-none shadow-orange-500/20 shadow-md border border-transparent'
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
      ) : visibleSegments.length > 0 ? (
        <>
          {visibleSegments.map((seg, i) => {
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

            const isQuote = seg.en.trim().startsWith('>')
            const displayText = isQuote ? seg.en.replace(/^>\s?/, '') : seg.en

            const segmentNotes =
              comment.enrichment?.cultural_notes?.filter((note) =>
                seg.en.toLowerCase().includes(note.trigger_word.toLowerCase()),
              ) || []

            const isNoteExpanded = expandedNotes[i]

            return (
              <div
                key={i}
                className={`relative px-4 py-2.5 transition-all duration-300 max-w-full ${getBubbleClass(false)} ${highlightClass}`}
                onClick={() => handleSegmentClick(i)}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onTouchMove={handleTouchMove}
                onMouseDown={handleTouchStart}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onContextMenu={(e) => e.preventDefault()}>
                {segmentNotes.length > 0 && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      if (navigator.vibrate) navigator.vibrate(20)
                      setExpandedNotes((prev) => ({ ...prev, [i]: !prev[i] }))
                    }}
                    className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-lg border z-[15] cursor-pointer hover:scale-110 active:scale-90 transition-colors duration-300 ${isNoteExpanded ? 'bg-orange-500 border-orange-600' : 'bg-yellow-400 border-white dark:border-[#0B0A09]'}`}>
                    <span
                      className={`material-symbols-outlined text-[10px] font-black ${isNoteExpanded ? 'text-white' : 'text-black'}`}>
                      {isNoteExpanded ? 'close' : 'lightbulb'}
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
                    highlightWords={allNoteTriggerWords}
                  />
                </div>

                <AnimatePresence>
                  {isNoteExpanded && segmentNotes.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-3">
                      <div
                        className="p-3 bg-orange-500/10 dark:bg-orange-500/5 border border-orange-500/20 rounded-xl space-y-3 cursor-default"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="material-symbols-outlined text-[14px] text-orange-500">
                            lightbulb
                          </span>
                          <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                            Cultural Insights
                          </span>
                        </div>
                        {segmentNotes.map((note, idx) => (
                          <div key={idx} className="space-y-1">
                            <span className="inline-block px-1.5 py-0.5 bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded text-[10px] font-black uppercase">
                              {note.trigger_word}
                            </span>
                            <p className="text-[13px] leading-snug text-gray-700 dark:text-gray-300 font-medium">
                              {note.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

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

              {/* [新增] 气泡级常驻 TTS 按钮 - 读整句话 */}
              {!isUser && !comment.isLoading && (
                <button
                  onClick={(e) => handleTTS(e, comment.content_en || comment.content || '', 999)}
                  className={`absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-lg border z-[30] transition-all
                    ${isPlaying && currentId === `${comment.id}-999`
                      ? 'bg-orange-500 text-white border-orange-600 scale-110'
                      : 'bg-white dark:bg-[#2C2C2E] border-gray-100 dark:border-white/10 text-orange-500 hover:bg-orange-50 dark:hover:bg-white/5 active:scale-95'}
                  `}>
                  {isSynthesizing && currentId === `${comment.id}-999` ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className={`material-symbols-outlined text-[16px] ${isPlaying && currentId === `${comment.id}-999` ? 'animate-pulse' : ''}`}>
                      {isPlaying && currentId === `${comment.id}-999` ? 'stop' : 'volume_up'}
                    </span>
                  )}
                </button>
              )}
            </div>
          )
        })
      ) : (
        <span className="text-red-500 text-xs">No content</span>
      )}

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
