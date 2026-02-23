import React, { useEffect } from 'react'
import { supabase } from '../supabase'
import { Page } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { useUserStore } from '../store/useUserStore'
import { useExploreStore } from '../store/useExploreStore'

/**
 * Hook to manage authentication sessions and realtime profile updates.
 */
export const useSessionManager = (
    currentPage: Page,
    setCurrentPage: (page: Page) => void,
    currentPageRef: React.MutableRefObject<Page>
) => {
    const {
        currentUser,
        login,
        logout,
        setLoading: setAuthLoading,
        isLoading: isAuthLoading,
        _hasHydrated,
    } = useAuthStore()

    const { profile, hasFetchedProfile } = useUserStore()
    const { initializeExplore } = useExploreStore()

    // 1. Initial Auth & Listeners
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                if (!useAuthStore.getState().currentUser) {
                    login(session.user)
                }
            } else {
                logout()
            }
            setAuthLoading(false)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                if (useAuthStore.getState().currentUser?.id !== session.user.id) {
                    login(session.user)
                }
            } else {
                supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
                    if (!currentSession && useAuthStore.getState().currentUser) {
                        logout()
                    }
                })
            }
            setAuthLoading(false)
        })

        initializeExplore()

        // Initialize Theme
        import('../store/useThemeStore').then((m) =>
            m.useThemeStore.getState().initTheme(),
        )

        return () => {
            subscription.unsubscribe()
        }
    }, [login, logout, setAuthLoading, initializeExplore])

    // 2. Routing Guards
    useEffect(() => {
        if (_hasHydrated && !isAuthLoading) {
            if (!currentUser) {
                if (currentPage !== Page.Login) {
                    setCurrentPage(Page.Login)
                }
            } else {
                if (currentPage === Page.Login) {
                    const hasProf = useUserStore.getState().hasFetchedProfile
                    if (hasProf) {
                        if (!profile?.learning_reason) {
                            setCurrentPage(Page.Onboarding)
                        } else {
                            setCurrentPage(Page.Home)
                        }
                    } else {
                        const timer = setTimeout(() => {
                            if (useAuthStore.getState().currentUser && currentPage === Page.Login) {
                                const isReturningUser = !!(
                                    profile?.learning_reason ||
                                    profile?.target_level ||
                                    (profile?.total_xp && profile.total_xp > 0)
                                )
                                setCurrentPage(isReturningUser ? Page.Home : Page.Onboarding)
                            }
                        }, 5000)
                        return () => clearTimeout(timer)
                    }
                } else if (
                    useUserStore.getState().hasFetchedProfile &&
                    !profile?.learning_reason &&
                    !profile?.target_level &&
                    !(profile?.total_xp && profile.total_xp > 0) &&
                    currentPage !== Page.Onboarding
                ) {
                    setCurrentPage(Page.Onboarding)
                }
            }
        }
    }, [currentUser, currentPage, isAuthLoading, profile, hasFetchedProfile, _hasHydrated, setCurrentPage])

    // 3. Session Stability & Realtime
    useEffect(() => {
        if (!_hasHydrated || !currentUser) return

        const validateSession = async () => {
            const currentLoc = currentPageRef.current
            const state = useAuthStore.getState()

            if (currentLoc === Page.Login || state.isSessionSyncing) return

            const { data, error } = await supabase
                .from('profiles')
                .select('last_session_id')
                .eq('id', currentUser.id)
                .single()

            if (error) return

            const localId = useAuthStore.getState().localSessionId
            if (data?.last_session_id && localId && data.last_session_id !== localId) {
                if (useAuthStore.getState().isSessionSyncing) return

                await new Promise((resolve) => setTimeout(resolve, 3000))
                const { data: retryData } = await supabase
                    .from('profiles')
                    .select('last_session_id')
                    .eq('id', currentUser.id)
                    .single()

                if (retryData?.last_session_id && retryData.last_session_id !== localId) {
                    logout()
                    setCurrentPage(Page.Login)
                    setTimeout(() => {
                        alert('您的账号已在其他设备登录，当前会话已失效。')
                    }, 100)
                }
            }
        }

        const channel = supabase
            .channel(`profile_session_${currentUser.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${currentUser.id}`,
                },
                (payload) => {
                    const newSessionId = payload.new?.last_session_id
                    const localId = useAuthStore.getState().localSessionId

                    if (newSessionId && localId && newSessionId !== localId) {
                        setTimeout(async () => {
                            const latestLocalId = useAuthStore.getState().localSessionId
                            if (newSessionId !== latestLocalId) {
                                logout()
                                setCurrentPage(Page.Login)
                                alert('您的账号已在其他设备登录，当前会话已失效。')
                            }
                        }, 2000)
                    }
                },
            )
            .subscribe()

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                validateSession()
            }
        }

        validateSession()
        window.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            supabase.removeChannel(channel)
            window.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [currentUser?.id, _hasHydrated, logout, setCurrentPage, currentPageRef])

    return { isAuthLoading, _hasHydrated }
}
