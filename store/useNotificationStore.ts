import { create } from 'zustand'
import { supabase } from '../supabase'
import { useAuthStore } from './useAuthStore'

export interface Notification {
    id: string
    user_id: string
    type: 'system' | 'award' | 'social'
    title: string
    content: string
    metadata: any
    is_read: boolean
    created_at: string
}

interface NotificationState {
    notifications: Notification[]
    isLoading: boolean
    error: string | null

    fetchNotifications: () => Promise<void>
    markAsRead: (id: string) => Promise<void>
    markAllAsRead: () => Promise<void>
    subscribeRealtime: () => (() => void)
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    isLoading: false,
    error: null,

    fetchNotifications: async () => {
        const user = useAuthStore.getState().currentUser
        if (!user) return

        set({ isLoading: true, error: null })
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            set({ notifications: data || [] })
        } catch (err: any) {
            console.error('[NotificationStore] Fetch failed:', err.message)
            set({ error: err.message })
        } finally {
            set({ isLoading: false })
        }
    },

    markAsRead: async (id: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)

        if (!error) {
            set({
                notifications: get().notifications.map(n =>
                    n.id === id ? { ...n, is_read: true } : n
                )
            })
        }
    },

    markAllAsRead: async () => {
        const user = useAuthStore.getState().currentUser
        if (!user) return

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false)

        if (!error) {
            set({
                notifications: get().notifications.map(n => ({ ...n, is_read: true }))
            })
        }
    },

    subscribeRealtime: () => {
        const user = useAuthStore.getState().currentUser
        if (!user) return () => { }

        const channel = supabase
            .channel(`notifications:user_id=eq.${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    console.log('[NotificationStore] Realtime event:', payload.eventType)
                    if (payload.eventType === 'INSERT') {
                        set({ notifications: [payload.new as Notification, ...get().notifications] })
                    } else if (payload.eventType === 'UPDATE') {
                        set({
                            notifications: get().notifications.map(n =>
                                n.id === payload.new.id ? (payload.new as Notification) : n
                            )
                        })
                    } else if (payload.eventType === 'DELETE') {
                        set({
                            notifications: get().notifications.filter(n => n.id !== payload.old.id)
                        })
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }
}))
