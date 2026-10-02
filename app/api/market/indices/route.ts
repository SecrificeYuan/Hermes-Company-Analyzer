import { NextResponse } from 'next/server'
import { fetchGlobalIndices } from '@/lib/data/adapters/market'

export const dynamic = 'force-dynamic'

/** 全球指数跑马灯：腾讯批量快照（30s 源站缓存） */
export async function GET() {
  try {
    const indices = await fetchGlobalIndices()
    if (indices.length === 0) return NextResponse.json({ ok: false, indices: [] }, { status: 502 })
    return NextResponse.json({ ok: true, indices })
  } catch {
    return NextResponse.json({ ok: false, indices: [] }, { status: 502 })
  }
}
