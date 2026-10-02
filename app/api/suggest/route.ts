import { NextRequest, NextResponse } from 'next/server'
import { CompanyLookupUnavailableError, suggestCompanies } from '@/lib/data/eastmoney'

export const dynamic = 'force-dynamic'

/** 搜索候选下拉：返回前 N 个 A 股候选公司（名称/代码子串联想） */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ suggestions: [] })
  try {
    const suggestions = await suggestCompanies(q, 10)
    return NextResponse.json({ suggestions })
  } catch (e) {
    if (e instanceof CompanyLookupUnavailableError) {
      return NextResponse.json({ suggestions: [], reason: 'unavailable' }, { status: 502 })
    }
    throw e
  }
}
