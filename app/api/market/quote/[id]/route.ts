import { NextResponse } from 'next/server'
import { fetchTencentQuote } from '@/lib/data/adapters/market'

export const dynamic = 'force-dynamic'

/** 实时行情快照（腾讯 qt.gtimg.cn，15s 服务端缓存） */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const quote = await fetchTencentQuote(id)
    if (!quote) return NextResponse.json({ ok: false, error: 'quote unavailable' }, { status: 502 })
    return NextResponse.json({ ok: true, data: quote })
  } catch {
    return NextResponse.json({ ok: false, error: 'quote fetch failed' }, { status: 502 })
  }
}
