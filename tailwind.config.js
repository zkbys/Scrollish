/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 1. 主色调：果冻橙 (Juicy Orange)
        primary: {
          DEFAULT: '#FF9F2E', // 核心橙
          light: '#FFC880',   // 高光
          dark: '#E67E00',    // 阴影
          glow: 'rgba(255, 159, 46, 0.5)', // 发光光晕
        },

        // 2. 辅助色：宇宙流体 (Cosmic Flow)
        accent: {
          purple: '#9D8AFE',  // 字母SRT的颜色
          lilac: '#D6CFF9',   // 浅紫高光
          deep: '#4A3B89',    // 深处阴影
        },

        // 3. 背景色：沉浸式画布
        background: {
          light: '#FFF9F2',   // 极浅的暖橙白 (日间)
          dark: '#141018',    // 深邃的紫黑色 (夜间)
        },

        // 4. 功能色
        status: {
          success: '#4ADE80',
          error: '#FB7185',
        }
      },
      backgroundImage: {
        // 核心渐变
        'juice-gradient': 'linear-gradient(135deg, #FF9F2E 0%, #FF6B00 100%)',
        'cosmic-gradient': 'linear-gradient(135deg, #FF9F2E 0%, #9D8AFE 100%)',
        // 玻璃光泽 (用于按钮扫光)
        'glass-shine': 'linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0))',
      },
      boxShadow: {
        // 霓虹发光效果
        'glow-orange': '0 8px 20px -6px rgba(255, 159, 46, 0.6)',
        'glow-purple': '0 8px 20px -6px rgba(157, 138, 254, 0.6)',
        // 悬浮卡片阴影
        'float': '0 10px 30px -10px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'bounce-slow': 'bounce 3s infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'gradient-x': 'gradient-x 3s ease infinite',
        'aurora': 'aurora 10s ease infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        aurora: {
          '0%': { transform: 'scale(1) translate(0, 0) rotate(0deg)', opacity: '0.5' },
          '100%': { transform: 'scale(1.2) translate(-20px, -20px) rotate(10deg)', opacity: '0.8' },
        }
      }
    },
  },
  plugins: [],
}