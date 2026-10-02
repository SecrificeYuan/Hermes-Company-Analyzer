import { NextResponse } from 'next/server'
import { fetchEastmoneyFundFlow, toSecid } from '@/lib/data/adapters/market'

export const dynamic = 'force-dynamic'

/** 资金流日 K（东财，5min 服务端缓存） */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const secid = toSecid(id)
  if (!secid) return NextResponse.json({ ok: false, error: 'invalid code' }, { status: 400 })
  try {
    const days = await fetchEastmoneyFundFlow(secid)
    if (days.length === 0) return NextResponse.json({ ok: false, error: 'fundflow unavailable' }, { status: 502 })
    return NextResponse.json({ ok: true, data: days })
  } catch {
    return NextResponse.json({ ok: false, error: 'fundflow fetch failed' }, { status: 502 })
  }
}
