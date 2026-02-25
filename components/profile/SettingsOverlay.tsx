import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VOICES, getAssetPath } from '../../constants';
import { toMultiplier, toLevel } from '../../utils/ttsUtils';
import { useEffect } from 'react';
import { useUserStore } from '../../store/useUserStore';

interface SettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    logout: () => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    profile: any;
    updateProfile: (data: any) => void;
    setTtsVoice: (voiceId: string) => void;
    setTtsParams: (params: { rate?: number; pitch?: number }) => void;
    clearVoiceClone: () => void;
    speak: (text: string, id: string, voice?: string, params?: { speech_rate?: number; pitch_rate?: number; isFree?: boolean }) => void;
    setShowCloneModal: (show: boolean) => void;
}

export const SettingsOverlay: React.FC<SettingsOverlayProps> = ({
    isOpen,
    onClose,
    logout,
    theme,
    toggleTheme,
    profile,
    updateProfile,
    setTtsVoice,
    setTtsParams,
    clearVoiceClone,
    speak,
    setShowCloneModal
}) => {
    const [showVoices, setShowVoices] = useState(false);
    const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
    const [expandedSections, setExpandedSections] = useState<string[]>([]);

    const { voiceDotDismissed, dismissVoiceDot } = useUserStore();

    const toggleSection = (id: string) => {
        setExpandedSections(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const currentVoice = profile?.tts_voice || 'cherry';
    const selectedVoiceLabel = currentVoice === 'cloned'
        ? (profile?.cloned_voice_name || '自定义音色')
        : (VOICES.find(v => v.id === currentVoice)?.label || 'Cherry');

    // 影子状态：用于实现 60fps 丝滑滑动的本地状态
    const [localRateLevel, setLocalRateLevel] = useState(toLevel(profile?.tts_rate || 1.0));
    const [localPitchLevel, setLocalPitchLevel] = useState(toLevel(profile?.tts_pitch || 1.0));

    // 当外部 profile 改变时同步本地状态
    useEffect(() => {
        if (profile?.tts_rate !== undefined) setLocalRateLevel(toLevel(profile.tts_rate));
        if (profile?.tts_pitch !== undefined) setLocalPitchLevel(toLevel(profile.tts_pitch));
    }, [profile?.tts_rate, profile?.tts_pitch]);

    // 防抖同步到全局 Store
    useEffect(() => {
        const timer = setTimeout(() => {
            const targetRate = toMultiplier(localRateLevel);
            const targetPitch = toMultiplier(localPitchLevel);
            if (Math.abs(targetRate - (profile?.tts_rate || 1.0)) > 0.01 ||
                Math.abs(targetPitch - (profile?.tts_pitch || 1.0)) > 0.01) {
                setTtsParams({ rate: targetRate, pitch: targetPitch });
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [localRateLevel, localPitchLevel]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[80] bg-black/20 backdrop-blur-sm dark:bg-black/60"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="absolute top-0 right-0 bottom-0 w-72 z-[90] p-6 shadow-2xl bg-white/80 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl border-l border-white/40 dark:border-white/5 overflow-y-auto no-scrollbar"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black flex items-center gap-2">
                                <span className="material-symbols-outlined text-orange-500">settings</span>
                                Settings
                            </h2>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-3">外观设置</h3>
                                <button
                                    onClick={toggleTheme}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/5 active:scale-95 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                            <span className="material-symbols-outlined text-[18px]">
                                                {theme === 'dark' ? 'dark_mode' : 'light_mode'}
                                            </span>
                                        </div>
                                        <span className="font-bold text-sm">Dark Mode</span>
                                    </div>
                                    <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${theme === 'dark' ? 'bg-green-500' : 'bg-gray-300'}`}>
                                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </button>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-3">语音偏好设置</h3>
                                <div className={`rounded-2xl transition-all duration-500 overflow-hidden ${expandedSections.includes('modulation') ? 'bg-orange-500/5 dark:bg-orange-500/10 ring-1 ring-orange-500/20' : 'bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/5'}`}>
                                    <button
                                        onClick={() => toggleSection('modulation')}
                                        className="w-full p-4 flex items-center justify-between active:opacity-70 transition-opacity">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                                                <span className="material-symbols-outlined text-[18px]">graphic_eq</span>
                                            </div>
                                            <div className="text-left">
                                                <p className="text-[11px] font-black dark:text-white leading-none">语速 & 音调</p>
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
                                                className="px-6 pb-6 space-y-6 pt-2">
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">语速等级</span>
                                                        <div className="flex items-center gap-1.5">
                                                            {localRateLevel === 0.5 && <span className="text-[8px] font-bold text-gray-400 dark:text-white/30 uppercase opacity-50">默认值</span>}
                                                            <span className="text-orange-500 text-sm font-black">{localRateLevel.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0.1"
                                                        max="1.0"
                                                        step="0.05"
                                                        value={localRateLevel}
                                                        onChange={(e) => setLocalRateLevel(parseFloat(e.target.value))}
                                                        onPointerUp={(e) => updateProfile({ tts_rate: toMultiplier(parseFloat((e.target as HTMLInputElement).value)) })}
                                                        className="w-full accent-orange-500 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">语调等级</span>
                                                        <div className="flex items-center gap-1.5">
                                                            {localPitchLevel === 0.5 && <span className="text-[8px] font-bold text-gray-400 dark:text-white/30 uppercase opacity-50">默认值</span>}
                                                            <span className="text-orange-500 text-sm font-black">{localPitchLevel.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0.1"
                                                        max="1.0"
                                                        step="0.05"
                                                        value={localPitchLevel}
                                                        onChange={(e) => setLocalPitchLevel(parseFloat(e.target.value))}
                                                        onPointerUp={(e) => updateProfile({ tts_pitch: toMultiplier(parseFloat((e.target as HTMLInputElement).value)) })}
                                                        className="w-full accent-orange-500 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-3 flex items-center gap-1.5">
                                    音色选择
                                    {!voiceDotDismissed && (
                                        <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                                    )}
                                </h3>
                                <div className="space-y-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/5 overflow-hidden">
                                    <button
                                        onClick={() => {
                                            if (!showVoices && !voiceDotDismissed) {
                                                dismissVoiceDot();
                                            }
                                            setShowVoices(!showVoices);
                                        }}
                                        className="w-full flex items-center justify-between p-4 active:bg-black/5 dark:active:bg-white/5 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-orange-500 overflow-hidden flex items-center justify-center text-white shadow-lg shadow-orange-500/20 border-2 border-white/40 relative">
                                                {currentVoice === 'cloned' ? (
                                                    profile?.cloned_voice_avatar_url ? (
                                                        <img src={profile.cloned_voice_avatar_url} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                                                    )
                                                ) : imageErrors[currentVoice] ? (
                                                    <span className="material-symbols-outlined text-[20px]">record_voice_over</span>
                                                ) : (
                                                    <img
                                                        key={currentVoice}
                                                        src={getAssetPath(`/avatars/${currentVoice === 'Eldric Sage' ? 'Eldric' : currentVoice}.png`)}
                                                        className="w-full h-full object-cover"
                                                        onError={() => setImageErrors(prev => ({ ...prev, [currentVoice]: true }))}
                                                    />
                                                )}
                                            </div>
                                            <span className="font-bold text-sm">
                                                {selectedVoiceLabel}
                                            </span>
                                        </div>
                                        <span className={`material-symbols-outlined text-gray-400 transition-transform duration-300 ${showVoices ? 'rotate-180' : ''}`}>expand_more</span>
                                    </button>

                                    <AnimatePresence>
                                        {showVoices && (
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: 'auto' }}
                                                exit={{ height: 0 }}
                                                transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                                                style={{ overflow: 'hidden' }}
                                            >
                                                <div className="px-2 pb-4 space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                                                    {!profile?.cloned_voice_url ? (
                                                        <div
                                                            onClick={() => setShowCloneModal(true)}
                                                            className="w-full p-3 rounded-[24px] border relative flex items-center gap-4 bg-white dark:bg-[#111] border-dashed border-orange-500/30 text-gray-500 dark:text-white/40 hover:border-orange-500/50 cursor-pointer">
                                                            <div className="w-14 h-14 shrink-0 rounded-[14px] bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-500">
                                                                <span className="material-symbols-outlined">add_circle</span>
                                                            </div>
                                                            <div className="flex-1 text-left">
                                                                <span className="text-base font-black text-orange-500">生成专属音色</span>
                                                                <p className="text-[11px] font-bold opacity-60">点击立即生成你的专属音色</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            onClick={() => setTtsVoice('cloned')}
                                                            className={`w-full p-3 rounded-[24px] flex items-center gap-4 transition-all duration-300 text-left border relative group cursor-pointer ${profile.tts_voice === 'cloned'
                                                                ? 'bg-orange-500 border-orange-600 text-white shadow-lg'
                                                                : 'bg-white dark:bg-[#111] border-transparent text-gray-500 dark:text-white/40'}`}>
                                                            <div className="w-14 h-14 shrink-0 rounded-[14px] overflow-hidden bg-gray-100 dark:bg-white/5 border border-black/5 dark:border-white/10 relative">
                                                                {profile.cloned_voice_avatar_url ? (
                                                                    <img src={profile.cloned_voice_avatar_url} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="material-symbols-outlined">auto_awesome</span>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0 font-bold">
                                                                {profile.cloned_voice_name || '自定义音色'}
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (confirm('确定要删除这个专属音色吗？')) clearVoiceClone();
                                                                }}
                                                                className="absolute -right-1 -top-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                                            </button>
                                                        </div>
                                                    )}

                                                    {VOICES.map((v) => {
                                                        const isSelected = (profile?.tts_voice || 'cherry') === v.id;
                                                        const fileName = v.id === 'Eldric Sage' ? 'Eldric' : v.id;
                                                        const avatarUrl = getAssetPath(`/avatars/${fileName}.png`);
                                                        return (
                                                            <div
                                                                key={`profile-voice-${v.id}`}
                                                                onClick={() => {
                                                                    updateProfile({ tts_voice: v.id });
                                                                    const safeId = v.id.toLowerCase().replace(/\s+/g, '_');
                                                                    speak(`/scrollish/audio/samples/${safeId}_v2.wav`, `sample-${v.id}`, v.id, { isFree: true });
                                                                }}
                                                                className={`w-full p-3 rounded-[24px] flex items-center gap-4 transition-all duration-300 text-left border relative group cursor-pointer ${isSelected
                                                                    ? 'bg-orange-500 border-orange-600 text-white shadow-lg'
                                                                    : 'bg-white dark:bg-[#111] border-transparent text-gray-500 dark:text-white/40'}`}>
                                                                <div className="w-14 h-14 shrink-0 rounded-[14px] overflow-hidden bg-gray-100 dark:bg-white/5 border border-black/5 dark:border-white/10">
                                                                    {!imageErrors[v.id] ? (
                                                                        <img src={avatarUrl} className="w-full h-full object-cover" onError={() => setImageErrors(prev => ({ ...prev, [v.id]: true }))} />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center bg-orange-100 text-orange-500 font-black">{v.label[0]}</div>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-sm font-black truncate block">{v.label}</span>
                                                                    <p className="text-[10px] opacity-50">{v.desc}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-3">联系我们</h3>
                                <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 flex flex-col items-center gap-4 mb-4">
                                    <div className="w-full aspect-square max-w-[190px] bg-white dark:bg-white/10 rounded-2xl border border-orange-500/20 flex items-center justify-center p-3">
                                        <img src={getAssetPath('/support_qr.png')} className="w-full h-full object-contain" />
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        logout();
                                        onClose();
                                    }}
                                    className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-red-500 hover:text-white group shadow-sm"
                                >
                                    <span className="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform">logout</span>
                                    退出登录 (Logout)
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
