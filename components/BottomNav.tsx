import React from 'react'
import { Page } from '../types'

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

  return (
    // 容器渐变：亮色用白渐变，暗色用黑渐变，确保遮挡下方内容
    <div className="fixed bottom-0 left-0 right-0 z-[60] pb-8 pt-6 px-6 pointer-events-none flex justify-center bg-gradient-to-t from-white/90 via-white/50 to-transparent dark:from-black/80 dark:via-black/40 dark:to-transparent transition-colors duration-300">
      {/* 导航本体：亮色白底，暗色黑底 */}
      <nav className="pointer-events-auto bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2.5rem] px-2 py-2 flex justify-between items-center w-full max-w-[320px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300">
        {navItems.map((item) => {
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex items-center justify-center w-16 h-12 rounded-full transition-all duration-300 group ${
                isActive
                  ? 'bg-gray-100 dark:bg-white/10'
                  : 'hover:bg-gray-50 dark:hover:bg-white/5'
              }`}>
              <div className="flex flex-col items-center gap-0.5">
                {/* 图标颜色适配 */}
                <span
                  className={`material-symbols-outlined text-[24px] transition-all duration-300 ${
                    isActive
                      ? 'text-primary fill-[1] scale-110 drop-shadow-sm'
                      : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                  }`}>
                  {item.icon}
                </span>

                {/* 指示点 */}
                <div
                  className={`w-1 h-1 rounded-full bg-primary transition-all duration-300 ${isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
                />
              </div>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default BottomNav
