import { create } from 'zustand'

interface TTSStore {
    activeVoice: string | null
    activeVoiceName: string | null // 新增：当前正在说话角色的显示名称
    activeAvatar: string | null
    stopCallback: (() => Promise<void> | void) | null
    amplitude: number
    setActiveVoice: (voice: string | null, avatar?: string | null, name?: string | null) => void // 更新：支持设置名称
    setStopCallback: (fn: (() => Promise<void> | void) | null) => void
    setAmplitude: (val: number) => void
}

export const useTTSStore = create<TTSStore>((set) => ({
    activeVoice: null,
    activeVoiceName: null,
    activeAvatar: null,
    stopCallback: null,
    amplitude: 0,
    setActiveVoice: (voice, avatar = null, name = null) => set({ activeVoice: voice, activeAvatar: avatar, activeVoiceName: name }),
    setStopCallback: (fn) => set({ stopCallback: fn }),
    setAmplitude: (val) => set({ amplitude: val }),
}))
