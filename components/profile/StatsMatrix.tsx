import React from 'react';
import { motion } from 'framer-motion';
import { RoundedStar } from '../RoundedStar';

interface StatsMatrixProps {
    starredWordsCount: number;
    wordsCount: number;
    currentXP: number;
    currentStreak: number;
    userLevel: number;
    nextLevelXP: number;
    progressPercent: number;
    onVocabularyClick: () => void;
}

const STAGGER_ITEM = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 }
};

export const StatsMatrix: React.FC<StatsMatrixProps> = ({
    starredWordsCount,
    wordsCount,
    currentXP,
    currentStreak,
    userLevel,
    nextLevelXP,
    progressPercent,
    onVocabularyClick
}) => {
    return (
        <>
            {/* Stats Matrix */}
            <motion.div variants={STAGGER_ITEM} className="grid grid-cols-2 gap-[clamp(0.5rem,1.5vh,0.875rem)] p-4 max-w-lg mx-auto">
                <div
                    onClick={onVocabularyClick}
                    className="glass-card-premium p-[clamp(0.75rem,2vh,1rem)] flex items-center justify-between transition-transform active:scale-[0.98] cursor-pointer hover:bg-orange-500/5 group">
                    <div>
                        <p className="text-gray-400 dark:text-white/40 text-[clamp(8px,1.1vh,10px)] font-bold uppercase tracking-widest mb-1">Vocabulary</p>
                        <p className="text-gray-900 dark:text-white text-[clamp(18px,2.6vh,24px)] font-black group-hover:text-orange-500 transition-colors">{starredWordsCount}</p>
                    </div>
                    <div className="size-[clamp(2rem,5vh,2.5rem)] rounded-[clamp(0.6rem,1.5vh,0.8rem)] bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                        <span className="material-symbols-outlined text-[clamp(18px,2.2vh,22px)]" style={{ fontVariationSettings: "'FILL' 1" }}>book</span>
                    </div>
                </div>

                <div className="glass-card-premium p-[clamp(0.75rem,2vh,1rem)] flex items-center justify-between relative overflow-hidden group">
                    <div className="flex flex-col blur-[4px]">
                        <p className="text-gray-400 dark:text-white/40 text-[clamp(8px,1.1vh,10px)] font-bold uppercase tracking-widest mb-1">History</p>
                        <p className="text-gray-900 dark:text-white text-[clamp(18px,2.6vh,24px)] font-black">{wordsCount}</p>
                    </div>
                    <div className="size-[clamp(2rem,5vh,2.5rem)] rounded-[clamp(0.6rem,1.5vh,0.8rem)] bg-purple-500/10 flex items-center justify-center blur-[4px]">
                        <span className="material-symbols-outlined text-purple-500 text-[clamp(18px,2.2vh,22px)]" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
                    </div>
                    <div className="absolute inset-0 z-10 backdrop-blur-[15px] bg-white/10 dark:bg-black/40 flex items-center justify-center border-0">
                        <span className="material-symbols-outlined text-orange-500 text-[clamp(16px,2vh,20px)] fill-[1] drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]">lock</span>
                    </div>
                </div>

                <div className="glass-card-premium p-[clamp(0.75rem,2vh,1rem)] flex items-center justify-between relative overflow-hidden group">
                    <div className="flex flex-col blur-[4px]">
                        <p className="text-gray-400 dark:text-white/40 text-[clamp(8px,1.1vh,10px)] font-bold uppercase tracking-widest mb-1">XP</p>
                        <p className="text-gray-900 dark:text-white text-[clamp(18px,2.6vh,24px)] font-black">
                            {currentXP > 1000 ? `${(currentXP / 1000).toFixed(1)}k` : currentXP}
                        </p>
                    </div>
                    <div className="size-[clamp(2rem,5vh,2.5rem)] rounded-[clamp(0.6rem,1.5vh,0.8rem)] bg-orange-500/10 flex items-center justify-center blur-[4px]">
                        <RoundedStar className="size-[clamp(16px,2vh,20px)] text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" fill="currentColor" />
                    </div>
                    <div className="absolute inset-0 z-10 backdrop-blur-[15px] bg-white/10 dark:bg-black/40 flex items-center justify-center border-0">
                        <span className="material-symbols-outlined text-orange-500 text-[clamp(16px,2vh,20px)] fill-[1] drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]">lock</span>
                    </div>
                </div>

                <div className="glass-card-premium p-[clamp(0.75rem,2vh,1rem)] flex items-center justify-between relative overflow-hidden group">
                    <div className="flex flex-col blur-[4px]">
                        <p className="text-gray-400 dark:text-white/40 text-[clamp(8px,1.1vh,10px)] font-bold uppercase tracking-widest mb-1">Streak</p>
                        <p className="text-gray-900 dark:text-white text-[clamp(18px,2.6vh,24px)] font-black">{currentStreak}</p>
                    </div>
                    <div className="size-[clamp(2rem,5vh,2.5rem)] rounded-[clamp(0.6rem,1.5vh,0.8rem)] bg-yellow-500/10 flex items-center justify-center blur-[4px]">
                        <span className="material-symbols-outlined text-yellow-500 text-[clamp(18px,2.2vh,22px)]" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                    </div>
                    <div className="absolute inset-0 z-10 backdrop-blur-[15px] bg-white/10 dark:bg-black/40 flex items-center justify-center border-0">
                        <span className="material-symbols-outlined text-orange-500 text-[clamp(16px,2vh,20px)] fill-[1] drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]">lock</span>
                    </div>
                </div>
            </motion.div>

            {/* Level Progress */}
            <motion.div variants={STAGGER_ITEM} className="mx-[clamp(0.5rem,1.2vh,1rem)] mb-6 p-[clamp(0.75rem,2vh,1.25rem)] glass-card-premium max-w-lg md:mx-auto">
                <div className="flex justify-between items-end mb-2.5">
                    <div className="flex flex-col">
                        <p className="text-gray-900 dark:text-white text-[clamp(12px,1.6vh,14px)] font-black">Progress to Level {userLevel + 1}</p>
                        <p className="text-gray-500 dark:text-white/40 text-[clamp(9px,1.2vh,11px)] font-medium">Keep it up! {nextLevelXP - currentXP} XP to go.</p>
                    </div>
                    <p className="text-orange-600 dark:text-orange-400 text-[clamp(10px,1.4vh,12px)] font-black">{currentXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP</p>
                </div>
                <div className="h-[clamp(0.6rem,1.5vh,0.85rem)] rounded-full bg-gray-100/50 dark:bg-black/20 inner-glow overflow-hidden p-[2px] border border-white/50 dark:border-white/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 shadow-sm transition-all" style={{ width: `${progressPercent}%` }}></div>
                </div>
            </motion.div>
        </>
    );
};
