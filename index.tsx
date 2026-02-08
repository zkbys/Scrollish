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
    // 检测到新版本时的逻辑，为了简化，这里直接询问是否刷新
    if (confirm('New content available. Reload?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})

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
