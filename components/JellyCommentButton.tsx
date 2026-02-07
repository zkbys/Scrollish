import React from 'react'
import { motion } from 'framer-motion'

interface JellyCommentButtonProps {
    onClick: (e: React.MouseEvent) => void
    label?: string
}

const JellyCommentButton: React.FC<JellyCommentButtonProps> = ({ onClick, label }) => {
    // 这种水滴形状与 App 统一
    const DROPLET_SHAPE = "50% 50% 50% 50% / 60% 60% 43% 43%"

    return (
        <div className="flex flex-col items-center gap-1.5 relative group select-none">
            <motion.button
                whileHover={{ scale: 1.15, y: -2 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClick}
                className="w-12 h-12 bg-transparent flex items-center justify-center transition-colors relative overflow-hidden"
                style={{ borderRadius: DROPLET_SHAPE, width: '46px', height: '46px' }}
            >
                <motion.span
                    className="material-symbols-outlined text-[26px] text-white"
                    whileHover={{
                        rotate: [0, -10, 10, -5, 5, 0],
                        transition: { duration: 0.5, ease: "easeInOut" }
                    }}
                >
                    chat_bubble
                </motion.span>
            </motion.button>
            {label && (
                <span className="text-white/50 text-[10px] font-black drop-shadow-md">
                    {label}
                </span>
            )}
        </div>
    )
}

export default JellyCommentButton
