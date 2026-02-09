import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface JellyFollowButtonProps {
    isFollowing: boolean
    onClick: (e: React.MouseEvent) => void
    label?: string
}

const JellyFollowButton: React.FC<JellyFollowButtonProps> = ({
    isFollowing,
    onClick,
    label = 'Follow',
}) => {
    // 这种水滴形状与 App 统一
    const DROPLET_SHAPE = '50% 50% 50% 50% / 60% 60% 43% 43%'

    return (
        <AnimatePresence mode="wait">
            {!isFollowing && (
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{
                        scale: 1.5,
                        opacity: 0,
                        transition: { duration: 0.2, ease: "easeOut" }
                    }}
                    transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 25,
                    }}
                    className="flex flex-col items-center gap-1.5 relative select-none"
                >
                    <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.8 }}
                        onClick={onClick}
                        className="flex items-center justify-center transition-all duration-300 relative z-10 bg-transparent shadow-none"
                        style={{ width: '40px', height: '40px' }}>
                        <span className="material-symbols-outlined text-[24px] text-white/70 hover:text-white">
                            person_add
                        </span>
                    </motion.button>

                    <span className="text-[10px] font-black drop-shadow-md text-white/50">
                        {label}
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default JellyFollowButton
