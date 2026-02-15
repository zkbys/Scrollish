import React from 'react'
import { motion, useAnimation } from 'framer-motion'

interface JellyLikeButtonProps {
    isLiked: boolean
    onClick: (e: React.MouseEvent) => void
    count?: number | string
}

const JellyLikeButton: React.FC<JellyLikeButtonProps> = ({ isLiked, onClick, count }) => {
    // [新增] 记录用户是否在当前生命周期内点击过点赞
    // 这样可以防止每次进入页面时，已点赞的帖子都重新触发一次庆祝动效
    const [hasInteracted, setHasInteracted] = React.useState(false)

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

    const handleClick = (e: React.MouseEvent) => {
        setHasInteracted(true)
        onClick(e)
    }

    return (
        <div className="flex flex-col items-center gap-1.5 relative select-none">
            {/* 细腻径向气泡层 - 90px */}
            {/* [修改] 只有在交互过且当前是点赞状态时才展示粒子 */}
            <div
                key={isLiked ? 'particles-on' : 'particles-off'}
                className="absolute top-[23px] left-1/2 -translate-x-1/2 w-0 h-0 pointer-events-none z-0"
            >
                {hasInteracted && isLiked && [...Array(30)].map((_, i) => (
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
                // [修改] 只有在交互过且点赞时才触发跳动效果
                animate={(hasInteracted && isLiked) ? {
                    scale: [0.8, 1.25, 0.9, 1.1, 1],
                    y: [0, -10, 0], // 跳动效果
                } : { scale: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-center justify-center transition-all duration-300 relative z-10 bg-transparent shadow-none"
                style={{ width: 'clamp(2.5rem,6.5dvh,3rem)', height: 'clamp(2.5rem,6.5dvh,3rem)' }}
            >
                <span
                    className={`material-symbols-outlined text-[clamp(26px,3.8dvh,32px)] transition-all duration-300 ${isLiked ? 'text-orange-500 fill-[1] drop-shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 'text-white/70 hover:text-white'}`}>
                    favorite
                </span>
            </motion.button>

            {count !== undefined && (
                <span className={`text-[clamp(10px,1.4dvh,12px)] font-black drop-shadow-md transition-colors ${isLiked ? 'text-orange-400' : 'text-white/50'}`}>
                    {count}
                </span>
            )}
        </div>
    )
}

export default JellyLikeButton
