import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDictionaryStore } from '../store/useDictionaryStore'

interface AnalysisNotificationProps {
  onView: (word: string) => void // 点击“查看”时的回调
}

const AnalysisNotification: React.FC<AnalysisNotificationProps> = ({
  onView,
}) => {
  const { latestReadyWord, dismissNotification } = useDictionaryStore()

  // 5秒后自动消失
  useEffect(() => {
    if (latestReadyWord) {
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]) // 成功的震动反馈
      const timer = setTimeout(() => {
        dismissNotification()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [latestReadyWord, dismissNotification])

  const handleClick = () => {
    if (latestReadyWord) {
      onView(latestReadyWord)
      dismissNotification()
    }
  }

  return (
    <AnimatePresence>
      {latestReadyWord && (
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-24 left-4 right-4 z-[90] flex justify-center pointer-events-none">
          <div
            onClick={handleClick}
            className="pointer-events-auto bg-[#1C1C1E] border border-orange-500/30 rounded-full pl-2 pr-5 py-2 shadow-2xl flex items-center gap-3 cursor-pointer active:scale-95 transition-transform group">
            {/* 动态图标 */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-white text-[20px] animate-bounce-subtle">
                auto_awesome
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                AI Analysis Ready
              </span>
              <div className="flex items-center gap-1">
                <span className="text-white font-bold text-sm">
                  Click to view{' '}
                  <span className="text-orange-400">"{latestReadyWord}"</span>
                </span>
                <span className="material-symbols-outlined text-[16px] text-white/40 group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AnalysisNotification
