import React, { useEffect, useState } from 'react'
import { useDictionaryStore } from '../store/useDictionaryStore'
import { DictionaryEntry } from '../types'

interface WordDetailSheetProps {
    word: string | null
    isVip: boolean
    onClose: () => void
}

/**
 * WordDetailSheet Component
 * Bottom sheet that displays word definitions
 */
const WordDetailSheet: React.FC<WordDetailSheetProps> = ({ word, isVip, onClose }) => {
    const { getWordEntry } = useDictionaryStore()
    const [entry, setEntry] = useState<DictionaryEntry | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!word) {
            setEntry(null)
            return
        }

        const fetchEntry = async () => {
            setIsLoading(true)
            try {
                if (isVip) {
                    const result = await getWordEntry(word.toLowerCase())
                    setEntry(result)
                } else {
                    // For non-VIP words, we'll show a placeholder for now
                    // In the future, this could call a generic dictionary API
                    setEntry(null)
                }
            } catch (error) {
                console.error('Failed to fetch word entry:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchEntry()
    }, [word, isVip, getWordEntry])

    if (!word) return null

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-end animate-in fade-in duration-200"
            onClick={onClose}>
            <div
                className="w-full bg-gradient-to-b from-[#1A1A1A] to-[#0B0A09] rounded-t-[2.5rem] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300 border-t border-white/10 max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            {isVip && (
                                <span className="bg-orange-500/10 text-orange-500 text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-widest">
                                    📚 In Your Book
                                </span>
                            )}
                        </div>
                        <h3 className="text-3xl font-black text-white capitalize tracking-tight">
                            {word}
                        </h3>
                        {entry?.detail?.phonetic && (
                            <span className="text-orange-400/70 text-sm font-mono">
                                /{entry.detail.phonetic}/
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/40 bg-white/5 p-2 rounded-full hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                        <p className="text-orange-500/50 text-[10px] font-black tracking-widest uppercase animate-pulse">
                            Loading Definition...
                        </p>
                    </div>
                ) : entry ? (
                    <div className="space-y-6">
                        {/* Definition */}
                        {entry.definition && (
                            <div className="space-y-2">
                                <h4 className="text-white/50 text-xs font-black uppercase tracking-wider">
                                    Definition
                                </h4>
                                <p className="text-gray-200 leading-relaxed text-base font-medium">
                                    {entry.definition}
                                </p>
                            </div>
                        )}

                        {/* Examples / Phrases */}
                        {(entry.detail?.examples || (entry.detail as any)?.phrases) && (
                            <div className="space-y-3">
                                <h4 className="text-white/50 text-xs font-black uppercase tracking-wider">
                                    {entry.detail?.examples ? 'Examples' : 'Common Phrases'}
                                </h4>
                                <div className="space-y-3">
                                    {(entry.detail?.examples || (entry.detail as any)?.phrases).slice(0, 5).map((item: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
                                            <p className="text-gray-200 text-sm leading-relaxed">
                                                {item.en || item.phrase}
                                            </p>
                                            <p className="text-white/40 text-xs italic">
                                                {item.zh || item.translation}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => {
                                    // TODO: Implement save to review list
                                    alert(`"${word}" saved to your review list!`)
                                }}
                                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined">bookmark_add</span>
                                Save Word
                            </button>
                            <button
                                onClick={() => {
                                    // Text-to-speech
                                    if ('speechSynthesis' in window && word) {
                                        const utterance = new SpeechSynthesisUtterance(word)
                                        utterance.lang = 'en-US'
                                        utterance.rate = 0.8
                                        window.speechSynthesis.speak(utterance)
                                    }
                                }}
                                className="px-6 bg-white/10 text-white font-bold py-4 rounded-2xl border border-white/10 active:scale-95 transition-transform hover:bg-white/15">
                                <span className="material-symbols-outlined">volume_up</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 py-8">
                        <div className="flex items-center justify-center">
                            <span className="material-symbols-outlined text-white/20 text-6xl">
                                search
                            </span>
                        </div>
                        <p className="text-center text-white/40 text-sm">
                            {isVip
                                ? 'Definition not found in your dictionary.'
                                : 'Generic dictionary lookup coming soon...'}
                        </p>
                        <p className="text-center text-white/20 text-xs">
                            Word: <span className="font-mono text-orange-400/50">{word}</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default WordDetailSheet
