import { NextResponse } from 'next/server'
import { getSentimentSnapshot } from '@/lib/data/sentiment'

/**
 * 独立慢数据接口。报告 SSR 不调用这里，因此东方财富的长尾响应不会阻塞财务、
 * 股权、司法和行情模块。客户端会在六秒后继续显示非阻塞加载状态。
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d{6}$/.test(id)) {
    return NextResponse.json({ error: 'INVALID_STOCK_CODE' }, { status: 400 })
  }
  const rawPage = new URL(request.url).searchParams.get('page') ?? '1'
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : NaN
  if (!Number.isInteger(page) || page < 1 || page > 17) {
    return NextResponse.json({ error: 'INVALID_SENTIMENT_PAGE' }, { status: 400 })
  }
  const snapshot = await getSentimentSnapshot(id, page)
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  })
}
