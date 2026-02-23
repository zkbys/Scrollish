import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ImagePreviewOverlayProps {
    isOpen: boolean
    imageUrl: string
    scale: number
    offset: { x: number; y: number }
    isGesturing: boolean
    onClose: () => void
    onScaleChange: (scale: number) => void
    onOffsetChange: (offset: { x: number; y: number }) => void
    onIsGesturingChange: (isGesturing: boolean) => void
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: () => void
}

const ImagePreviewOverlay: React.FC<ImagePreviewOverlayProps> = ({
    isOpen,
    imageUrl,
    scale,
    offset,
    isGesturing,
    onClose,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => {
                        if (scale === 1) onClose()
                    }}
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 overflow-hidden">
                    <motion.img
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{
                            scale: scale,
                            x: offset.x,
                            y: offset.y,
                            opacity: 1,
                        }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={
                            isGesturing
                                ? { type: 'tween', duration: 0 }
                                : { type: 'spring', damping: 25, stiffness: 300 }
                        }
                        src={imageUrl}
                        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                        style={{ touchAction: 'none' }}
                        alt="Full Preview"
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                    />
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onClose()
                        }}
                        className="absolute top-10 right-10 text-white/50 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-4xl">close</span>
                    </button>
                    {scale > 1 && (
                        <div className="absolute bottom-10 px-4 py-2 bg-white/10 backdrop-blur rounded-full text-white/60 text-[10px] font-bold uppercase tracking-widest">
                            {scale.toFixed(1)}x Zoom
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default ImagePreviewOverlay
