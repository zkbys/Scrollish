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
    // 容器层：固定在底部，带有一个向上的黑色渐变，确保按钮在亮色图片上也清晰可见
    <div className="fixed bottom-0 left-0 right-0 z-[60] pb-8 pt-6 px-6 pointer-events-none flex justify-center bg-gradient-to-t from-black/80 via-black/40 to-transparent">
      {/* 导航本体：深色毛玻璃胶囊 (Floating Dark Dock) */}
      <nav className="pointer-events-auto bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] px-2 py-2 flex justify-between items-center w-full max-w-[320px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {navItems.map((item) => {
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex items-center justify-center w-16 h-12 rounded-full transition-all duration-300 group ${
                isActive ? 'bg-white/10' : 'hover:bg-white/5'
              }`}>
              <div className="flex flex-col items-center gap-0.5">
                {/* 图标 */}
                <span
                  className={`material-symbols-outlined text-[24px] transition-all duration-300 ${
                    isActive
                      ? 'text-primary fill-[1] scale-110 drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]'
                      : 'text-gray-400 group-hover:text-gray-200'
                  }`}>
                  {item.icon}
                </span>

                {/* 仅在激活时显示的小圆点指示器，替代文字 */}
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
