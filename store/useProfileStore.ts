import { create } from 'zustand'

interface ProfileState {
    scrollPos: number
    setScrollPos: (pos: number) => void
}

export const useProfileStore = create<ProfileState>((set) => ({
    scrollPos: 0,
    setScrollPos: (pos) => set({ scrollPos: pos }),
}))
