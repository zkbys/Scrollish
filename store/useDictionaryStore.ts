import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const AI_MODEL = 'Qwen/Qwen2.5-7B-Instruct'

import { supabase } from '../supabase'

export interface DictionaryResult {
  word: string
  ipa: string
  context_meaning_cn: string
  context_meaning_en: string
  definition_cn: string
  definition_en: string
  roots: string
  contexts?: { text: string; meaning: string; created_at: string }[]
}

interface DictionaryState {
  analyzingWords: string[]
  cachedDefinitions: Record<string, DictionaryResult>

  // Actions
  triggerAnalysis: (
    word: string,
    context: string,
  ) => Promise<DictionaryResult | null>
  forgetWord: (word: string) => void
  getDefinition: (word: string, context: string) => DictionaryResult | null
  isAnalyzing: (word: string, context: string) => boolean
}

export const useDictionaryStore = create<DictionaryState>()(
  persist(
    (set, get) => ({
      analyzingWords: [],
      cachedDefinitions: {},

      triggerAnalysis: async (word, context) => {
        const { analyzingWords, cachedDefinitions } = get()

        // 生成语境相关的缓存 Key (为了简洁和安全，对 context 取简短的哈希或截取)
        // 这里简单使用 word + context 的前 30 个字符作为 Key
        const contextKey = context.trim().slice(0, 30)
        const cacheKey = `${word}:${contextKey}`

        if (cachedDefinitions[cacheKey]) {
          return cachedDefinitions[cacheKey]
        }

        if (analyzingWords.includes(cacheKey)) return null

        set({ analyzingWords: [...analyzingWords, cacheKey] })

        try {
          const { data, error } = await supabase.functions.invoke('dictionary', {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: {
              word,
              context,
              model: AI_MODEL,
            },
          })

          if (error) throw error

          const content = data.choices?.[0]?.message?.content || '{}'
          const jsonStr = content.replace(/```json|```/g, '').trim()

          let parsedResult: DictionaryResult
          try {
            parsedResult = JSON.parse(jsonStr)
          } catch (e) {
            parsedResult = {
              word,
              ipa: '',
              roots: '',
              context_meaning_cn: '解析失败，请重试',
              context_meaning_en: 'Parse failed',
              definition_cn: '',
              definition_en: '',
            }
          }
          parsedResult.word = word

          set((state) => ({
            cachedDefinitions: {
              ...state.cachedDefinitions,
              [cacheKey]: parsedResult,
            },
            analyzingWords: state.analyzingWords.filter((w) => w !== cacheKey),
          }))
          return parsedResult
        } catch (error) {
          console.error('Dict API Error:', error)
          set((state) => ({
            analyzingWords: state.analyzingWords.filter((w) => w !== cacheKey),
          }))
          return null
        }
      },


      forgetWord: (word) => {
        set((state) => {
          const newCache = { ...state.cachedDefinitions }
          delete newCache[word]
          return { cachedDefinitions: newCache }
        })
      },

      getDefinition: (word, context) => {
        const contextKey = context.trim().slice(0, 30)
        const cacheKey = `${word}:${contextKey}`
        return get().cachedDefinitions[cacheKey] || null
      },
      isAnalyzing: (word, context) => {
        const contextKey = context.trim().slice(0, 30)
        const cacheKey = `${word}:${contextKey}`
        return get().analyzingWords.includes(cacheKey)
      },
    }),
    {
      name: 'scrollish-dict-v3',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ cachedDefinitions: state.cachedDefinitions }),
    },
  ),
)