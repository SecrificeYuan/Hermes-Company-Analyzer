import { NextResponse } from 'next/server'
import { fetchFlashNews } from '@/lib/data/adapters/news'

export const dynamic = 'force-dynamic'

/** 7×24 财经快讯跑马灯（东财，60s 源站缓存） */
export async function GET() {
  try {
    const news = await fetchFlashNews(20)
    if (news.length === 0) return NextResponse.json({ ok: false, news: [] }, { status: 502 })
    return NextResponse.json({ ok: true, news })
  } catch {
    return NextResponse.json({ ok: false, news: [] }, { status: 502 })
  }
}
