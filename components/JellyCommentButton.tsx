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
                whileTap={{ scale: 0.8 }}
                onClick={onClick}
                className="flex items-center justify-center transition-all duration-300 relative z-10 bg-transparent shadow-none"
                style={{ borderRadius: DROPLET_SHAPE, width: 'clamp(2.2rem,5.5dvh,2.5rem)', height: 'clamp(2.2rem,5.5dvh,2.5rem)' }}
            >
                <motion.span
                    className="material-symbols-outlined text-[clamp(20px,2.8dvh,24px)] text-white/70 hover:text-white"
                    whileHover={{
                        rotate: [0, -10, 10, -5, 5, 0],
                        transition: { duration: 0.5, ease: "easeInOut" }
                    }}
                >
                    chat_bubble
                </motion.span>
            </motion.button>
            {label && (
                <span className="text-white/50 text-[clamp(8px,1.2dvh,10px)] font-black drop-shadow-md">
                    {label}
                </span>
            )}
        </div>
    )
}

export default JellyCommentButton
