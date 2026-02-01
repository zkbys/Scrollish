import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// 配置区域
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions'
const AI_MODEL = 'deepseek-ai/DeepSeek-V2.5'

interface DictionaryState {
  // 正在分析的词
  analyzingWords: string[]
  // 已分析完成的词缓存: { "word": "definition" }
  cachedDefinitions: Record<string, string>
  // 当前准备好展示的通知
  latestReadyWord: string | null

  // Actions
  triggerAnalysis: (word: string, context: string) => Promise<void>
  dismissNotification: () => void
  getDefinition: (word: string) => string | null
  isAnalyzing: (word: string) => boolean
}

export const useDictionaryStore = create<DictionaryState>()(
  persist(
    (set, get) => ({
      analyzingWords: [],
      cachedDefinitions: {},
      latestReadyWord: null,

      triggerAnalysis: async (word, context) => {
        const { analyzingWords, cachedDefinitions } = get()

        // 1. 如果已经有缓存，直接触发通知（让用户可以再次查看）
        if (cachedDefinitions[word]) {
          set({ latestReadyWord: word })
          return
        }

        // 2. 如果正在分析，忽略重复请求
        if (analyzingWords.includes(word)) return

        // 3. 标记为正在分析
        set({ analyzingWords: [...analyzingWords, word] })

        try {
          const apiKey = import.meta.env.VITE_SILICONFLOW_API_KEY
          if (!apiKey) {
            console.error('Missing API Key')
            // 模拟一个错误或回退
            throw new Error('No API Key')
          }

          // 4. 真实的 LLM 调用
          const response = await fetch(SILICONFLOW_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: AI_MODEL,
              messages: [
                {
                  role: 'system',
                  content: `You are a concise English dictionary assistant for non-native speakers.
                  Task: Explain the meaning of the target word based on the provided context sentence.
                  Output Format:
                  1. Pronunciation (IPA) if possible.
                  2. Definition: A short, clear explanation of what the word means *in this specific context*.
                  3. Nuance: A brief note on why this word was chosen (e.g., tone, slang, formal) if applicable.
                  
                  Keep it under 100 words. Use emojis sparingly to make it friendly.`,
                },
                {
                  role: 'user',
                  content: `Target Word: "${word}"
                  Context Sentence: "${context}"`,
                },
              ],
              stream: false,
            }),
          })

          const data = await response.json()
          const aiDefinition =
            data.choices?.[0]?.message?.content ||
            'Sorry, could not define this word.'

          // 5. 更新状态：存入缓存，移除 Loading，触发通知
          set((state) => ({
            cachedDefinitions: {
              ...state.cachedDefinitions,
              [word]: aiDefinition,
            },
            analyzingWords: state.analyzingWords.filter((w) => w !== word),
            latestReadyWord: word,
          }))
        } catch (error) {
          console.error('Dictionary API Error:', error)
          // 发生错误时，移除 Loading 状态，避免卡死
          set((state) => ({
            analyzingWords: state.analyzingWords.filter((w) => w !== word),
          }))
        }
      },

      dismissNotification: () => set({ latestReadyWord: null }),
      getDefinition: (word) => get().cachedDefinitions[word] || null,
      isAnalyzing: (word) => get().analyzingWords.includes(word),
    }),
    {
      name: 'scrollish-dictionary-cache',
      storage: createJSONStorage(() => localStorage),
      // 只持久化缓存，不持久化正在分析的状态和通知
      partialize: (state) => ({ cachedDefinitions: state.cachedDefinitions }),
    },
  ),
)
