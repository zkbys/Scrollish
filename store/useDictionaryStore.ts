import { create } from 'zustand'
import { supabase } from '../supabase'
import { Dictionary, DictionaryEntry } from '../types'

interface DictionaryState {
  dictionaries: Dictionary[]
  activeDictionaryId: string | null
  highlightSet: Set<string>
  isLoading: boolean

  // Actions
  fetchDictionaries: () => Promise<void>
  setActiveDictionary: (id: string) => Promise<void>
  getWordEntry: (word: string) => Promise<DictionaryEntry | null>
}

export const useDictionaryStore = create<DictionaryState>((set, get) => ({
  dictionaries: [],
  activeDictionaryId: null,
  highlightSet: new Set(),
  isLoading: false,

  fetchDictionaries: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('dictionaries')
        .select('*')
        .order('is_public', { ascending: false }) // System/Public first

      if (error) throw error

      set({ dictionaries: data as Dictionary[] })

      // Auto-select first if none selected
      if (!get().activeDictionaryId && data && data.length > 0) {
        await get().setActiveDictionary(data[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch dictionaries:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  setActiveDictionary: async (id: string) => {
    set({ activeDictionaryId: id, isLoading: true })
    try {
      // Optimized: Fetch only words column
      const { data, error } = await supabase
        .from('dictionary_entries')
        .select('word')
        .eq('dictionary_id', id)

      if (error) throw error

      const newSet = new Set(data.map((entry) => entry.word.toLowerCase()))
      set({ highlightSet: newSet })
    } catch (err) {
      console.error('Failed to fetch dictionary words:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  getWordEntry: async (word: string) => {
    const { activeDictionaryId } = get()
    if (!activeDictionaryId) return null

    try {
      const { data, error } = await supabase
        .from('dictionary_entries')
        .select('*')
        .eq('dictionary_id', activeDictionaryId)
        .eq('word', word) // Note: This might need case-insensitive matching in DB or exact match if pre-normalized
        .maybeSingle()

      if (error) throw error
      return data as DictionaryEntry
    } catch (err) {
      console.error('Failed to lookup word:', err)
      return null
    }
  }
}))
