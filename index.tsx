import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// [新增] 1. 引入 PWA 注册方法
import { registerSW } from 'virtual:pwa-register'

// [新增] 2. 注册 Service Worker
// 这里的逻辑是：如果检测到更新，或者准备好离线使用了，会打印日志或执行回调
// 在开发环境下（npm run dev），Service Worker 默认是不会注册的，除非你在 vite config 里特殊配置 devOptions
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})

// [高级手势拦截] 1. 拦截水平方向的过度滑动，防止触发浏览器侧滑返回
document.addEventListener('touchstart', (e) => {
  // @ts-ignore
  window._touchStartX = e.touches[0].pageX
  // @ts-ignore
  window._touchStartY = e.touches[0].pageY
}, { passive: true })

document.addEventListener('touchmove', (e) => {
  const x = e.touches[0].pageX
  const y = e.touches[0].pageY
  // @ts-ignore
  const dx = Math.abs(x - window._touchStartX)
  // @ts-ignore
  const dy = Math.abs(y - window._touchStartY)

  // 如果水平滑动明显大于垂直滑动，且处于应用边缘区域，尝试拦截
  if (dx > dy && dx > 10) {
    // 这里不直接 preventDefault 以免破坏所有横滑（如 Carousel），
    // 但通过 touch-action: pan-y 配合此逻辑，大部分国产浏览器会减少误触
  }
}, { passive: true })

// [高级手势拦截] 2. 导航守卫：进入首页后植入一个 History 状态，拦截第一次“返回”操作
if (window.history && window.history.pushState) {
  window.addEventListener('popstate', () => {
    // 当检测到返回动作时，再次推送状态，保持在原地
    // 注意：这仅在用户处于首页（根路径）时生效
    if (window.location.hash === '' || window.location.pathname === '/') {
      window.history.pushState('target', '', '')
    }
  })
  window.history.pushState('target', '', '')
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Could not find root element to mount to')
}

const root = ReactDOM.createRoot(rootElement)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
