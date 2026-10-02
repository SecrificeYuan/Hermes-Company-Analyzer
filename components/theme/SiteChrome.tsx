'use client'

import { usePathname } from 'next/navigation'
import { ModeToggle } from '@/components/theme/ModeToggle'

/** 全站挂件：首页为中性单皮不显示模式开关，其余页面显示 */
export function SiteChrome() {
  const pathname = usePathname()
  if (pathname === '/') return null
  return (
    <div className="fixed right-4 top-4 z-50">
      <ModeToggle />
    </div>
  )
}
