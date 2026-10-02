'use client'

import { useEffect, useRef } from 'react'

const NODE_COUNT = 40
const LINK_DIST = 120
const DPR_CAP = 2

interface NetNode {
  x: number
  y: number
  vx: number
  vy: number
}

/** 首页背景：悬浮知识网络（纯装饰，2D canvas，无 WebGL；prefers-reduced-motion 时静态单帧） */
export function NetworkBg() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    let c: CanvasRenderingContext2D | null = null
    try {
      c = canvas.getContext('2d')
    } catch {
      return // 纯装饰：静默失败
    }
    if (!c) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    let width = parent.clientWidth
    let height = parent.clientHeight

    const nodes: NetNode[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
    }))

    const draw = () => {
      c!.clearRect(0, 0, width, height)
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > width) n.vx *= -1
        if (n.y < 0 || n.y > height) n.vy *= -1
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
          if (d < LINK_DIST) {
            c!.strokeStyle = `rgba(76, 141, 255, ${0.28 * (1 - d / LINK_DIST)})`
            c!.lineWidth = 1
            c!.beginPath()
            c!.moveTo(nodes[i].x, nodes[i].y)
            c!.lineTo(nodes[j].x, nodes[j].y)
            c!.stroke()
          }
        }
      }
      c!.fillStyle = 'rgba(160, 195, 255, 0.85)'
      for (const n of nodes) {
        c!.beginPath()
        c!.arc(n.x, n.y, 1.6, 0, Math.PI * 2)
        c!.fill()
      }
    }

    const resize = () => {
      width = parent.clientWidth
      height = parent.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      c!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    let raf = 0
    if (reduced) {
      draw()
    } else {
      const loop = () => {
        draw()
        raf = requestAnimationFrame(loop)
      }
      loop()
    }

    const onResize = () => {
      resize()
      if (reduced) draw()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-0" aria-hidden="true" />
}
