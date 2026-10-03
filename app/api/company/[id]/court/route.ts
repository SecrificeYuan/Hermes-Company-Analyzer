import { NextResponse } from 'next/server'
import { fetchRawCompany } from '@/lib/data/fetcher'
import { findCompany } from '@/lib/data/company-health'
import { searchCourtAnnouncements } from '@/lib/data/court-announcements'
import { isMockCompany } from '@/lib/data/adapters/mock'

/** 独立查询，避免公告网响应影响报告主体和风险评分。 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let fullName: string | null = null
  try {
    if (/^\d{6}$/.test(id)) {
      const raw = await fetchRawCompany(id)
      fullName = raw.meta.registry?.fullName ?? null
    } else if (!isMockCompany(id)) {
      const company = await findCompany(id)
      fullName = company?.identity === 'verified' ? company.fullName ?? null : null
    }
  } catch { /* identity is still unverified */ }
  return NextResponse.json(await searchCourtAnnouncements(fullName))
}
