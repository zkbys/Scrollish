import React from 'react'
import MessageBubble from './MessageBubble'
import { CulturalNote } from '../types'

interface TopicCardProps {
    activeComment: any
    activeReplyCount: number
    currentIndex: number
    totalComments: number
    animationClass: string
    isCardAtBottom: boolean
    contentRef: React.RefObject<HTMLDivElement>
    onTouchStart: (e: React.TouchEvent) => void
    onTouchEnd: (e: React.TouchEvent) => void
    onCardScroll: (e: React.UIEvent<HTMLDivElement>) => void
    onWordClick: (word: string, context: string) => void
    onNoteClick: (notes: CulturalNote[]) => void
    onGoToChatRoom: () => void
}

const TopicCard: React.FC<TopicCardProps> = ({
    activeComment,
    activeReplyCount,
    currentIndex,
    totalComments,
    animationClass,
    isCardAtBottom,
    contentRef,
    onTouchStart,
    onTouchEnd,
    onCardScroll,
    onWordClick,
    onNoteClick,
    onGoToChatRoom,
}) => {
    return (
        <div
            className="relative w-full px-4 h-[52vh] overscroll-x-none !overscroll-x-none touch-pan-y !touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}>
            <div
                className={`absolute inset-x-4 top-0 bottom-0 flex flex-col overflow-hidden transition-all duration-300 shadow-2xl rounded-[2.5rem] border border-white/40 dark:border-white/10 ${animationClass} 
        bg-white/60 dark:bg-[#121212]/60 backdrop-blur-3xl overscroll-x-none !overscroll-x-none touch-pan-y !touch-pan-y`}>
                <div className="h-16 border-b border-gray-200/50 dark:border-white/5 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-8 h-8 rounded-full p-[2px] ${activeComment?.isOpCard ? 'bg-gray-200 dark:bg-white' : 'bg-gradient-to-tr from-orange-500 to-red-500'}`}>
                            <div className="w-full h-full rounded-full bg-white dark:bg-[#121212] flex items-center justify-center text-[10px] font-black">
                                {activeComment?.isOpCard
                                    ? 'OP'
                                    : activeComment?.author?.slice(0, 2).toUpperCase() || '??'}
                            </div>
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="text-gray-900 dark:text-white font-bold text-sm leading-tight">
                                {activeComment?.author || 'Unknown'}
                            </span>
                            {!activeComment?.isOpCard && (
                                <div className="flex items-center gap-3 mt-0.5">
                                    <div className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[10px] text-orange-500">
                                            favorite
                                        </span>
                                        <span className="text-[9px] font-bold text-gray-500 dark:text-white/60">
                                            {activeComment.upvotes || 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[10px] text-blue-400">
                                            chat_bubble
                                        </span>
                                        <span className="text-[9px] font-bold text-gray-500 dark:text-white/60">
                                            {activeReplyCount} replies
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {!activeComment?.isOpCard && (
                        <button
                            onClick={onGoToChatRoom}
                            className="w-10 h-10 rounded-full bg-gray-100/80 dark:bg-white/5 flex items-center justify-center active:scale-95 transition-all hover:bg-gray-200/80 dark:hover:bg-white/10">
                            <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-[20px]">
                                expand_less
                            </span>
                        </button>
                    )}
                </div>

                <div
                    ref={contentRef}
                    onScroll={onCardScroll}
                    className="flex-1 p-6 overflow-y-auto no-scrollbar scroll-smooth overscroll-x-none">
                    <MessageBubble
                        comment={activeComment}
                        isUser={false}
                        onWordClick={onWordClick}
                        showTranslation={true}
                        onNoteClick={onNoteClick}
                    />
                    <div className="h-12" />
                </div>

                <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-white/90 via-white/50 to-transparent dark:from-[#000000] dark:via-[#121212]/50 pointer-events-none flex flex-col justify-end pb-4">
                    <div className="flex justify-center opacity-80">
                        {activeComment?.isOpCard ? (
                            <div className="flex flex-col items-center animate-bounce-subtle">
                                <div className="flex items-center gap-1 text-gray-400 dark:text-white/60">
                                    <span className="text-[9px] font-black uppercase tracking-widest">
                                        左滑看观点
                                    </span>
                                    <span className="material-symbols-outlined text-[14px]">
                                        arrow_forward
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div
                                className={`flex flex-col items-center transition-all duration-300 ${isCardAtBottom ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-50'}`}>
                                {isCardAtBottom ? (
                                    <>
                                        <span className="material-symbols-outlined text-orange-500 text-[18px] animate-bounce">
                                            keyboard_double_arrow_up
                                        </span>
                                        <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest mt-0.5">
                                            上拉进入讨论
                                        </span>
                                    </>
                                ) : (
                                    <span className="material-symbols-outlined text-gray-300 dark:text-white/30 text-[16px]">
                                        keyboard_arrow_down
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TopicCard
