import { supabase } from '../supabase'

/**
 * 发送通知的工具函数
 * @param userId 目标用户 ID
 * @param title 通知标题
 * @param content 通知内容
 * @param type 通知类型：'system' (系统), 'award' (奖励), 'social' (社交)
 * @param metadata 可选的额外元数据（如跳转链接、奖励数额等）
 */
export const sendNotification = async (
    userId: string,
    title: string,
    content: string,
    type: 'system' | 'award' | 'social' = 'system',
    metadata: any = {}
) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .insert([
                {
                    user_id: userId,
                    title,
                    content,
                    type,
                    metadata
                }
            ])
            .select()

        if (error) throw error
        return { data, error: null }
    } catch (err: any) {
        console.error('[NotificationUtils] Send failed:', err.message)
        return { data: null, error: err.message }
    }
}

/**
 * 向所有活跃用户广播通知 (慎用)
 */
export const broadcastNotification = async (
    title: string,
    content: string,
    type: 'system' | 'award' | 'social' = 'system',
    metadata: any = {}
) => {
    try {
        // 1. 获取所有用户 ID
        const { data: profiles, error: fetchError } = await supabase
            .from('profiles')
            .select('id')

        if (fetchError) throw fetchError
        if (!profiles || profiles.length === 0) return

        // 2. 批量插入通知
        const notifications = profiles.map(p => ({
            user_id: p.id,
            title,
            content,
            type,
            metadata
        }))

        const { error: insertError } = await supabase
            .from('notifications')
            .insert(notifications)

        if (insertError) throw insertError
        return { success: true, error: null }
    } catch (err: any) {
        console.error('[NotificationUtils] Broadcast failed:', err.message)
        return { success: false, error: err.message }
    }
}
