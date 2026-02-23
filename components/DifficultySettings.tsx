import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserStore } from '../store/useUserStore'
import { useTTS } from '../hooks/useTTS'
import VoiceCloneManager from './VoiceCloneManager'

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
    const [showCloneModal, setShowCloneModal] = React.useState(false)
    const profile = useUserStore((state) => state.profile)
    const setTtsVoice = useUserStore((state) => state.setTtsVoice)
    const clearVoiceClone = useUserStore((state) => state.clearVoiceClone)
    const { speak, stop: stopTTS } = useTTS()
    const currentVoice = profile?.tts_voice || 'Cherry'

    const levels = [
        {
            id: 'Original',
            label: 'Original',
            desc: '原汁原味 Reddit 评论',
        },
        {
            id: 'Mixed',
            label: 'Mixed',
            desc: '入门级：中英混排，保留核心词',
        },
        {
            id: 'Basic',
            label: 'Basic',
            desc: '基础级：词汇量 2000 以内',
        },
        {
            id: 'Intermediate',
            label: 'Intermediate',
            desc: '进阶级：英语四六级水平',
        },
        {
            id: 'Expert',
            label: 'Expert',
            desc: '精通级：雅思/母语级表达',
        },
    ]

    const voices = [
        { id: 'cherry', label: '芊悦 (Cherry)', desc: '阳光积极、亲切自然小姐姐，精通多国语言。' },
        { id: 'jennifer', label: '詹妮弗 (Jennifer)', desc: '品牌级、电影感美式女声，声音富有磁性。' },
        { id: 'ryan', label: '甜茶 (Ryan)', desc: '节奏拉满，戏感炸裂，真实与张力共舞。' },
        { id: 'pip', label: '小新 (Pip)', desc: '调皮捣蛋却充满童真的他来了，这是你记忆中的小新吗？' },
        { id: 'sunny', label: '晴儿 (Sunny)', desc: '甜到你心里的川妹子。' },
        { id: 'aiden', label: '艾登 (Aiden)', desc: '精通厨艺的美语大男孩。' },
        { id: 'katerina', label: '卡捷琳娜 (Katerina)', desc: '御姐音色，韵律回味十足。' },
        { id: 'elias', label: '墨讲师 (Elias)', desc: '博学多才的导师感，能把复杂知识讲成动人故事。' },
        { id: 'bellona', label: '燕铮莺 (Bellona)', desc: '金戈铁马入梦来，字正腔圆间尽显千面人声的江湖。' },
        { id: 'vincent', label: '田叔 (Vincent)', desc: '一口独特的沙哑烟嗓，一开口便道尽了千军万马与江湖豪情。' },
        { id: 'stella', label: '少女阿月 (Stella)', desc: '平时是甜到发腻的迷糊少女音，但在喊出“代表月亮消灭你”时，瞬间充满不容置疑的爱与正义。' },
        { id: 'roy', label: '阿杰 (Roy)', desc: '诙谐直爽的台湾哥仔。' },
        { id: 'Chelsie', label: '千雪 (Chelsie)', desc: '二次元虚拟女友。' },
        { id: 'Momo', label: '茉兔 (Momo)', desc: '撒娇搞怪，逗你开心。' },
        { id: 'Vivian', label: '十三 (Vivian)', desc: '拽拽的、可爱的小暴躁。' },
        { id: 'Moon', label: '月白 (Moon)', desc: '率性帅气的月白。' },
        { id: 'Maia', label: '四月 (Maia)', desc: '知性与温柔的碰撞。' },
        { id: 'Eldric Sage', label: '沧明子 (Eldric)', desc: '沉稳睿智的老者，沧桑如松。' },
        { id: 'Mia', label: '乖小妹 (Mia)', desc: '温顺如春水，乖巧如初雪。' },
        { id: 'Mochi', label: '沙小弥 (Mochi)', desc: '聪明伶俐的小大人，早慧如禅。' },
        { id: 'Bunny', label: '萌小姬 (Bunny)', desc: '“萌属性”爆棚的小萝卜莉。' },
        { id: 'Neil', label: '阿闻 (Neil)', desc: '字正腔圆的最专业新闻主持人。' },
        { id: 'Nini', label: '妮妮 (Nini)', desc: '糯米糍一样又软又黏的嗓音。' },
        { id: 'Ebona', label: '诡婆婆 (Ebona)', desc: '幽暗角落里的诡异低语。' },
        { id: 'Seren', label: '小婉 (Seren)', desc: '温和舒缓的声线，助眠晚安。' },
        { id: 'Ono Anna', label: '小野杏 (Ono Anna)', desc: '鬼灵精怪的青梅竹马。' },
    ]

    // 如果用户已经有克隆声音，加入到列表中 (置顶)
    const displayVoices = [
        ...(profile?.cloned_voice_url ? [{
            id: 'cloned',
            label: '自定义创造音色',
            desc: '使用你喜欢的声音朗读。'
        }] : []),
        ...voices
    ]

    return (
        <>
            <motion.div
                key="difficulty-settings-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[120]"
            />
            <motion.div
                key="difficulty-settings-modal"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 bottom-0 w-[320px] bg-[#F8F9FA] dark:bg-[#111111] z-[121] shadow-2xl flex flex-col pt-[env(safe-area-inset-top)] border-l border-gray-100 dark:border-white/5">
                <div className="p-6 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-black dark:text-white">Settings</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            Difficulty & Voice
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-white/5 rounded-full text-gray-400">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar py-6 space-y-8 px-6">
                    {/* Difficulty Section */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-black dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                            <span className="w-1 h-3 bg-orange-500 rounded-full"></span>
                            Level
                        </h4>
                        <div className="space-y-2">
                            {levels.map((level) => (
                                <button
                                    key={`level-${level.id}`}
                                    onClick={() => {
                                        setDifficulty(level.id as DifficultyLevel)
                                        if (navigator.vibrate) navigator.vibrate(50)
                                    }}
                                    className={`w-full p-5 rounded-[28px] text-left transition-all border ${difficulty === level.id
                                        ? 'bg-orange-500 border-orange-600 shadow-lg shadow-orange-500/25 ring-4 ring-orange-500/10'
                                        : 'bg-white dark:bg-white/5 border-transparent shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-white/10'
                                        }`}>
                                    <div
                                        className={`font-black text-sm mb-1 ${difficulty === level.id ? 'text-white' : 'dark:text-white'
                                            }`}>
                                        {level.label}
                                    </div>
                                    <div
                                        className={`text-[11px] leading-tight ${difficulty === level.id ? 'text-white/80' : 'text-gray-400'
                                            }`}>
                                        {level.desc}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Voice Selection Section */}
                    <div className="space-y-4 pt-4">
                        <h4 className="text-xs font-black dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-1 h-3 bg-orange-500 rounded-full"></span>
                            Voice Settings
                        </h4>
                        <div className="space-y-3">
                            {/* 克隆语音入口 */}
                            {!profile?.cloned_voice_url && (
                                <button
                                    onClick={() => setShowCloneModal(true)}
                                    className="w-full flex items-center justify-between p-5 rounded-[28px] border border-dashed border-orange-500/30 bg-orange-500/5 text-orange-600 hover:bg-orange-500/10 transition-all mb-4 group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                                            <span className="material-symbols-outlined text-xl">mic</span>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-black">克隆我的声音</div>
                                            <div className="text-[10px] opacity-70">只需 10 秒即刻解锁专属音色</div>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            )}

                            {displayVoices.map((v) => {
                                const isSelected = currentVoice === v.id
                                const isCloned = v.id === 'cloned'

                                return (
                                    <div key={`voice-wrap-${v.id}`} className="relative group">
                                        <button
                                            key={`voice-${v.id}`}
                                            onClick={() => {
                                                setTtsVoice(v.id)
                                                if (navigator.vibrate) navigator.vibrate(30)

                                                // 直接切换，不再播放开场白
                                                if (v.id === 'cloned') {
                                                    // 不再调用 speak(...)
                                                } else {
                                                    // 将本地路径作为 text 传给 speak，触发 useTTS 的本地预览逻辑
                                                    const safeId = v.id.toLowerCase().replace(/\s+/g, '_')
                                                    const localUrl = `/scrollish/audio/samples/${safeId}_v2.wav`
                                                    speak(localUrl, `sample-${v.id}`, v.id)
                                                }
                                            }}
                                            className={`w-full flex flex-col p-5 rounded-[28px] border transition-all ${isSelected
                                                ? 'bg-orange-500/10 border-orange-500 text-orange-600 shadow-sm ring-2 ring-orange-500/5'
                                                : 'bg-white dark:bg-white/5 border-transparent text-gray-500 shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-white/10'
                                                }`}>
                                            <div className="flex items-center justify-between mb-1" >
                                                <span className={`text-sm font-black ${isSelected ? 'text-orange-600' : 'dark:text-white'}`}>{v.label}</span>
                                                {isSelected && (
                                                    <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-[10px] text-white">check</span>
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`text-[11px] leading-relaxed text-left ${isSelected ? 'text-orange-600/80' : 'text-gray-400'}`}>
                                                {v.desc}
                                            </span>
                                        </button>

                                        {isCloned && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('确定要删除克隆的声音吗？该操作不可撤销。')) {
                                                        clearVoiceClone();
                                                    }
                                                }}
                                                className="absolute top-4 right-10 p-2 text-gray-400 hover:text-red-500 transition-colors"
                                                title="删除克隆"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="p-6 shrink-0 bg-[#F1F3F5] dark:bg-black/40">
                    <div className="p-4 bg-white dark:bg-white/5 rounded-[24px] border border-gray-100 dark:border-white/5 shadow-sm">
                        <p className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400 font-medium text-center">
                            💡 Tips: Voices are powered by Qwen3-TTS Flash for instant learning.
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* 语音克隆 Modal */}
            <AnimatePresence>
                {showCloneModal && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
                        <VoiceCloneManager
                            onClose={() => setShowCloneModal(false)}
                            onSuccess={() => {
                                setShowCloneModal(false)
                                // 刷新 profile 以获取最新的声音设置
                            }}
                        />
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}

export default DifficultySettings
