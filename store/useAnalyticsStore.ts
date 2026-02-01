import { create } from 'zustand'
import { supabase } from '../supabase'

export type InteractionType =
    | 'view'
    | 'dwell'
    | 'complete'
    | 'click_discussion'
    | 'click_like'
    | 'click_share'

export interface AnalyticsEvent {
    post_id: string
    interaction_type: InteractionType
    metadata?: Record<string, any>
    created_at?: string
}

interface AnalyticsStore {
    queue: AnalyticsEvent[]
    logEvent: (event: Omit<AnalyticsEvent, 'created_at'>) => void
    flushEvents: () => Promise<void>
}

// Batch configuration
const BATCH_SIZE = 5
const FLUSH_INTERVAL = 30000 // 30 seconds

let flushTimer: NodeJS.Timeout | null = null

export const useAnalyticsStore = create<AnalyticsStore>((set, get) => {

    const startTimer = () => {
        if (flushTimer) return
        flushTimer = setInterval(() => {
            get().flushEvents()
        }, FLUSH_INTERVAL)
    }

    // Initialize timer immediately
    startTimer()

    return {
        queue: [],

        logEvent: (event) => {
            set((state) => {
                const newEvent = {
                    ...event,
                    created_at: new Date().toISOString()
                }
                const newQueue = [...state.queue, newEvent]

                // Asynchronously flush if batch size reached
                if (newQueue.length >= BATCH_SIZE) {
                    setTimeout(() => get().flushEvents(), 0)
                }

                return { queue: newQueue }
            })
        },

        flushEvents: async () => {
            const { queue } = get()
            if (queue.length === 0) return

            // Take existing items
            const eventsToSend = [...queue]

            // Clear queue immediately to prevent double sending
            set({ queue: [] })

            try {
                if (!supabase) {
                    console.warn('Supabase client not initialized')
                    return
                }

                const { error } = await supabase
                    .from('user_interactions')
                    .insert(eventsToSend)

                if (error) {
                    console.error('Failed to log interactions:', error)
                    // Optional: Re-queue logic could go here if critical
                } else {
                    // console.log(`[Analytics] Flushed ${eventsToSend.length} events`)
                }
            } catch (err) {
                console.error('Analytics flush error:', err)
            }
        }
    }
})
