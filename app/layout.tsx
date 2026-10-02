import type { Metadata, Viewport } from 'next'
import { ThemeSync } from '@/components/theme/ThemeSync'
import { SiteChrome } from '@/components/theme/SiteChrome'
import { MarketTicker } from '@/components/market/MarketTicker'
import './globals.css'

export const metadata: Metadata = {
  title: 'HERMES · 公司透视',
  description: '搜索上市与未上市企业，通过公开证据评估公司健康状况与投资尽调缺口。',
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
