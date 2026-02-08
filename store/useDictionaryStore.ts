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
  getDefinition: (word: string) => DictionaryResult | null
  isAnalyzing: (word: string) => boolean
}

export const useDictionaryStore = create<DictionaryState>()(
  persist(
    (set, get) => ({
      analyzingWords: [],
      cachedDefinitions: {},

      triggerAnalysis: async (word, context) => {
        const { analyzingWords, cachedDefinitions } = get()

        if (cachedDefinitions[word]) {
          return cachedDefinitions[word]
        }

        if (analyzingWords.includes(word)) return null

        set({ analyzingWords: [...analyzingWords, word] })

        try {
          // [Security Note] It is safe to use VITE_SUPABASE_ANON_KEY here.
          // The Anon Key is public by design and intended for client-side use.
          // Access control is handled by Postgres Row Level Security (RLS) policies.
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
              [word]: parsedResult,
            },
            analyzingWords: state.analyzingWords.filter((w) => w !== word),
          }))
          return parsedResult
        } catch (error) {
          console.error('Dict API Error:', error)
          set((state) => ({
            analyzingWords: state.analyzingWords.filter((w) => w !== word),
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

      getDefinition: (word) => get().cachedDefinitions[word] || null,
      isAnalyzing: (word) => get().analyzingWords.includes(word),
    }),
    {
      name: 'scrollish-dict-v3',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ cachedDefinitions: state.cachedDefinitions }),
    },
  ),
)