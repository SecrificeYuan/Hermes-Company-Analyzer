import { NextResponse } from 'next/server'
import { findCompany, getCompanyHealth } from '@/lib/data/company-health'
export const dynamic = 'force-dynamic'
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const company = await findCompany((await params).id)
  if (!company) return NextResponse.json({ error: '未找到企业主体，请重新搜索' }, { status: 404 })
  return NextResponse.json(await getCompanyHealth(company))
}
