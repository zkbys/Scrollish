import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions'
const AI_MODEL = 'Qwen/Qwen2.5-7B-Instruct'

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
          const apiKey = import.meta.env.VITE_SILICONFLOW_API_KEY
          if (!apiKey) throw new Error('No API Key')

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
                  content: `You are a linguistic expert API. 
                  Analyze the target word in the given context.
                  Output strictly valid JSON with this structure:
                  {
                    "ipa": "pronunciation",
                    "context_meaning_cn": "Meaning in this specific sentence (Chinese)",
                    "context_meaning_en": "Meaning in this specific sentence (English)",
                    "definition_cn": "General dictionary definition (Chinese)",
                    "definition_en": "General dictionary definition (English)",
                    "roots": "Etymology/Roots breakdown (e.g., 're-(again) + act(do)')"
                  }
                  Do not output markdown code blocks, just the raw JSON string.`,
                },
                {
                  role: 'user',
                  content: `Word: "${word}"\nContext: "${context}"`,
                },
              ],
              stream: false,
              temperature: 0.3,
            }),
          })

          const data = await response.json()
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
