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
  const [showSolidBg, setShowSolidBg] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)

  const currentIndex = navItems.findIndex(item => item.id === activePage)

  const CONTAINER_WIDTH = 320
  const ITEM_WIDTH = (CONTAINER_WIDTH - 16) / navItems.length

  // 判定是否处于浅色背景页面
  const isLightPage = activePage === Page.Explore || activePage === Page.Study

  const handlePointerDown = () => {
    // 开启 0.3s 计时
    longPressTimer.current = setTimeout(() => {
      setShowSolidBg(true)
    }, 300)
  }

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    setShowSolidBg(false)
  }

  const handlePan = (_e: any, info: PanInfo) => {
    if (!navRef.current) return

    const rect = navRef.current.getBoundingClientRect()
    // 计算手指在导航栏内的相对坐标
    const relativeX = info.point.x - rect.left - 8

    // 限制在容器内
    const clampedX = Math.max(0, Math.min(CONTAINER_WIDTH - 16, relativeX))

    // “指哪打哪”：根据坐标换算索引
    const index = Math.floor(clampedX / ITEM_WIDTH)
    const safeIndex = Math.max(0, Math.min(navItems.length - 1, index))

    if (safeIndex !== currentIndex) {
      onNavigate(navItems[safeIndex].id)
    }
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] pt-6 px-6 pointer-events-none flex justify-center transition-all duration-300 select-none"
      style={{ paddingBottom: 'calc(max(0.5rem, env(safe-area-inset-bottom)) + clamp(0rem, 1vh, 0.5rem))' }}
    >
      <motion.nav
        ref={navRef}
        onPan={handlePan}
        animate={{
          // 恢复为之前的玻璃磨砂质感
          backgroundColor: showSolidBg
            ? 'rgba(255, 85, 0, 0.15)'
            : 'rgba(255, 255, 255, 0)',
          borderColor: showSolidBg
            ? 'rgba(255, 85, 0, 0.3)'
            : 'rgba(255, 255, 255, 0)',
          backdropFilter: showSolidBg ? 'blur(16px)' : 'blur(0px)',
          boxShadow: showSolidBg
            ? '0 8px 32px 0 rgba(255, 85, 0, 0.2)'
            : '0 0px 0px rgba(0,0,0,0)',
          scale: showSolidBg ? 1.02 : 1,
          translateY: showSolidBg ? 2 : 0,
        }}
        style={{ width: CONTAINER_WIDTH, touchAction: 'none' }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="pointer-events-auto border rounded-[clamp(1.5rem,4vh,2.5rem)] px-1.5 py-1.5 flex justify-start items-center overflow-visible relative cursor-grab active:cursor-grabbing"
      >
        {navItems.map((item) => {
          const isActive = activePage === item.id

          // 图标颜色适配 (恢复之前的逻辑)
          let iconColor = 'rgba(255, 255, 255, 0.6)'
          if (isActive) {
            iconColor = isLightPage ? '#1A1A1A' : '#FFFFFF'
          } else if (isLightPage) {
            iconColor = showSolidBg ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.25)'
          } else if (showSolidBg) {
            iconColor = 'rgba(255, 255, 255, 0.8)'
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="relative flex items-center justify-center w-1/4 h-[clamp(2.4rem,6vh,2.75rem)] rounded-full outline-none z-20"
            >
              <div className="flex flex-col items-center gap-0.5 pointer-events-none relative">
                <motion.span
                  animate={{
                    color: iconColor,
                    scale: isActive ? 1.15 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30, duration: 0.1 }}
                  className={`material-symbols-outlined text-[clamp(22px,3vh,26px)] ${isActive ? 'fill-[1]' : ''}`}>
                  {item.icon}
                </motion.span>

                {/* 瞬间出现的指示点 - 放在图标容器内部底部 */}
                {isActive && !showSolidBg && (
                  <div
                    className="absolute -bottom-[clamp(0.4rem,1vh,0.5rem)] w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(255,45,85,0.4)]"
                  />
                )}
              </div>
            </button>
          )
        })}
      </motion.nav>
    </div>
  )
}

export default BottomNav
