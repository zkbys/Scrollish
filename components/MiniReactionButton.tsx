import React, { useState } from 'react'
import { motion } from 'framer-motion'

const MiniReactionButton = ({ upvotes }: { upvotes: number }) => {
    const [isLiked, setIsLiked] = useState(false)
    const [count, setCount] = useState(upvotes)

    const bubbleVariants = {
        initial: { opacity: 0, scale: 0, x: 0, y: 0 },
        animate: (i: number) => {
            const angle = (i / 15) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
            const distance = 15 + Math.random() * 15
            return {
                opacity: [0, 1, 1, 0],
                scale: [0, 1 + Math.random() * 0.3, 0.4, 0],
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                transition: { duration: 0.6 + Math.random() * 0.4, ease: 'circOut' },
            }
        },
    }

    const handleLike = () => {
        if (navigator.vibrate) navigator.vibrate(20)
        setIsLiked(!isLiked)
        setCount((c) => (isLiked ? c - 1 : c + 1))
    }

    return (
        <div className="relative flex items-center">
            <div className="absolute top-1/2 left-3 -translate-y-1/2 w-0 h-0 pointer-events-none z-0">
                {isLiked &&
                    [...Array(15)].map((_, i) => (
                        <motion.div
                            key={`p-${i}`}
                            custom={i}
                            variants={bubbleVariants}
                            initial="initial"
                            animate="animate"
                            className="absolute w-1 h-1 rounded-full bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.6)]"
                        />
                    ))}
            </div>
            <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={handleLike}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors z-10 ${isLiked
                        ? 'bg-orange-500/10'
                        : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5'
                    }`}>
                <motion.span
                    animate={isLiked ? { scale: [0.8, 1.3, 1] } : { scale: 1 }}
                    className={`material-symbols-outlined text-[14px] ${isLiked ? 'text-orange-500 fill-[1]' : 'text-gray-400'
                        }`}>
                    favorite
                </motion.span>
                <span
                    className={`text-[11px] font-black ${isLiked ? 'text-orange-500' : 'text-gray-400'
                        }`}>
                    {count}
                </span>
            </motion.button>
        </div>
    )
}

export default MiniReactionButton
