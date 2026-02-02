/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 必须开启 class 模式
  theme: {
    extend: {
      colors: {
        primary: '#FF5500', // 你的主色调
        background: {
          light: '#F9FAFB',
          dark: '#0B0A09',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'bounce-subtle': 'bounce-subtle 2s infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash': 'flash 1s ease-out',
      },
      keyframes: {
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(-5%)', animationTimingFunction: 'cubic-bezier(0.8,0,1,1)' },
          '50%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0,0,0.2,1)' },
        },
        flash: {
          '0%': { backgroundColor: 'rgba(255,255,255,0.1)' },
          '50%': { backgroundColor: 'rgba(59, 130, 246, 0.2)' },
          '100%': { backgroundColor: 'rgba(255,255,255,0.05)' },
        }
      }
    },
  },
  plugins: [],
}