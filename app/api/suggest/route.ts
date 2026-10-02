import { NextRequest, NextResponse } from 'next/server'
import { searchCompanies } from '@/lib/data/company-discovery'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length > 80) return NextResponse.json({ error: '查询最多 80 个字符', suggestions: [] }, { status: 400 })
  return NextResponse.json(await searchCompanies(q))
}
