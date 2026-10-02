import type { Announcement } from '@/lib/types'

/** 公告按类型分流到 PRO 详读 section（诉讼/问询→涉诉，减持/质押→股权，其余→证据溯源） */
export function announcementsFor(type: 'legal' | 'equity' | 'evidence', list: Announcement[]): Announcement[] {
  return list.filter((a) => {
    if (type === 'legal') return a.type === '诉讼' || a.type === '问询'
    if (type === 'equity') return a.type === '减持' || a.type === '质押'
    return a.type !== '诉讼' && a.type !== '问询' && a.type !== '减持' && a.type !== '质押'
  })
}
