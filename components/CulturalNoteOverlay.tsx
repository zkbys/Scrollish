import React from 'react'
import { motion } from 'framer-motion'
import { CulturalNote } from '../types'

interface CulturalNoteOverlayProps {
    notes: CulturalNote[]
    onClose: () => void
}

const CulturalNoteOverlay: React.FC<CulturalNoteOverlayProps> = ({
    notes,
    onClose,
}) => {
    return (
        <div className="fixed inset-0 z-[110] flex items-end justify-center px-4 pb-10">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="relative w-full max-w-lg bg-white dark:bg-[#1C1C1E] rounded-[2.5rem] p-8 shadow-2xl border border-white/20 overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-black text-orange-500 flex items-center gap-2">
                            <span className="material-symbols-outlined">lightbulb</span>
                            Cultural Insights
                        </h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                            Slang & Context Notes
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-white/5 rounded-full text-gray-400">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="space-y-6 max-h-[50vh] overflow-y-auto no-scrollbar pb-4">
                    {notes.map((note, idx) => (
                        <div key={idx} className="group">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 rounded-md text-xs font-black uppercase">
                                    {note.trigger_word}
                                </span>
                                <div className="h-[1px] flex-1 bg-gray-100 dark:bg-white/5" />
                            </div>
                            <p className="text-[14px] leading-relaxed text-gray-700 dark:text-gray-300 font-medium">
                                {note.explanation}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-white/5">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-transform">
                        Got it
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

export default CulturalNoteOverlay
