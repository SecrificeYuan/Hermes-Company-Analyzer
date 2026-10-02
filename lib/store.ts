import { create } from 'zustand'
import type { HiddenStatus } from '@/lib/types'

interface XrayState {
  /** 当前在证据抽屉中打开的隐藏状态 */
  activeStatus: HiddenStatus | null
  setActiveStatus: (s: HiddenStatus | null) => void
}

export const useXrayStore = create<XrayState>((set) => ({
  activeStatus: null,
  setActiveStatus: (s) => set({ activeStatus: s }),
}))
