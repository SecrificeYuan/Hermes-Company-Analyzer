import { notFound } from 'next/navigation'
import { XrayClient } from '@/components/xray/XrayClient'
import { getXRay } from '@/lib/get-xray'
import { CompanyNotFoundError } from '@/lib/data/fetcher'
import { findCompany, getCompanyHealth } from '@/lib/data/company-health'
import { healthToXray } from '@/lib/data/health-xray'
import { isMockCompany } from '@/lib/data/adapters/mock'

export const dynamic = 'force-dynamic'

/**
 * X 光片报告页（Server Component）：
 * 服务端直接调用 getXRay（与 API Route 同一入口），免自请求 HTTP。
 */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Keep the established X-ray report as the primary company presentation.
  // The health report remains available for discovered, unlisted companies.
  if (/^\d{6}$/.test(id) || isMockCompany(id)) {
    try {
      return <XrayClient xray={await getXRay(id)} />
    } catch (error) {
      if (error instanceof CompanyNotFoundError) notFound()
      throw error
    }
  }
  const company = await findCompany(id)
  if (!company) notFound()
  const health = await getCompanyHealth(company)
  return <XrayClient xray={healthToXray(health)} health={health} />
}
