import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VocabularyOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    starredWords: any[];
    onWordClick: (word: any) => void;
}

export const VocabularyOverlay: React.FC<VocabularyOverlayProps> = ({
    isOpen,
    onClose,
    starredWords,
    onWordClick
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: '100%' }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed inset-0 z-50 bg-[#FDFCFB] dark:bg-[#0B0A09] flex flex-col"
                >
                    {/* Overlay Header */}
                    <div className="px-6 pt-12 pb-6 flex items-center justify-between border-b border-gray-100 dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>book</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Vocabulary</h2>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{starredWords.length} saved words</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="size-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-white/60 active:scale-90 transition-transform"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Overlay Content */}
                    <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-32">
                        {starredWords.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-white/20">
                                <span className="material-symbols-outlined text-6xl mb-4 opacity-50">book</span>
                                <p className="text-xs font-bold uppercase tracking-widest text-center">No words yet<br /><span className="text-[10px] lowercase font-medium opacity-50">Saved words will appear here</span></p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {starredWords.map((word) => (
                                    <motion.div
                                        key={word.word}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        onClick={() => onWordClick(word)}
                                        className="group glass-card-premium overflow-hidden flex flex-col transition-all duration-300 active:scale-95 shadow-sm hover:shadow-lg cursor-pointer p-4 min-h-[130px] justify-between relative bg-white dark:bg-white/[0.03]"
                                    >
                                        <div className="absolute top-2 right-2 opacity-20 group-hover:opacity-100 transition-opacity">
                                            <span className="material-symbols-outlined text-orange-500 text-[16px] fill-[1]">bookmark</span>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight capitalize mb-1">
                                                {word.word}
                                            </h3>
                                            <p className="text-[10px] font-mono text-gray-400 dark:text-white/30 uppercase tracking-tighter mb-2">
                                                {word.ipa || '/.../'}
                                            </p>
                                        </div>

                                        <div className="border-t border-gray-100 dark:border-white/5 pt-2">
                                            <p className="text-[11px] font-bold text-gray-700 dark:text-white/80 line-clamp-2 leading-relaxed">
                                                {word.definition_cn}
                                            </p>
                                            <div className="flex items-center justify-between mt-1 gap-2">
                                                {word.contexts && word.contexts.length > 0 ? (
                                                    <p className="text-[9px] text-gray-400 dark:text-white/30 line-clamp-1 italic flex-1">
                                                        "{word.contexts[0].text}"
                                                    </p>
                                                ) : (
                                                    <div className="flex-1" />
                                                )}
                                                {word.contexts && word.contexts.length > 1 && (
                                                    <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-500 text-[8px] font-black">
                                                        +{word.contexts.length - 1} MORE
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
