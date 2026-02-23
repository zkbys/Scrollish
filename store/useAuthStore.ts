import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { supabase } from '../supabase'

interface AuthState {
    currentUser: any | null
    localSessionId: string | null
    isLoading: boolean
    isSessionSyncing: boolean
    _hasHydrated: boolean

    // Actions
    setUser: (user: any) => void
    setLoading: (loading: boolean) => void
    setHasHydrated: (state: boolean) => void
    login: (userData: any) => Promise<void>
    logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            currentUser: null,
            localSessionId: null,
            isLoading: true,
            isSessionSyncing: false,
            _hasHydrated: false,

            setUser: (user) => set({ currentUser: user }),
            setLoading: (loading) => set({ isLoading: loading }),
            setHasHydrated: (state) => set({ _hasHydrated: state }),

            login: async (userData) => {
                let currentSessionId = get().localSessionId
                if (!currentSessionId) {
                    currentSessionId = crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36)
                    set({ localSessionId: currentSessionId })
                }

                set({ isSessionSyncing: true, isLoading: true })

                if (userData?.id) {
                    try {
                        const syncPromise = supabase
                            .from('profiles')
                            .update({ last_session_id: currentSessionId })
                            .eq('id', userData.id)

                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Session sync timeout')), 5000)
                        )

                        await Promise.race([syncPromise, timeoutPromise])
                    } catch (err) {
                        console.warn('[AuthStore] Session sync warning:', err)
                    }
                }

                set({ currentUser: userData, isLoading: false, isSessionSyncing: false })
            },

            logout: async () => {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                    await supabase.auth.signOut()
                }

                set({
                    currentUser: null,
                    localSessionId: null,
                    isLoading: false,
                    isSessionSyncing: false
                })
            }
        }),
        {
            name: 'scrollish-auth-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                localSessionId: state.localSessionId
            }),
            onRehydrateStorage: () => (state) => {
                if (state) state.setHasHydrated(true)
            }
        }
    )
)
