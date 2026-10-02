import { NextRequest, NextResponse } from 'next/server'
import { searchCompanies } from '@/lib/data/company-discovery'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2 || q.length > 80) return NextResponse.json({ found: false, error: '请输入 2–80 个字符' }, { status: 400 })
  const result = await searchCompanies(q)
  const exact = result.suggestions.filter((c) => c.name === q || c.fullName === q || c.creditCode === q || c.id === q)
  const company = exact.length === 1 ? exact[0] : undefined
  return NextResponse.json({ ...result, found: Boolean(company), company, ambiguous: !company && result.suggestions.length > 0 })
}
