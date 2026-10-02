import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Mode = 'lite' | 'pro'

interface ModeState {
  mode: Mode
  setMode: (m: Mode) => void
  toggleMode: () => void
}

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      mode: 'lite',
      setMode: (m) => set({ mode: m }),
      toggleMode: () => set((s) => ({ mode: s.mode === 'lite' ? 'pro' : 'lite' })),
    }),
    { name: 'hermes-mode' },
  ),
)
