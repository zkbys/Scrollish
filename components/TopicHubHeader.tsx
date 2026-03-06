import React from 'react'

interface TopicHubHeaderProps {
    onBack: () => void
    subreddit: string
}

const TopicHubHeader: React.FC<TopicHubHeaderProps> = ({ onBack, subreddit }) => {
    return (
        <>
            <button
                onClick={onBack}
                className="absolute top-5 left-5 w-10 h-10 bg-black/20 backdrop-blur rounded-full flex items-center justify-center text-white border border-white/20 z-[80]">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="absolute inset-x-0 bottom-0 p-6 z-[70] pointer-events-none">
                <span className="text-white/80 text-[10px] font-bold uppercase tracking-widest">
                    {subreddit}
                </span>
            </div>
        </>
    )
}

export default TopicHubHeader
