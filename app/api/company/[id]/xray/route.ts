import { getXRay } from '@/lib/get-xray'
import { CompanyNotFoundError } from '@/lib/data/fetcher'
import { NextResponse } from 'next/server'

/**
 * 统一出参接口：GET /api/company/:id/xray → CompanyXRay
 * 前端（含 compare 页）与第三方调用的唯一 HTTP 入口。
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const xray = await getXRay(id)
    return NextResponse.json(xray)
  } catch (e) {
    if (e instanceof CompanyNotFoundError) {
      return NextResponse.json({ error: 'COMPANY_NOT_FOUND', id }, { status: 404 })
    }
    console.error('[xray] 生成失败:', e)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
