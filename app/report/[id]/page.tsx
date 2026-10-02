import { notFound } from 'next/navigation'
import { XrayClient } from '@/components/xray/XrayClient'
import { getXRay } from '@/lib/get-xray'
import { CompanyNotFoundError } from '@/lib/data/fetcher'

export const dynamic = 'force-dynamic'

/**
 * X 光片报告页（Server Component）：
 * 服务端直接调用 getXRay（与 API Route 同一入口），免自请求 HTTP。
 */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let xray
  try {
    xray = await getXRay(id)
  } catch (e) {
    if (e instanceof CompanyNotFoundError) notFound()
    throw e
  }
  return <XrayClient xray={xray} />
}
