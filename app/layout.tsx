import type { Metadata, Viewport } from 'next'
import { ThemeSync } from '@/components/theme/ThemeSync'
import { ModeToggle } from '@/components/theme/ModeToggle'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hermes · 公司 X 光机',
  description: '输入公司名，30 秒生成一张公司 X 光片：健康度/风险事件/股权网络/风险时间轴。',
}

export const viewport: Viewport = {
  themeColor: '#070B14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-grid min-h-screen">
        <ThemeSync />
        <div className="fixed right-4 top-4 z-50">
          <ModeToggle />
        </div>
        {children}
      </body>
    </html>
  )
}
