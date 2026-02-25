import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTTSStore } from '../store/useTTSStore'
import { getAssetPath } from '../constants'

const SpeakingAvatarOverlay: React.FC = () => {
    const activeVoice = useTTSStore((state) => state.activeVoice)
    const activeAvatar = useTTSStore((state) => state.activeAvatar)
    const activeVoiceName = useTTSStore((state) => state.activeVoiceName)
    const stopPlayback = useTTSStore((state) => state.stopCallback)
    const amplitude = useTTSStore((state) => state.amplitude)

    const [isVisible, setIsVisible] = React.useState(false)
    const [imgError, setImgError] = React.useState(false)

    // 彻底打乱灵敏度，避免 1357 这种规律性的高低差
    const sensitivities = React.useMemo(() => [
        1.4, 1.1, 1.8, 0.7, 1.5, 0.9, 1.3, 1.7
    ], [])

    React.useEffect(() => {
        if (activeVoice) {
            setIsVisible(true)
        } else {
            setIsVisible(false)
        }
    }, [activeVoice])

    // 如果没有传入 activeAvatar，则尝试回退到预定义路径或使用 null
    const avatarUrl = activeAvatar || (activeVoice && activeVoice !== 'cloned' && activeVoice !== 'System'
        ? getAssetPath(`/avatars/${activeVoice === 'Eldric Sage' ? 'Eldric' : activeVoice}.png`)
        : null);

    // Reset error state when avatarUrl changes
    React.useEffect(() => {
        setImgError(false)
    }, [avatarUrl])

    if (!activeVoice && !isVisible) return null

    // Determine if it's a special voice (cloned/system) for icon display
    // Updated: if we have a valid avatarUrl (even for cloned), we should show it
    const isSpecial = !avatarUrl && (activeVoice === 'cloned' || activeVoice === 'System' || activeVoice === 'system');

    return (
        <AnimatePresence>
            {activeVoice && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: 50 }}
                    className="fixed bottom-24 right-6 z-[200] group"
                >
                    {/* 背景光晕动画 */}
                    <div className="absolute inset-0 bg-orange-500/30 rounded-[24px] blur-xl animate-pulse" />

                    <button
                        onClick={() => {
                            if (stopPlayback) stopPlayback()
                            if (navigator.vibrate) navigator.vibrate(20)
                        }}
                        className="relative w-16 h-16 rounded-[20px] bg-white dark:bg-[#1A1A1A] border-2 border-orange-500 shadow-2xl overflow-hidden flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                    >
                        {isSpecial ? (
                            <div className="w-full h-full bg-orange-500 flex items-center justify-center text-white">
                                <span className="material-symbols-outlined text-[32px]">
                                    {activeVoice === 'cloned' ? 'auto_awesome' : 'record_voice_over'}
                                </span>
                            </div>
                        ) : !imgError && avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt={activeVoice}
                                className="w-full h-full object-cover"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="w-full h-full bg-orange-500 flex items-center justify-center text-white font-black text-xl">
                                {activeVoice[0]?.toUpperCase()}
                            </div>
                        )}

                        {/* 停止图标覆盖层（Hover 显现） */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-[32px]">stop_circle</span>
                        </div>

                        {/* 说话波纹动画 [极致随机紧凑版] */}
                        <div className="absolute bottom-1 w-full flex justify-center items-end gap-[1px] px-0.5 h-7 pointer-events-none">
                            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                                const sensitivity = sensitivities[i];
                                const minHeight = 4;
                                const maxHeight = 28;

                                // 基础响应 + 动态小抖动 (用 i 分散开，避免整齐划一)
                                const dynamicJitter = 0.8 + Math.sin(Date.now() / 150 + i * 2) * 0.25;
                                const targetHeight = minHeight + Math.pow(amplitude, 0.7) * sensitivity * dynamicJitter * (maxHeight - minHeight);

                                return (
                                    <motion.div
                                        key={i}
                                        animate={{
                                            height: Math.min(maxHeight, targetHeight),
                                            opacity: 0.5 + (amplitude * 0.5)
                                        }}
                                        transition={{
                                            type: 'spring',
                                            damping: 7 + (i % 4) * 3, // 每根线条物理反馈不同，显得更“乱”一些
                                            stiffness: 450 - (i % 3) * 80,
                                            mass: 0.35
                                        }}
                                        className="w-[3.8px] bg-[#E65100] rounded-full shadow-[0_0_10px_rgba(230,81,0,0.5)]"
                                    />
                                );
                            })}
                        </div>
                    </button>

                    <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/80 backdrop-blur-md text-white text-[10px] font-black rounded-full whitespace-nowrap shadow-xl border border-white/10 pointer-events-none"
                    >
                        {`${activeVoiceName || (activeVoice === 'cloned' ? '您的专属音色' : activeVoice)} 正在${activeVoice === 'cloned' ? '朗读' : '讲述'}...`}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default SpeakingAvatarOverlay
