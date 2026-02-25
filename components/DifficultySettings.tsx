import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserStore } from '../store/useUserStore'
import { useTTS } from '../hooks/useTTS'
import { supabase } from '../supabase'
import VoiceCloneManager from './VoiceCloneManager'
import { toMultiplier, toLevel } from '../utils/ttsUtils'
import { VOICES, getAssetPath } from '../constants'

export type DifficultyLevel =
    | 'Original'
    | 'Mixed'
    | 'Basic'
    | 'Intermediate'
    | 'Expert'

interface DifficultySettingsProps {
    difficulty: DifficultyLevel
    setDifficulty: (level: DifficultyLevel) => void
    onClose: () => void
}

const DifficultySettings: React.FC<DifficultySettingsProps> = ({
    difficulty,
    setDifficulty,
    onClose,
}) => {
    const [showCloneModal, setShowCloneModal] = useState(false)
    const [expandedSections, setExpandedSections] = useState<string[]>([])
    const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

    const profile = useUserStore((state) => state.profile)

    // 影子状态：本地即时反馈，现在存储的是 Level
    const [localRateLevel, setLocalRateLevel] = useState(toLevel(profile?.tts_rate || 1.0))
    const [localPitchLevel, setLocalPitchLevel] = useState(toLevel(profile?.tts_pitch || 1.0))

    const setTtsVoice = useUserStore((state) => state.setTtsVoice)
    const setTtsParams = useUserStore((state) => state.setTtsParams)
    const updateProfile = useUserStore((state) => state.updateProfile)
    const clearVoiceClone = useUserStore((state) => state.clearVoiceClone)
    const { speak } = useTTS()

    // 监听外部配置变化
    React.useEffect(() => {
        if (profile?.tts_rate !== undefined) setLocalRateLevel(toLevel(profile.tts_rate))
        if (profile?.tts_pitch !== undefined) setLocalPitchLevel(toLevel(profile.tts_pitch))
    }, [profile?.tts_rate, profile?.tts_pitch])

    // 防抖同步：将本地改动批量推送到 Store
    React.useEffect(() => {
        const timer = setTimeout(() => {
            const targetRate = toMultiplier(localRateLevel)
            const targetPitch = toMultiplier(localPitchLevel)
            if (Math.abs(targetRate - (profile?.tts_rate || 1.0)) > 0.01 ||
                Math.abs(targetPitch - (profile?.tts_pitch || 1.0)) > 0.01) {
                setTtsParams({ rate: targetRate, pitch: targetPitch })
            }
        }, 100)
        return () => clearTimeout(timer)
    }, [localRateLevel, localPitchLevel])
    const currentVoice = profile?.tts_voice || 'Cherry'

    const toggleSection = (id: string) => {
        setExpandedSections(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        )
    }


    const levels = [
        { id: 'Original', label: 'Original', desc: '原汁原味内容' },
        { id: 'Mixed', label: 'Mixed', desc: '核心词中英混排' },
        { id: 'Basic', label: 'Basic', desc: '基础 2000 词' },
        { id: 'Intermediate', label: 'Intermediate', desc: '进阶四六级' },
        { id: 'Expert', label: 'Expert', desc: '母语级表达' },
    ]


    const selectedLevelLabel = levels.find(l => l.id === difficulty)?.label || difficulty
    const selectedVoiceLabel = [...VOICES, { id: 'cloned', label: profile?.cloned_voice_name || '自定义' }].find(v => v.id === currentVoice)?.label || currentVoice

    return (
        <>
            {/* 遮罩层 - 使用更深的模糊 */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/40 backdrop-blur-xl z-[120]"
            />

            {/* 侧边面板 */}
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-2 right-2 bottom-2 w-[320px] bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-3xl z-[121] shadow-2xl flex flex-col rounded-[40px] border border-white/20 dark:border-white/5 overflow-hidden ring-1 ring-black/5">

                {/* 顶部状态栏风格标题 */}
                <div className="px-8 pt-10 pb-6 flex justify-between items-center shrink-0">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                            <h3 className="text-[22px] font-black tracking-tight dark:text-white">Settings</h3>
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Customize your experience</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-white/5 rounded-full text-gray-400 active:scale-90 transition-transform">
                        <span className="material-symbols-outlined text-[24px]">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
                    <div className="px-6 space-y-4 pb-24">


                        {/* 2. Audio Persona */}
                        <div className={`rounded-[32px] transition-all duration-500 overflow-hidden ${expandedSections.includes('voice') ? 'bg-gray-50/80 dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/5' : 'bg-transparent border border-gray-100 dark:border-white/5'}`}>
                            <button
                                onClick={() => toggleSection('voice')}
                                className="w-full p-6 flex items-center justify-between active:opacity-70 transition-opacity">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-[20px] bg-orange-500 overflow-hidden flex items-center justify-center text-white shadow-xl shadow-orange-500/30 border-2 border-white/40 relative">
                                        {currentVoice === 'cloned' ? (
                                            profile?.cloned_voice_avatar_url ? (
                                                <img src={profile.cloned_voice_avatar_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="material-symbols-outlined text-[32px]">auto_awesome</span>
                                            )
                                        ) : imageErrors[currentVoice] ? (
                                            <span className="material-symbols-outlined text-[32px]">record_voice_over</span>
                                        ) : (
                                            <img
                                                src={getAssetPath(`/avatars/${currentVoice === 'Eldric Sage' ? 'Eldric' : currentVoice}.png`)}
                                                alt={selectedVoiceLabel}
                                                className="w-full h-full object-cover"
                                                onError={() => setImageErrors(prev => ({ ...prev, [currentVoice]: true }))}
                                            />
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <h4 className="text-[13px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">音色</h4>
                                        <p className="text-[18px] font-black dark:text-white leading-none">{selectedVoiceLabel}</p>
                                    </div>
                                </div>
                                <span className={`material-symbols-outlined text-gray-300 transition-transform duration-500 ${expandedSections.includes('voice') ? 'rotate-180' : ''}`}>expand_more</span>
                            </button>

                            <AnimatePresence>
                                {expandedSections.includes('voice') && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="px-4 pb-6 space-y-3">

                                        {/* 专属音色卡片 - 统一格式 */}
                                        <div className="relative group">
                                            {!profile?.cloned_voice_url ? (
                                                <div
                                                    onClick={() => setShowCloneModal(true)}
                                                    role="button"
                                                    tabIndex={0}
                                                    className={`w-full p-3 rounded-[24px] transition-all duration-300 border relative flex items-center gap-4 bg-white dark:bg-[#111] border-dashed border-orange-500/30 text-gray-500 dark:text-white/40 hover:border-orange-500/50 cursor-pointer`}>
                                                    <div className="w-14 h-14 shrink-0 rounded-[14px] bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-500 shadow-sm border border-orange-500/10">
                                                        <span className="material-symbols-outlined">add_circle</span>
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-base font-black text-orange-500">生成专属音色</span>
                                                            <span className="material-symbols-outlined text-[16px] animate-pulse">mic_external_on</span>
                                                        </div>
                                                        <p className="text-[11px] font-bold opacity-60">点击立即生成你的专属音色</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={() => setTtsVoice('cloned')}
                                                    className={`w-full p-3 rounded-[24px] transition-all duration-300 border relative flex items-center gap-4 cursor-pointer group ${currentVoice === 'cloned'
                                                        ? 'bg-orange-500 border-orange-600 text-white shadow-lg'
                                                        : 'bg-white dark:bg-[#111] border-transparent text-gray-500 dark:text-white/40 hover:border-gray-200'
                                                        }`}>

                                                    {/* 展示头像 */}
                                                    <div className={`w-14 h-14 shrink-0 rounded-[14px] overflow-hidden bg-gray-100 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-sm relative ${currentVoice === 'cloned' ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-orange-500' : ''}`}>
                                                        {profile?.cloned_voice_avatar_url ? (
                                                            <img
                                                                src={profile.cloned_voice_avatar_url}
                                                                className="w-full h-full object-cover"
                                                                style={{ borderRadius: 'inherit' }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-orange-100 dark:bg-orange-500/20 text-orange-500">
                                                                <span className="material-symbols-outlined">auto_awesome</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-base font-black truncate">
                                                                {profile?.cloned_voice_name || '自定义音色'}
                                                            </span>
                                                            {currentVoice === 'cloned' && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                                                        </div>

                                                        <p className={`text-[11px] mt-1 line-clamp-2 font-bold ${currentVoice === 'cloned' ? 'opacity-90' : 'opacity-50'}`}>
                                                            {profile?.cloned_voice_desc || '你的专属 AI 声线'}
                                                        </p>
                                                    </div>

                                                    {/* 删除按钮 */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (confirm('确定要删除这个专属音色吗？重新修改也需要重新录制。')) clearVoiceClone()
                                                        }}
                                                        className="absolute -right-1 -top-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-20"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                                            {VOICES.map((v) => {
                                                const isSelected = currentVoice === v.id
                                                // 映射文件名，处理 Eldric Sage 等特殊情况
                                                const fileName = v.id === 'Eldric Sage' ? 'Eldric' : v.id
                                                const avatarUrl = getAssetPath(`/avatars/${fileName}.png`)

                                                return (
                                                    <div
                                                        key={`voice-${v.id}`}
                                                        onClick={() => {
                                                            setTtsVoice(v.id)
                                                            if (navigator.vibrate) navigator.vibrate(15)
                                                            const safeId = v.id.toLowerCase().replace(/\s+/g, '_')
                                                            speak(`/scrollish/audio/samples/${safeId}_v2.wav`, `sample-${v.id}`, v.id)
                                                        }}
                                                        role="button"
                                                        tabIndex={0}
                                                        className={`w-full p-3 rounded-[24px] transition-all duration-300 text-left border relative group flex items-center gap-4 cursor-pointer ${isSelected
                                                            ? 'bg-orange-500 border-orange-600 text-white shadow-lg'
                                                            : 'bg-white dark:bg-[#111] border-transparent text-gray-500 dark:text-white/40 hover:border-gray-200'
                                                            }`}>
                                                        {/* 头像 - 微信圆角正方形风格 */}
                                                        <div className="w-14 h-14 shrink-0 rounded-[14px] overflow-hidden bg-gray-100 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-sm relative">
                                                            {!imageErrors[v.id] ? (
                                                                <img
                                                                    src={avatarUrl}
                                                                    alt={v.label}
                                                                    className="w-full h-full object-cover"
                                                                    style={{ borderRadius: 'inherit' }}
                                                                    onError={() => setImageErrors(prev => ({ ...prev, [v.id]: true }))}
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-orange-100 text-orange-500 font-black text-xl">
                                                                    {v.label[0]}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-base font-black truncate">{v.label}</span>
                                                                {isSelected && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                                                            </div>
                                                            <p className={`text-[11px] mt-1 line-clamp-2 font-bold ${isSelected ? 'opacity-90' : 'opacity-50'}`}>{v.desc}</p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* 3. Audio Effects */}
                        <div className={`rounded-[32px] transition-all duration-500 overflow-hidden ${expandedSections.includes('modulation') ? 'bg-gray-50/80 dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/5' : 'bg-transparent border border-gray-100 dark:border-white/5'}`}>
                            <button
                                onClick={() => toggleSection('modulation')}
                                className="w-full p-6 flex items-center justify-between active:opacity-70 transition-opacity">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                                        <span className="material-symbols-outlined text-[20px]">graphic_eq</span>
                                    </div>
                                    <div className="text-left">
                                        <h4 className="text-[13px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">语音调整</h4>
                                        <p className="text-[10px] font-black dark:text-white leading-none">语速 & 音调</p>
                                    </div>
                                </div>
                                <span className={`material-symbols-outlined text-gray-300 transition-transform duration-500 ${expandedSections.includes('modulation') ? 'rotate-180' : ''}`}>expand_more</span>
                            </button>

                            <AnimatePresence>
                                {expandedSections.includes('modulation') && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="px-8 pb-10 space-y-10 pt-4">

                                        {/* Speed Slider */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">语速等级</span>
                                                <div className="flex items-center gap-1.5">
                                                    {localRateLevel === 0.5 && <span className="text-[8px] font-bold text-gray-400 dark:text-white/30 uppercase opacity-50">默认值</span>}
                                                    <span className="text-orange-500 text-sm font-black">{localRateLevel.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <input
                                                type="range" min="0.1" max="1.0" step="0.05"
                                                value={localRateLevel}
                                                onChange={(e) => setLocalRateLevel(parseFloat(e.target.value))}
                                                onPointerUp={(e) => updateProfile({ tts_rate: toMultiplier(parseFloat((e.target as HTMLInputElement).value)) })}
                                                className="w-full h-1.5 appearance-none bg-gray-200 dark:bg-white/10 rounded-full accent-orange-500 cursor-pointer"
                                            />
                                        </div>

                                        {/* Pitch Slider */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">语调等级</span>
                                                <div className="flex items-center gap-1.5">
                                                    {localPitchLevel === 0.5 && <span className="text-[8px] font-bold text-gray-400 dark:text-white/30 uppercase opacity-50">默认值</span>}
                                                    <span className="text-orange-500 text-sm font-black">{localPitchLevel.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <input
                                                type="range" min="0.1" max="1.0" step="0.05"
                                                value={localPitchLevel}
                                                onChange={(e) => setLocalPitchLevel(parseFloat(e.target.value))}
                                                onPointerUp={(e) => updateProfile({ tts_pitch: toMultiplier(parseFloat((e.target as HTMLInputElement).value)) })}
                                                className="w-full h-1.5 appearance-none bg-gray-200 dark:bg-white/10 rounded-full accent-orange-500 cursor-pointer"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* 3. Level Selection */}
                        <div className={`rounded-[32px] transition-all duration-500 overflow-hidden ${expandedSections.includes('level') ? 'bg-gray-50/80 dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/5' : 'bg-transparent border border-gray-100 dark:border-white/5'}`}>
                            <button
                                onClick={() => toggleSection('level')}
                                className="w-full p-6 flex items-center justify-between active:opacity-70 transition-opacity">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                                        <span className="material-symbols-outlined text-[20px]">sort</span>
                                    </div>
                                    <div className="text-left">
                                        <h4 className="text-[13px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">调节难度等级</h4>
                                        <p className="text-[13px] font-black dark:text-white leading-none">{selectedLevelLabel}</p>
                                    </div>
                                </div>
                                <span className={`material-symbols-outlined text-gray-300 transition-transform duration-500 ${expandedSections.includes('level') ? 'rotate-180' : ''}`}>expand_more</span>
                            </button>

                            <AnimatePresence>
                                {expandedSections.includes('level') && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="px-4 pb-6 space-y-2">
                                        {levels.map((level) => {
                                            const isSelected = difficulty === level.id
                                            return (
                                                <button
                                                    key={`level-${level.id}`}
                                                    onClick={() => {
                                                        setDifficulty(level.id as DifficultyLevel)
                                                        if (navigator.vibrate) navigator.vibrate(20)
                                                    }}
                                                    className={`w-full p-4 rounded-2xl text-left transition-all duration-300 relative overflow-hidden group ${isSelected
                                                        ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/10'
                                                        : 'bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 text-gray-500 dark:text-white/40 hover:scale-[1.02]'
                                                        }`}>
                                                    <div className="relative z-10 flex items-center justify-between">
                                                        <div>
                                                            <p className="font-black text-xs uppercase">{level.label}</p>
                                                            <p className={`text-[10px] font-bold ${isSelected ? 'opacity-80' : 'opacity-50'}`}>{level.desc}</p>
                                                        </div>
                                                        {isSelected && <span className="material-symbols-outlined text-[16px]">check_circle</span>}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* 底部信息 */}
                <div className="p-8 pb-10 flex flex-col items-center gap-4 bg-gray-50/50 dark:bg-black p-5 border-t border-gray-100 dark:border-white/5">
                    <p className="text-[9px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-[0.3em]">
                        Voices by Qwen AI
                    </p>
                </div>
            </motion.div>

            {/* Voice Cloning Modal */}
            <AnimatePresence>
                {showCloneModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-2xl">
                        <VoiceCloneManager
                            onClose={() => setShowCloneModal(false)}
                            onSuccess={() => setShowCloneModal(false)}
                        />
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}

export default DifficultySettings
