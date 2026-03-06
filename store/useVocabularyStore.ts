import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { supabase } from '../supabase'
import { DictionaryResult } from './useDictionaryStore'
import { useAuthStore } from './useAuthStore'

interface VocabularyState {
    starredWords: DictionaryResult[]
    hasFetchedStarredWords: boolean

    // Actions
    toggleStarWord: (word: DictionaryResult) => Promise<void>
    isWordStarred: (wordName: string) => boolean
    fetchStarredWords: (force?: boolean) => Promise<void>
    fetchWordContext: (word: string) => Promise<any[]>
    syncLocalWordsToCloud: () => Promise<void>
    registerWordLookup: (word: DictionaryResult, context: string) => Promise<void>
}

export const useVocabularyStore = create<VocabularyState>()(
    persist(
        (set, get) => ({
            starredWords: [],
            hasFetchedStarredWords: false,

            toggleStarWord: async (word) => {
                const user = useAuthStore.getState().currentUser
                const currentStarred = get().starredWords
                const exists = currentStarred.find((w) => w.word === word.word)

                if (exists) {
                    set({ starredWords: currentStarred.filter((w) => w.word !== word.word) })
                } else {
                    set({ starredWords: [word, ...currentStarred] })
                }

                if (user) {
                    try {
                        const { data: existing } = await supabase
                            .from('user_vocabulary')
                            .select('lookup_count, contexts')
                            .eq('user_id', user.id)
                            .eq('word', word.word)
                            .maybeSingle()

                        await supabase.from('user_vocabulary').upsert({
                            user_id: user.id,
                            word: word.word,
                            is_saved: !exists,
                            last_interacted_at: new Date().toISOString(),
                            lookup_count: existing?.lookup_count || 1,
                            contexts: existing?.contexts || [],
                            ipa: word.ipa,
                            definition_cn: word.definition_cn,
                            definition_en: word.definition_en,
                            roots: word.roots,
                        }, { onConflict: 'user_id, word' })
                    } catch (e) {
                        console.error('toggleStarWord Error:', e)
                    }
                }
            },

            isWordStarred: (wordName) => get().starredWords.some((w) => w.word === wordName),

            fetchStarredWords: async (force = false) => {
                const user = useAuthStore.getState().currentUser
                if (!user) return
                if (get().starredWords.length > 0 && !force && get().hasFetchedStarredWords) return

                const { data } = await supabase
                    .from('user_vocabulary')
                    .select('word, ipa, definition_cn, definition_en, roots')
                    .eq('user_id', user.id)
                    .eq('is_saved', true)
                    .order('last_interacted_at', { ascending: false })
                    .limit(100)

                if (data) {
                    const cloudWords: DictionaryResult[] = data.map((item) => ({
                        word: item.word,
                        ipa: item.ipa || '',
                        context_meaning_cn: item.definition_cn || '',
                        context_meaning_en: item.definition_en || '',
                        definition_cn: item.definition_cn || '',
                        definition_en: item.definition_en || '',
                        roots: item.roots || '',
                        contexts: []
                    }))
                    set({ starredWords: cloudWords, hasFetchedStarredWords: true })
                }
            },

            fetchWordContext: async (word) => {
                const user = useAuthStore.getState().currentUser
                if (!user) return []

                const { data } = await supabase
                    .from('user_vocabulary')
                    .select('contexts')
                    .eq('user_id', user.id)
                    .eq('word', word)
                    .single()

                if (data && data.contexts) {
                    set((state) => ({
                        starredWords: state.starredWords.map((item) =>
                            item.word === word ? { ...item, contexts: data.contexts } : item
                        )
                    }))
                    return data.contexts
                }
                return []
            },

            syncLocalWordsToCloud: async () => {
                const user = useAuthStore.getState().currentUser
                const starredWords = get().starredWords
                if (!user || starredWords.length === 0) return

                const { count } = await supabase
                    .from('user_vocabulary')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)

                if (count === 0) {
                    const toSync = starredWords.map((w) => ({
                        user_id: user.id,
                        word: w.word,
                        ipa: w.ipa,
                        definition_cn: w.definition_cn,
                        definition_en: w.definition_en,
                        roots: w.roots,
                        is_saved: true,
                    }))
                    await supabase.from('user_vocabulary').insert(toSync)
                }
            },

            registerWordLookup: async (word, context) => {
                const user = useAuthStore.getState().currentUser
                if (!user) return

                const { data: existing } = await supabase
                    .from('user_vocabulary')
                    .select('lookup_count, contexts')
                    .eq('user_id', user.id)
                    .eq('word', word.word)
                    .maybeSingle()

                const newCount = (existing?.lookup_count || 0) + 1
                const currentContexts = Array.isArray(existing?.contexts) ? existing.contexts : []
                const isDuplicate = currentContexts.some((c: any) => c.text === context)
                const newContexts = isDuplicate
                    ? currentContexts
                    : [
                        {
                            text: context,
                            meaning: word.context_meaning_cn,
                            created_at: new Date().toISOString()
                        },
                        ...currentContexts
                    ].slice(0, 10)

                await supabase.from('user_vocabulary').upsert({
                    user_id: user.id,
                    word: word.word,
                    lookup_count: newCount,
                    contexts: newContexts,
                    last_interacted_at: new Date().toISOString(),
                    ipa: word.ipa,
                    definition_cn: word.definition_cn,
                    definition_en: word.definition_en,
                    roots: word.roots,
                }, { onConflict: 'user_id, word' })
            },
        }),
        {
            name: 'scrollish-vocabulary-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
)
