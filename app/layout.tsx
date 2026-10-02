import type { Metadata, Viewport } from 'next'
import { ThemeSync } from '@/components/theme/ThemeSync'
import { SiteChrome } from '@/components/theme/SiteChrome'
import { MarketTicker } from '@/components/market/MarketTicker'
import './globals.css'

export const metadata: Metadata = {
  title: 'HERMES · 公司透视',
  description: '输入公司名，30 秒生成一张公司透视报告：财务/司法/舆情/股权四维尽调一次看清。',
}

export const viewport: Viewport = {
  themeColor: '#070B14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-grid min-h-screen">
        <ThemeSync />
        <MarketTicker />
        <SiteChrome />
        {children}
      </body>
    </html>
  )
}
