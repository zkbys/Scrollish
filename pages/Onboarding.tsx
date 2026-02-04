import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Page } from '../types'
import { IMAGES } from '../constants'
import { useUserStore } from '../store/useUserStore'

interface OnboardingProps {
    onComplete: () => void
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0) // 0-2: Vision, 3-4: Questions, 5: Success
    const [direction, setDirection] = useState(1)
    const { updateProfile } = useUserStore()

    const [selections, setSelections] = useState({
        learning_reason: '',
        target_level: ''
    })

    const visionSlides = [
        {
            title: "Read What Matters",
            description: "Dive into trending discussions from Reddit and master English through real-world content.",
            image: IMAGES.london, // Placeholder for high-quality vision image
            accent: "from-orange-500 to-red-500"
        },
        {
            title: "Understand Deeply",
            description: "Smart translations and AI-powered context analysis help you grasp every nuance.",
            image: IMAGES.avatar1,
            accent: "from-blue-500 to-indigo-600"
        },
        {
            title: "Effortless Growth",
            description: "Track your progress, earn XP, and watch your skills level up as you scroll.",
            image: IMAGES.london,
            accent: "from-emerald-500 to-teal-600"
        }
    ]

    const reasons = [
        { id: 'career', label: 'Career Growth', icon: 'work' },
        { id: 'interest', label: 'Pure Interest', icon: 'favorite' },
        { id: 'exam', label: 'Exam Prep', icon: 'school' },
        { id: 'travel', label: 'Foreign Travel', icon: 'flight' }
    ]

    const levels = [
        { id: 'beginner', label: 'Beginner', desc: 'Just starting out' },
        { id: 'intermediate', label: 'Intermediate', desc: 'Can hold a basic chat' },
        { id: 'advanced', label: 'Advanced', desc: 'Fluent and confident' },
        { id: 'native', label: 'Native/Expert', desc: 'Mastering the nuances' }
    ]

    const handleNext = () => {
        setDirection(1)
        setStep(s => s + 1)
    }

    const handleReasonSelect = (id: string) => {
        setSelections(prev => ({ ...prev, learning_reason: id }))
        setTimeout(handleNext, 300)
    }

    const handleLevelSelect = async (id: string) => {
        setSelections(prev => ({ ...prev, target_level: id }))
        setStep(5) // Show success/loading

        // Sync to Supabase
        try {
            await updateProfile({
                learning_reason: selections.learning_reason,
                target_level: id
            })
            setTimeout(onComplete, 1500)
        } catch (err) {
            console.error("Failed to sync onboarding data", err)
            onComplete()
        }
    }

    return (
        <div className="h-full w-full bg-[#0B0A09] text-white overflow-hidden relative font-sans">
            <AnimatePresence mode="wait" custom={direction}>
                {step < 3 ? (
                    // --- Phase 1: Vision Slides ---
                    <motion.div
                        key={`slide-${step}`}
                        initial={{ opacity: 0, x: direction * 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction * -100 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0 flex flex-col items-center justify-between p-10 pt-24"
                    >
                        <div className="w-full space-y-6 text-center">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-48 h-48 mx-auto rounded-[3rem] overflow-hidden shadow-2xl rotate-3 bg-gray-800"
                            >
                                <img src={visionSlides[step].image} className="w-full h-full object-cover" alt="" />
                            </motion.div>
                            <div className="space-y-3">
                                <h1 className="text-4xl font-black tracking-tighter italic">
                                    {visionSlides[step].title}
                                </h1>
                                <p className="text-white/50 text-base leading-relaxed max-w-[280px] mx-auto font-medium">
                                    {visionSlides[step].description}
                                </p>
                            </div>
                        </div>

                        <div className="w-full space-y-8">
                            <div className="flex justify-center gap-2">
                                {[0, 1, 2].map(i => (
                                    <div
                                        key={i}
                                        className={`h-1.5 transition-all duration-300 rounded-full ${i === step ? 'w-8 bg-primary' : 'w-2 bg-white/10'}`}
                                    />
                                ))}
                            </div>
                            <button
                                onClick={handleNext}
                                className={`w-full py-5 rounded-2xl bg-gradient-to-r ${visionSlides[step].accent} text-white font-black text-lg shadow-xl active:scale-95 transition-transform`}
                            >
                                {step === 2 ? "Let's Start" : "Next"}
                            </button>
                        </div>
                    </motion.div>
                ) : step === 3 ? (
                    // --- Phase 2: Reason Question ---
                    <motion.div
                        key="question-1"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute inset-0 flex flex-col p-8 pt-24 justify-between"
                    >
                        <div className="space-y-2">
                            <span className="text-primary font-black uppercase tracking-[0.2em] text-[10px]">Onboarding 01</span>
                            <h2 className="text-3xl font-black tracking-tight leading-tight">
                                Why are you learning <br /><span className="text-primary italic">English?</span>
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {reasons.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => handleReasonSelect(r.id)}
                                    className="flex items-center gap-6 p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/[0.08] transition-all group active:scale-[0.98]"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined">{r.icon}</span>
                                    </div>
                                    <span className="text-lg font-bold">{r.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="h-10" />
                    </motion.div>
                ) : step === 4 ? (
                    // --- Phase 3: Level Question ---
                    <motion.div
                        key="question-2"
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute inset-0 flex flex-col p-8 pt-24 justify-between"
                    >
                        <div className="space-y-2">
                            <span className="text-primary font-black uppercase tracking-[0.2em] text-[10px]">Onboarding 02</span>
                            <h2 className="text-3xl font-black tracking-tight leading-tight">
                                What is your current <br /><span className="text-primary italic">Level?</span>
                            </h2>
                        </div>

                        <div className="space-y-4">
                            {levels.map(l => (
                                <button
                                    key={l.id}
                                    onClick={() => handleLevelSelect(l.id)}
                                    className="w-full text-left p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/[0.08] transition-all group active:scale-[0.98]"
                                >
                                    <p className="text-lg font-black tracking-tight mb-1">{l.label}</p>
                                    <p className="text-sm text-white/40 font-medium">{l.desc}</p>
                                </button>
                            ))}
                        </div>
                        <div className="h-10" />
                    </motion.div>
                ) : (
                    // --- Success / Loading ---
                    <motion.div
                        key="success"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 flex flex-col items-center justify-center space-y-6"
                    >
                        <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black tracking-tight italic">Setting up your lab...</h3>
                            <p className="text-white/30 text-sm font-medium">Tailoring the feed to your style</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default Onboarding
