import { beforeEach, describe, expect, it } from 'vitest'
import { useModeStore } from '@/lib/mode-store'

describe('mode store', () => {
  beforeEach(() => {
    localStorage.clear()
    useModeStore.setState({ mode: 'lite' })
  })

  it('默认 lite', () => {
    expect(useModeStore.getState().mode).toBe('lite')
  })

  it('setMode 切换到 pro', () => {
    useModeStore.getState().setMode('pro')
    expect(useModeStore.getState().mode).toBe('pro')
    expect(localStorage.getItem('hermes-mode')).toContain('"pro"')
  })

  it('toggleMode 往返', () => {
    useModeStore.getState().toggleMode()
    expect(useModeStore.getState().mode).toBe('pro')
    useModeStore.getState().toggleMode()
    expect(useModeStore.getState().mode).toBe('lite')
  })
})
