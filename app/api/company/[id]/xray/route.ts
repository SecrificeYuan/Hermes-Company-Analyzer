import { getXRay } from '@/lib/get-xray'
import { CompanyNotFoundError } from '@/lib/data/fetcher'
import { findCompany, getCompanyHealth } from '@/lib/data/company-health'
import { healthToXray } from '@/lib/data/health-xray'
import { isMockCompany } from '@/lib/data/adapters/mock'
import { NextResponse } from 'next/server'

/**
 * 统一出参接口：GET /api/company/:id/xray → CompanyXRay
 * 6 位代码/mock 主体=getXRay 全量管线（上市实时或离线演示）；
 * 其余 slug=非上市快照主体（健康评估管线，同报告页语义）。
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    if (/^\d{6}$/.test(id) || isMockCompany(id)) return NextResponse.json(await getXRay(id))
    const company = await findCompany(id)
    if (!company) return NextResponse.json({ error: 'COMPANY_NOT_FOUND', id }, { status: 404 })
    return NextResponse.json(healthToXray(await getCompanyHealth(company)))
  } catch (e) {
    if (e instanceof CompanyNotFoundError) {
      return NextResponse.json({ error: 'COMPANY_NOT_FOUND', id }, { status: 404 })
    }
    console.error('[xray] 生成失败:', e)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
