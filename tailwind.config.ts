import type { Config } from 'tailwindcss'

/**
 * 设计系统 —— 暗色科技风（金融终端感）
 * 任何颜色/圆角/发光调整只改这里与 lib/theme/tokens.ts，保持两处同步。
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
          bg: '#070B14', // 深空黑背景
          card: '#121A2B', // 卡片底
          edge: 'rgba(0,229,255,0.12)', // 卡片描边
        },
        neon: '#00E5FF', // 主色霓虹青
        danger: '#FF3B5C', // 危险红
        warn: '#FFB020', // 警告琥珀
        safe: '#00E58A', // 安全绿
        grape: '#8B5CF6', // 图谱紫
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
  plugins: [require('tailwindcss-animate')],
}

export default config
