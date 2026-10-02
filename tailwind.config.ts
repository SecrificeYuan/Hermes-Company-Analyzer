import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * 设计系统 —— 暗色科技风（金融终端感）
 * 颜色由 app/globals.css 的 CSS 变量驱动（:root/lite/pro 双主题），保持与 lib/theme/tokens.ts 同步。
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          bg: 'var(--bg)',
          card: 'var(--card-solid)',
          edge: 'var(--edge)',
        },
        neon: 'var(--accent)',
        danger: 'var(--danger)',
        warn: 'var(--warn)',
        safe: 'var(--safe)',
        grape: 'var(--grape)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        btn: '8px',
      },
      boxShadow: {
        glow: '0 0 24px rgba(0,229,255,0.25)',
        'glow-danger': '0 0 24px rgba(255,59,92,0.35)',
        'glow-safe': '0 0 24px rgba(0,229,138,0.25)',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100vw)' },
        },
        breathe: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,59,92,0.0)' },
          '50%': { boxShadow: '0 0 18px 2px rgba(255,59,92,0.55)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        scanline: 'scanline 2.5s linear infinite',
        breathe: 'breathe 1.6s ease-in-out infinite',
        blink: 'blink 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
