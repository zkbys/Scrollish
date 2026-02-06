import React from 'react'
import { motion, useAnimation } from 'framer-motion'

interface JellyLikeButtonProps {
    isLiked: boolean
    onClick: (e: React.MouseEvent) => void
    count?: number | string
}

const JellyLikeButton: React.FC<JellyLikeButtonProps> = ({ isLiked, onClick, count }) => {
    const controls = useAnimation()

    // 粒子效果配置
    const particleVariants = {
        initial: { opacity: 0, scale: 0, x: 0, y: 0 },
        explode: (i: number) => ({
            opacity: [1, 0],
            scale: [1, 0],
            x: Math.cos(i * 45 * (Math.PI / 180)) * 40,
            y: Math.sin(i * 45 * (Math.PI / 180)) * 40,
            transition: { duration: 0.6, ease: "easeOut" }
        })
    }

    // 这种水滴形状与 App 统一
    const DROPLET_SHAPE = "50% 50% 50% 50% / 60% 60% 43% 43%"

    const handleClick = (e: React.MouseEvent) => {
        onClick(e)
        if (!isLiked) { // 如果这次点击变成了 Like
            controls.start("explode")
        }
    }

    return (
        <div className="flex flex-col items-center gap-1.5 relative">
            {/* 烟花粒子层 */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 pointer-events-none z-0">
                {[...Array(8)].map((_, i) => (
                    <motion.div
                        key={i}
                        custom={i}
                        variants={particleVariants}
                        initial="initial"
                        animate={isLiked ? "explode" : "initial"} // 只在 Like 状态触发爆炸
                        className="absolute w-1.5 h-1.5 rounded-full bg-orange-400"
                    />
                ))}
            </div>

            <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.8 }}
                onClick={handleClick}
                animate={isLiked ? {
                    scale: [0.8, 1.2, 0.9, 1.1, 1],
                    y: [0, -8, 0], // 垂直起跳，不再歪头
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
