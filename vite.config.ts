import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
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
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // [关键修改] 激进的缓存策略
          runtimeCaching: [
            {
              // 1. 图片缓存 (Supabase, Reddit, Imgur) - 缓存优先
              urlPattern:
                /^https:\/\/.*\.(supabase\.co|redd\.it|imgur\.com)\/.*(png|jpg|jpeg|webp|gif)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'content-images-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7天
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // 2. 用户头像 (Google) - 重新验证
              urlPattern: /^https:\/\/.*googleusercontent\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'user-avatar-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              // 3. 其他 API 请求 (Supabase REST) - 网络优先，确保数据最新
              urlPattern: /^https:\/\/.*supabase\.co\/rest\/v1\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-data-cache',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
          ],
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
