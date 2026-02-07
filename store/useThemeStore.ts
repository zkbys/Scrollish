import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  initTheme: () => void // [新增] 初始化方法
}

// 辅助函数：操作 DOM class
const updateDom = (theme: Theme) => {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark', // 默认为暗色

      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: newTheme })
        updateDom(newTheme)
      },

      setTheme: (theme) => {
        set({ theme })
        updateDom(theme)
      },

      // [新增] 强制同步 DOM，用于 App 挂载时
      initTheme: () => {
        updateDom(get().theme)
      },
    }),
    {
      name: 'scrollish-theme-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // 确保 hydration 完成后立即同步 DOM
        if (state) {
          updateDom(state.theme)
        }
      },
    },
  ),
)
