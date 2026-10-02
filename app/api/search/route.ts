import { NextRequest, NextResponse } from 'next/server'
import { CompanyLookupUnavailableError, resolveCompany } from '@/lib/data/eastmoney'

export const dynamic = 'force-dynamic'

/**
 * 公司名 / 股票代码解析：命中 A 股上市公司则返回其代码，供前端跳转 /report/[id]。
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ found: false, reason: 'empty' }, { status: 400 })
  try {
    const company = await resolveCompany(q)
    return NextResponse.json(company ? { found: true, company } : { found: false })
  } catch (e) {
    if (e instanceof CompanyLookupUnavailableError) {
      return NextResponse.json({ found: false, reason: 'unavailable' }, { status: 502 })
    }
    throw e
  }
}
