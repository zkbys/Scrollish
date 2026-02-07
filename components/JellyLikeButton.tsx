import React from 'react'
import { motion, useAnimation } from 'framer-motion'

interface JellyLikeButtonProps {
    isLiked: boolean
    onClick: (e: React.MouseEvent) => void
    count?: number | string
}

const JellyLikeButton: React.FC<JellyLikeButtonProps> = ({ isLiked, onClick, count }) => {
    const controls = useAnimation()

    // 气泡效果配置 (径向发散 - 细腻 90px 版)
    const bubbleVariants = {
        initial: { opacity: 0, scale: 0, x: 0, y: 0 },
        animate: (i: number) => {
            const angle = (i / 30) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
            const distance = 45 + Math.random() * 45 // 扩散半径扩展到 90 左右
            return {
                opacity: [0, 1, 1, 0],
                scale: [0, 1 + Math.random() * 0.4, 0.4, 0], // 更细腻的缩放
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                transition: {
                    duration: 0.8 + Math.random() * 0.6,
                    ease: "circOut",
                    delay: Math.random() * 0.15
                }
            }
        }
    }

    // 这种水滴形状与 App 统一
    const DROPLET_SHAPE = "50% 50% 50% 50% / 60% 60% 43% 43%"

    const handleClick = (e: React.MouseEvent) => {
        onClick(e)
    }

    return (
        <div className="flex flex-col items-center gap-1.5 relative select-none">
            {/* 细腻径向气泡层 - 90px */}
            <div className="absolute top-[23px] left-1/2 -translate-x-1/2 w-0 h-0 pointer-events-none z-0">
                {isLiked && [...Array(30)].map((_, i) => (
                    <motion.div
                        key={`${i}-${isLiked}`}
                        custom={i}
                        variants={bubbleVariants}
                        initial="initial"
                        animate="animate"
                        className="absolute w-1.5 h-1.5 rounded-full border border-orange-400/50 bg-orange-600 backdrop-blur-[0.2px] shadow-[0_0_6px_rgba(234,88,12,0.4)]"
                    />
                ))}
            </div>

            <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.8 }}
                onClick={handleClick}
                animate={isLiked ? {
                    scale: [0.8, 1.2, 0.9, 1.1, 1],
                    y: [0, -8, 0], // 垂直起跳
                } : { scale: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`flex items-center justify-center transition-all duration-300 relative overflow-hidden z-10 ${isLiked ? 'bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/40' : 'bg-transparent shadow-none'}`}
                style={{ borderRadius: DROPLET_SHAPE, width: '46px', height: '46px' }}
            >
                <span
                    className={`material-symbols-outlined text-[28px] transition-colors duration-300 ${isLiked ? 'text-white fill-[1]' : 'text-orange-400/80 drop-shadow-sm'}`}>
                    favorite
                </span>
            </motion.button>

            {count !== undefined && (
                <span className={`text-[12px] font-black drop-shadow-md transition-colors ${isLiked ? 'text-orange-400' : 'text-white/50'}`}>
                    {count}
                </span>
            )}
        </div>
    )
}

export default JellyLikeButton
