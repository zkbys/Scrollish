import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { supabase } from '../supabase'

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

export interface UserInteraction {
  count: number // 总点击次数
  isSaved: boolean // 是否收藏
  lastUpdated: number // 最后交互时间
  savedContext?: string // 收藏时的语境 (新增)
}

// 新增：TTS设置类型
export interface VoiceSettings {
  lang: string // e.g., 'en-US'
  name: string // e.g., 'Microsoft Guy Online (Natural)'
}

interface DictionaryState {
  analyzingWords: string[]
  cachedDefinitions: Record<string, DictionaryResult>
  userInteractions: Record<string, UserInteraction>

  // 新增：全局发音设置
  preferredVoice: VoiceSettings | null

  // Actions
  triggerAnalysis: (
    word: string,
    context: string,
  ) => Promise<DictionaryResult | null>
  forgetWord: (word: string) => void
  getDefinition: (word: string) => DictionaryResult | null
  isAnalyzing: (word: string) => boolean

  // 改造：增加 context 参数
  toggleSaveWord: (word: string, context?: string) => Promise<void>
  getInteraction: (word: string) => UserInteraction
  syncInteractions: () => Promise<void>

  // 新增：设置发音
  setPreferredVoice: (voice: VoiceSettings) => void
}

export const useDictionaryStore = create<DictionaryState>()(
  persist(
    (set, get) => ({
      analyzingWords: [],
      cachedDefinitions: {},
      userInteractions: {},
      preferredVoice: null,

      triggerAnalysis: async (word, context) => {
        const { analyzingWords, cachedDefinitions, userInteractions } = get()
        const normalizedWord = word.toLowerCase()

        // 1. 立即更新交互次数
        const currentInteraction = userInteractions[normalizedWord] || {
          count: 0,
          isSaved: false,
          lastUpdated: 0,
        }
        const newCount = currentInteraction.count + 1

        set((state) => ({
          userInteractions: {
            ...state.userInteractions,
            [normalizedWord]: {
              ...currentInteraction,
              count: newCount,
              lastUpdated: Date.now(),
            },
          },
        }))

        // 异步同步到后端 (更新 lookup_count)
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            supabase
              .from('user_vocabulary')
              .upsert(
                {
                  user_id: user.id,
                  word: normalizedWord,
                  lookup_count: newCount,
                  last_interacted_at: new Date().toISOString(),
                },
                { onConflict: 'user_id, word' },
              )
              .then(({ error }) => {
                if (error) console.error('Sync error:', error)
              })
          }
        })

        if (cachedDefinitions[normalizedWord])
          return cachedDefinitions[normalizedWord]
        if (analyzingWords.includes(normalizedWord)) return null

        set({ analyzingWords: [...analyzingWords, normalizedWord] })

        try {
          const { data, error } = await supabase.functions.invoke('dictionary', {
            body: {
              word,
              context,
              model: AI_MODEL, // 可选，后端有默认值
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
              [normalizedWord]: parsedResult,
            },
            analyzingWords: state.analyzingWords.filter(
              (w) => w !== normalizedWord,
            ),
          }))
          return parsedResult
        } catch (error) {
          set((state) => ({
            analyzingWords: state.analyzingWords.filter(
              (w) => w !== normalizedWord,
            ),
          }))
          return null
        }
      },

      toggleSaveWord: async (word, context) => {
        const normalizedWord = word.toLowerCase()
        const current = get().userInteractions[normalizedWord] || {
          count: 0,
          isSaved: false,
          lastUpdated: 0,
        }
        const newSavedState = !current.isSaved
        // 如果是收藏操作，且提供了 context，则更新 context；否则保留原有的 (或 undefined)
        const newContext =
          newSavedState && context ? context : current.savedContext

        // 1. 本地更新
        set((state) => ({
          userInteractions: {
            ...state.userInteractions,
            [normalizedWord]: {
              ...current,
              isSaved: newSavedState,
              savedContext: newContext,
            },
          },
        }))

        // 2. 远程同步
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('user_vocabulary').upsert(
            {
              user_id: user.id,
              word: normalizedWord,
              is_saved: newSavedState,
              context: newContext || null, // 同步 Context 到数据库
              lookup_count: current.count,
              last_interacted_at: new Date().toISOString(),
            },
            { onConflict: 'user_id, word' },
          )
        }
      },

      forgetWord: (word) => {
        const normalizedWord = word.toLowerCase()
        set((state) => {
          const newCache = { ...state.cachedDefinitions }
          delete newCache[normalizedWord]
          return { cachedDefinitions: newCache }
        })
      },

      getDefinition: (word) =>
        get().cachedDefinitions[word.toLowerCase()] || null,
      getInteraction: (word) =>
        get().userInteractions[word.toLowerCase()] || {
          count: 0,
          isSaved: false,
          lastUpdated: 0,
        },
      isAnalyzing: (word) => get().analyzingWords.includes(word.toLowerCase()),

      syncInteractions: async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('user_vocabulary')
          .select('*')
          .eq('user_id', user.id)
        if (data) {
          const remoteInteractions: Record<string, UserInteraction> = {}
          data.forEach((row: any) => {
            remoteInteractions[row.word] = {
              count: row.lookup_count,
              isSaved: row.is_saved,
              lastUpdated: new Date(row.last_interacted_at).getTime(),
              savedContext: row.context, // 从数据库拉取 context
            }
          })
          set({ userInteractions: remoteInteractions })
        }
      },

      setPreferredVoice: (voice) => set({ preferredVoice: voice }),
    }),
    {
      name: 'scrollish-dict-v5-dopamine',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cachedDefinitions: state.cachedDefinitions,
        userInteractions: state.userInteractions,
        preferredVoice: state.preferredVoice,
      }),
    },
  ),
)