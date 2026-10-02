'use client'

import { useEffect } from 'react'
import { useModeStore } from '@/lib/mode-store'

/** 把 store 中的模式写入 <html data-theme>，驱动全站 CSS 变量 */
export function ThemeSync() {
  const mode = useModeStore((s) => s.mode)
  useEffect(() => {
    document.documentElement.dataset.theme = mode
  }, [mode])
  return null
}
