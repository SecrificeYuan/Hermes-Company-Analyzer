'use client'

import { usePathname } from 'next/navigation'
import { ModeToggle } from '@/components/theme/ModeToggle'

/** 全站挂件：首页与对话页为单皮不显示模式开关，其余页面显示 */
export function SiteChrome() {
  const pathname = usePathname()
  if (pathname === '/' || pathname === '/chat') return null
  return (
    <div className="fixed right-4 top-12 z-50">
      <ModeToggle />
    </div>
  )
}
