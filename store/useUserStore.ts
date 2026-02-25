import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { supabase } from '../supabase'
import { useAuthStore } from './useAuthStore'

interface UserState {
  profile: any | null
  hasFetchedProfile: boolean

  // Actions
  fetchProfile: (force?: boolean) => Promise<void>
  updateXP: (amount: number) => Promise<void>
  updateProfile: (updates: any) => Promise<void>
  setTtsVoice: (voice: string) => void
  setTtsParams: (params: { rate?: number; pitch?: number }) => void // 新增：设置全局语速语调
  setProfile: (profile: any) => void
  resetProfile: () => void
  clearVoiceClone: () => Promise<void>
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: null,
      hasFetchedProfile: false,

      fetchProfile: async (force = false) => {
        const user = useAuthStore.getState().currentUser
        if (!user) return
        if (get().profile && !force && get().hasFetchedProfile) return

        console.log('[Store] Fetching profile for user:', user.id)
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
          )
          const fetchPromise = supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any
          if (data) {
            set({ profile: data, hasFetchedProfile: true })
          } else {
            set({ hasFetchedProfile: true })
          }
        } catch (err: any) {
          console.error('[Store] Profile fetch failed:', err.message)
          set({ hasFetchedProfile: true })
        }
      },

      updateXP: async (amount: number) => {
        const user = useAuthStore.getState().currentUser
        const currentProfile = get().profile
        if (!user || !currentProfile) return
        const newXP = (currentProfile.total_xp || 0) + amount
        const { error } = await supabase
          .from('profiles')
          .update({
            total_xp: newXP,
            study_days: (currentProfile.study_days || 0) + (amount > 0 ? 1 : 0),
          })
          .eq('id', user.id)
        if (!error) {
          set({ profile: { ...currentProfile, total_xp: newXP } })
        }
      },

      updateProfile: async (updates: any) => {
        const user = useAuthStore.getState().currentUser
        const currentProfile = get().profile
        if (!user) return

        const cleanUpdates: any = {}
        Object.keys(updates).forEach(key => {
          if (updates[key] !== undefined) {
            cleanUpdates[key] = updates[key]
          }
        })
        if (Object.keys(cleanUpdates).length === 0) return

        const { error } = await supabase
          .from('profiles')
          .update(cleanUpdates)
          .eq('id', user.id)

        if (!error) {
          set({ profile: { ...(currentProfile || {}), ...cleanUpdates } })
        } else {
          throw error
        }
      },

      setTtsVoice: (voice: string) => {
        const currentProfile = get().profile
        if (currentProfile) {
          set({ profile: { ...currentProfile, tts_voice: voice } })
        }
      },

      setTtsParams: (params: { rate?: number; pitch?: number }) => {
        const currentProfile = get().profile
        if (currentProfile) {
          set({
            profile: {
              ...currentProfile,
              tts_rate: params.rate ?? currentProfile.tts_rate ?? 1.0,
              tts_pitch: params.pitch ?? currentProfile.tts_pitch ?? 1.0
            }
          })
        }
      },

      setProfile: (profile: any) => set({ profile }),
      resetProfile: () => set({ profile: null, hasFetchedProfile: false }),

      clearVoiceClone: async () => {
        const user = useAuthStore.getState().currentUser
        if (!user) return
        const { error } = await supabase
          .from('profiles')
          .update({
            cloned_voice_url: null,
            cloned_voice_text: null,
            cloned_voice_name: null,
            cloned_voice_desc: null,
            cloned_voice_avatar_url: null,
            tts_voice: 'Cherry' // 回退到默认
          })
          .eq('id', user.id)

        if (!error) {
          const currentProfile = get().profile
          set({
            profile: {
              ...currentProfile,
              cloned_voice_url: null,
              cloned_voice_text: null,
              cloned_voice_name: null,
              cloned_voice_desc: null,
              cloned_voice_avatar_url: null,
              tts_voice: 'Cherry'
            }
          })
        }
      }
    }),
    {
      name: 'scrollish-profile-storage',
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name),
        removeItem: (name) => localStorage.removeItem(name),
        setItem: (name, value) => {
          if ((globalThis as any)._persistTimeout) {
            clearTimeout((globalThis as any)._persistTimeout)
          }
          (globalThis as any)._persistTimeout = setTimeout(() => {
            localStorage.setItem(name, value)
          }, 500)
        },
      })),
      partialize: (state) => ({
        profile: state.profile,
        hasFetchedProfile: state.hasFetchedProfile
      } as any)
    }
  )
)
