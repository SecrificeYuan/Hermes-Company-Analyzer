import { NextRequest, NextResponse } from 'next/server'
import { CompanyLookupUnavailableError, suggestCompanies } from '@/lib/data/eastmoney'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ suggestions: [] })
  if (q.length > 80) return NextResponse.json({ error: '查询最多 80 个字符', suggestions: [] }, { status: 400 })
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
