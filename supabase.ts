/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing in .env file. Falling back to provided values.',
  )
}

// [优化] 当使用 Nginx 代理时，REST API 走代理加速
// WebSocket（Realtime）保持直连 Supabase（代理对长连接无加速效果）
const ORIGINAL_SUPABASE_HOST = 'zgteuwwhiwfglrvjcekq.supabase.co'
const isProxied = supabaseUrl!.includes('/api/supabase')

export const supabase = createClient(
  supabaseUrl!,
  supabaseAnonKey!,
  {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
)

// Supabase JS v2 内部从主 URL 派生 WebSocket 地址，构造参数无法覆盖
// 在创建后直接修改 Realtime 客户端的连接地址，让 WS 绕过代理直连 Supabase
if (isProxied) {
  ; (supabase.realtime as any).endpointURL = () => `wss://${ORIGINAL_SUPABASE_HOST}/realtime/v1/websocket?apikey=${supabaseAnonKey}&vsn=2.0.0`
}
