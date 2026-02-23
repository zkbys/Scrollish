import React from 'react'

interface ChatRoomHeaderProps {
    onBack: () => void
    onSettings: () => void
    responsesCount: number
}

const DROPLET_SHAPE = '50% 50% 50% 50% / 60% 60% 43% 43%'

const ChatRoomHeader: React.FC<ChatRoomHeaderProps> = ({
    onBack,
    onSettings,
    responsesCount,
}) => {
    return (
        <div
            className="fixed top-0 left-0 right-0 flex items-center justify-between px-5 bg-orange-500/90 dark:bg-black/40 backdrop-blur-3xl border-b border-orange-600/20 dark:border-white/5 z-[70]"
            style={{
                paddingTop: 'env(safe-area-inset-top)',
                height: 'calc(4.5rem + env(safe-area-inset-top))',
            }}>
            <button
                onClick={onBack}
                className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-2xl"
                style={{ borderRadius: DROPLET_SHAPE }}>
                <span className="material-symbols-outlined text-white">
                    keyboard_arrow_down
                </span>
            </button>
            <div className="flex flex-col items-center">
                <span className="text-white font-black text-sm">Thread Discussion</span>
                <span className="text-white/30 text-[10px] uppercase font-bold">
                    {responsesCount} RESPONSES
                </span>
            </div>
            <button
                onClick={onSettings}
                className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-2xl active:scale-95 transition-transform"
                style={{ borderRadius: DROPLET_SHAPE }}>
                <span className="material-symbols-outlined text-white text-[20px]">
                    settings
                </span>
            </button>
        </div>
    )
}

export default ChatRoomHeader
