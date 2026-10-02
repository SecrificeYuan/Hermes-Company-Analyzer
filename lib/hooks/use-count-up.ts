'use client'

import { useEffect, useRef } from 'react'
import { animate } from 'framer-motion'

/** 数字滚动动画：从 0 跳到目标值（终端感的来源之一） */
export function useCountUp(target: number, duration = 1.2, decimals = 0) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const controls = animate(0, target, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = v.toFixed(decimals)
      },
    })
    return () => controls.stop()
  }, [target, duration, decimals])

  return ref
}
