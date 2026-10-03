import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cache = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }))
vi.mock('./court-cache', () => ({ readCourtCache: cache.read, writeCourtCache: cache.write }))

const fullName = '长沙丽康丽尔医疗美容有限公司'
const now = new Date('2026-10-03T12:00:00.000Z')

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.resetModules()
  cache.read.mockReset().mockResolvedValue(null)
  cache.write.mockReset().mockResolvedValue(undefined)
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('人民法院公告网查询', () => {
  it('先核实公司全称，缺失时不请求来源', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { searchCourtAnnouncements } = await import('./court-announcements')
    const result = await searchCourtAnnouncements(null, now)
    expect(result.status).toBe('identity_unverified')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('按全称查询，保留近 12 个月详情并排除过期公告', async () => {
    const fetch = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow:\n', { status: 200 })
      if (url.includes('/noticeinfo?')) {
        expect(String(options?.body)).toContain(encodeURIComponent(fullName))
        return json({ iTotalRecords: 2, data: [
          { uuid: '6092913782511708', publishDate: '2026-10-01', tosendPeople: fullName, noticeType: '仲裁文书' },
          { uuid: '6092913782511709', publishDate: '2025-10-02', tosendPeople: fullName, noticeType: '裁判文书' },
        ] })
      }
      return json({ uuid: '6092913782511708', publishDate: '2026-10-01', tosendPeople: fullName,
        noticeType: '仲裁文书', court: '非法院单位', noniceTitle: '仲裁文书送达公告',
        noticeContent: `${fullName}：本会公告送达文书。` })
    })
    vi.stubGlobal('fetch', fetch)
    const { searchCourtAnnouncements } = await import('./court-announcements')
    const result = await searchCourtAnnouncements(fullName, now)
    expect(result).toMatchObject({ status: 'available', from: '2025-10-03', to: '2026-10-03',
      totalReported: 2, inspected: 2 })
    expect(result.records).toHaveLength(1)
    expect(result.records[0]).toMatchObject({ type: '仲裁文书', publisher: '非法院单位',
      url: 'https://rmfygg.court.gov.cn/web/rmfyportal/noticedetail?paramStr=6092913782511708' })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(cache.write).toHaveBeenCalledWith(fullName, result)
    expect(await searchCourtAnnouncements(fullName, now)).toEqual(result)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('详情读取失败时标记部分结果，不冒充无公告', async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow:\n')
      if (url.includes('/noticeinfo?')) return json({ iTotalRecords: 1, data: [
        { uuid: '6092913782511708', publishDate: '2026-10-01', tosendPeople: fullName },
      ] })
      return new Response('error', { status: 503 })
    })
    vi.stubGlobal('fetch', fetch)
    const { searchCourtAnnouncements } = await import('./court-announcements')
    const result = await searchCourtAnnouncements(fullName, now)
    expect(result.status).toBe('partial')
    expect(result.records).toHaveLength(0)
    expect(result.message).toContain('不代表全部记录')
    expect(cache.write).not.toHaveBeenCalled()
  })

  it('列表超过分页上限时标记部分结果，即使当前页无近期记录', async () => {
    let pages = 0
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow:\n')
      pages++
      return json({ iTotalRecords: 200, data: Array.from({ length: 15 }, (_, i) => ({
        uuid: String(pages * 100 + i), publishDate: '2024-01-01', tosendPeople: fullName,
      })) })
    })
    vi.stubGlobal('fetch', fetch)
    const { searchCourtAnnouncements } = await import('./court-announcements')
    const result = await searchCourtAnnouncements(fullName, now)
    expect(result).toMatchObject({ status: 'partial', totalReported: 200, inspected: 90, records: [] })
    expect(pages).toBe(6)
  })

  it('来源短暂限流时保留先前读到的公告并标注部分结果', async () => {
    let clock = now.getTime()
    vi.spyOn(Date, 'now').mockImplementation(() => clock)
    let listCalls = 0
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow:\n')
      if (url.includes('/noticeinfo?')) {
        listCalls++
        return listCalls === 1 ? json({ iTotalRecords: 1, data: [
          { uuid: '6092913782511708', publishDate: '2026-10-01', tosendPeople: fullName },
        ] }) : new Response('limited', { status: 429 })
      }
      return json({ publishDate: '2026-10-01', tosendPeople: fullName, noticeContent: fullName })
    })
    vi.stubGlobal('fetch', fetch)
    const { searchCourtAnnouncements } = await import('./court-announcements')
    expect((await searchCourtAnnouncements(fullName, now)).records).toHaveLength(1)
    clock += 301_000
    const repeated = await searchCourtAnnouncements(fullName, now)
    expect(repeated.status).toBe('partial')
    expect(repeated.records).toHaveLength(1)
    expect(repeated.historical).toBe(true)
    expect(repeated.message).toContain('历史公告')
  })

  it('进程重启后读取磁盘快照；限流时保留抓取时间并标明历史', async () => {
    let clock = now.getTime()
    vi.spyOn(Date, 'now').mockImplementation(() => clock)
    const snapshot = {
      status: 'available' as const, queryName: fullName, from: '2025-10-03', to: '2026-10-03',
      fetchedAt: now.toISOString(), totalReported: 1, inspected: 1,
      records: [{ id: '6092913782511708', source: '人民法院公告网' as const, date: '2026-10-01',
        type: '仲裁文书', party: fullName, publisher: '公告机构', title: '送达公告', summary: '',
        url: 'https://rmfygg.court.gov.cn/web/rmfyportal/noticedetail?paramStr=6092913782511708' }],
    }
    cache.read.mockResolvedValue(snapshot)
    const fetch = vi.fn(async (url: string) => url.endsWith('/robots.txt')
      ? new Response('User-agent: *\nDisallow:\n') : new Response('limited', { status: 429 }))
    vi.stubGlobal('fetch', fetch)
    const { searchCourtAnnouncements } = await import('./court-announcements')
    expect(await searchCourtAnnouncements(fullName, now)).toEqual(snapshot)
    expect(fetch).not.toHaveBeenCalled()
    clock += 301_000
    const historical = await searchCourtAnnouncements(fullName, now)
    expect(historical).toMatchObject({ status: 'partial', historical: true,
      fetchedAt: snapshot.fetchedAt, records: snapshot.records })
    expect(historical.message).toContain('尚未完成实时复核')
    expect(cache.write).not.toHaveBeenCalled()
  })

  it('跨日回退仅显示当前窗口公告；旧空快照不冒充本次零结果', async () => {
    const nextDay = new Date('2026-10-04T12:00:00.000Z')
    vi.spyOn(Date, 'now').mockReturnValue(nextDay.getTime())
    cache.read.mockResolvedValue({
      status: 'empty', queryName: fullName, from: '2025-10-03', to: '2026-10-03',
      fetchedAt: now.toISOString(), totalReported: 0, inspected: 0, records: [],
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('limited', { status: 429 })))
    const { searchCourtAnnouncements } = await import('./court-announcements')
    const result = await searchCourtAnnouncements(fullName, nextDay)
    expect(result).toMatchObject({ status: 'partial', historical: true,
      from: '2025-10-04', to: '2026-10-04', records: [] })
    expect(result.message).toContain('不能据此判断当前无公告')
  })

  it('进程内失败状态不遮盖随后出现的磁盘快照', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now.getTime())
    vi.stubGlobal('fetch', vi.fn(async () => new Response('limited', { status: 429 })))
    const { searchCourtAnnouncements } = await import('./court-announcements')
    expect((await searchCourtAnnouncements(fullName, now)).status).toBe('blocked')
    cache.read.mockResolvedValue({
      status: 'available', queryName: fullName, from: '2025-10-03', to: '2026-10-03',
      fetchedAt: new Date(now.getTime() - 3600_000).toISOString(), totalReported: 1, inspected: 1,
      records: [{ id: '12345', source: '人民法院公告网', date: '2026-10-01',
        type: '送达公告', party: fullName, publisher: '测试法院', title: '送达公告', summary: '',
        url: 'https://rmfygg.court.gov.cn/web/rmfyportal/noticedetail?paramStr=12345' }],
    })
    const recovered = await searchCourtAnnouncements(fullName, now)
    expect(recovered).toMatchObject({ status: 'partial', historical: true })
    expect(recovered.records).toHaveLength(1)
  })

  it('闰年起点按上年最后一个有效日计算', async () => {
    const { courtWindow } = await import('./court-announcements')
    expect(courtWindow(new Date('2028-02-29T00:00:00Z')).from).toBe('2027-02-28')
    expect(courtWindow(new Date('2026-10-02T16:30:00Z')).to).toBe('2026-10-03')
  })
})
