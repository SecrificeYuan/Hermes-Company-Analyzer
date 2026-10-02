import { NextResponse } from 'next/server'
import { fetchTencentKline } from '@/lib/data/adapters/market'

export const dynamic = 'force-dynamic'

/** 日 K 线（腾讯前复权，5min 服务端缓存） */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const bars = await fetchTencentKline(id)
    if (bars.length === 0) return NextResponse.json({ ok: false, error: 'kline unavailable' }, { status: 502 })
    return NextResponse.json({ ok: true, data: bars })
  } catch {
    return NextResponse.json({ ok: false, error: 'kline fetch failed' }, { status: 502 })
  }
}
