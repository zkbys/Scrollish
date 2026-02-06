import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light', // 默认为暗色，符合现有风格

      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: newTheme })
        updateDom(newTheme)
      },

      setTheme: (theme) => {
        set({ theme })
        updateDom(theme)
      },
    }),
    {
      name: 'scrollish-theme-storage',
      storage: createJSONStorage(() => localStorage),
      // 初始化时自动应用主题
      onRehydrateStorage: () => (state) => {
        if (state) {
          updateDom(state.theme)
        }
      },
    },
  ),
)

// 辅助函数：操作 DOM class
const updateDom = (theme: Theme) => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}
