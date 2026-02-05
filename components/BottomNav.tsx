import React, { useState, useRef } from 'react'
import { motion, PanInfo } from 'framer-motion'
import { Page } from '../types'
import { SPRING_SNAPPY } from '../motion'

interface BottomNavProps {
  activePage: Page
  onNavigate: (page: Page) => void
}

const BottomNav: React.FC<BottomNavProps> = ({ activePage, onNavigate }) => {
  const navItems = [
    { id: Page.Home, label: 'Feed', icon: 'home' },
    { id: Page.Explore, label: 'Discover', icon: 'explore' },
    { id: Page.Study, label: 'Study', icon: 'school' },
    { id: Page.Profile, label: 'Me', icon: 'person' },
  ]

  const [isHovered, setIsHovered] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const currentIndex = navItems.findIndex(item => item.id === activePage)

  const CONTAINER_WIDTH = 320
  const ITEM_WIDTH = (CONTAINER_WIDTH - 16) / navItems.length

  // 判定是否处于浅色背景页面
  const isLightPage = activePage === Page.Explore || activePage === Page.Study

  const handlePan = (_e: any, info: PanInfo) => {
    if (!navRef.current) return

    const rect = navRef.current.getBoundingClientRect()
    // 计算手指在导航栏内的绝对 X 坐标 (减去 left 和 padding)
    const relativeX = info.point.x - rect.left - 8

    // “指哪打哪”：直接根据坐标换算索引
    const index = Math.floor(relativeX / ITEM_WIDTH)
    const safeIndex = Math.max(0, Math.min(navItems.length - 1, index))

    if (safeIndex !== currentIndex) {
      onNavigate(navItems[safeIndex].id)
    }
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] pb-8 pt-6 px-6 pointer-events-none flex justify-center transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
    >
      <motion.nav
        ref={navRef}
        onPan={handlePan}
        animate={{
          backgroundColor: isHovered
            ? (isLightPage ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.15)')
            : 'rgba(255, 255, 255, 0)',
          borderColor: isHovered
            ? (isLightPage ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)')
            : 'rgba(255, 255, 255, 0)',
          backdropFilter: isHovered ? 'blur(25px)' : 'blur(0px)',
          boxShadow: isHovered
            ? (isLightPage ? '0 10px 40px rgba(0,0,0,0.05)' : '0 10px 40px rgba(0,0,0,0.3)')
            : '0 0px 0px rgba(0,0,0,0)',
        }}
        style={{ width: CONTAINER_WIDTH, touchAction: 'none' }}
        transition={SPRING_SNAPPY}
        className="pointer-events-auto border rounded-[2.5rem] px-2 py-2 flex justify-start items-center transition-all duration-300 overflow-visible relative cursor-grab active:cursor-grabbing"
      >
        {/* 透明背景滑块 (Pill) - 现在它是隐形的，仅用于物理动效参考 */}
        <motion.div
          animate={{
            x: currentIndex * ITEM_WIDTH,
            opacity: 0, // 隐身，但保留在 DOM 中
          }}
          transition={SPRING_SNAPPY}
          className="absolute h-11 w-[calc(25%-4px)] rounded-full z-10 pointer-events-none"
        />

        {navItems.map((item) => {
          const isActive = activePage === item.id

          let iconColor = 'rgba(255, 255, 255, 0.6)'
          if (isActive) {
            iconColor = isLightPage ? '#1A1A1A' : '#FFFFFF'
          } else if (isLightPage) {
            iconColor = isHovered ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.25)'
          } else if (isHovered) {
            iconColor = 'rgba(255, 255, 255, 0.8)'
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="relative flex items-center justify-center w-1/4 h-11 rounded-full outline-none z-20"
            >
              <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                <motion.span
                  animate={{
                    color: iconColor,
                    scale: isActive ? 1.15 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30, duration: 0.1 }}
                  style={{ y: 0 }}
                  className={`material-symbols-outlined text-[26px] ${isActive ? 'fill-[1]' : ''
                    }`}>
                  {item.icon}
                </motion.span>

                <motion.div
                  animate={{
                    scale: isActive ? 1 : 0,
                    opacity: isActive ? 1 : 0,
                  }}
                  transition={{ duration: 0.1 }}
                  style={{ y: 0 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(255,45,85,0.4)]"
                />
              </div>
            </button>
          )
        })}
      </motion.nav>
    </div>
  )
}

export default BottomNav
