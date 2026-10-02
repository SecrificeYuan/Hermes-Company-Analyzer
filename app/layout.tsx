import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hermes · 公司 X 光机',
  description: '输入公司名，30 秒生成一张游戏化公司 X 光片：HP/护甲/攻击力/隐藏状态/风险时间轴。',
}

export const viewport: Viewport = {
  themeColor: '#070B14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-grid min-h-screen">{children}</body>
    </html>
  )
}
