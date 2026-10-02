'use client'

import { useModeStore } from '@/lib/mode-store'
import { getTokens } from './index'
import type { ThemeTokens } from './types'

export function useMode() {
  return useModeStore((s) => s.mode)
}

export function useTokens(): ThemeTokens {
  return getTokens(useModeStore((s) => s.mode))
}
