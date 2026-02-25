import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' // [新增] 引入插件
import basicSsl from '@vitejs/plugin-basic-ssl' // [新增] 引入 ssl 插件

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    base: '/scrollish/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: {
        protocol: 'ws',
      },
    },
    plugins: [
      react(),
      basicSsl(), // [新增] 启用临时的 HTTPS 证书
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        // 包含静态资源
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
        ],
        manifest: {
          name: 'Scrollish',
          short_name: 'Scrollish',
          description: 'Learn English by Scrolling',
          theme_color: '#FF5500',
          background_color: '#FFFBF2',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable', // Safari 不看这个，主要是给 Android/Chrome 用的
            },
          ],
        },
        // 删除了 useCredentials: true 避免 Safari 加载权限问题
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            // ...保留你原有的 runtimeCaching 配置不变
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
        // [修复] 禁用自动生成，避免与你手动引入的图标发生冲突
        pwaAssets: {
          disabled: true,
        },
      }),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  }
})
