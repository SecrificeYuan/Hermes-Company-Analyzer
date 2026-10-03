import robotsParser from 'robots-parser'
import type { CourtAnnouncement, CourtSearchResult } from '@/lib/types'
import { readCourtCache, writeCourtCache } from './court-cache'

const ORIGIN = 'https://rmfygg.court.gov.cn'
const LIST_URL = `${ORIGIN}/web/rmfyportal/noticeinfo?p_p_id=noticelist_WAR_rmfynoticeListportlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=initNoticeList&p_p_cacheability=cacheLevelPage&p_p_col_id=column-1&p_p_col_count=1`
const DETAIL_URL = `${ORIGIN}/web/rmfyportal/noticedetail?p_p_id=noticedetail_WAR_rmfynoticeDetailportlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=noticeDetail&p_p_cacheability=cacheLevelPage&p_p_col_id=column-1&p_p_col_count=1`
const AGENT = 'HermesCompanyAnalyzer/1.0'
const PAGE_SIZE = 15
const MAX_PAGES = 6
const MAX_DETAILS = 24
const MAX_BYTES = 1_000_000
const TIMEOUT_MS = 7000
const FRESH_CACHE_MS = 300_000
const HISTORY_MAX_MS = 7 * 24 * 3600_000
const prefix = '_noticelist_WAR_rmfynoticeListportlet_'
let robotsCache: { until: number; allowed: boolean } | undefined
const resultCache = new Map<string, { until: number; result: CourtSearchResult }>()

type Row = Record<string, unknown>

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function comparableName(value: string): string {
  return value.replace(/[\s()（）]/g, '')
}

function dateOf(value: unknown): string | null {
  const date = text(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null
}

export function courtWindow(now: Date): { from: string; to: string } {
  // 公告发布日期按中国日历日解释，避免北京时间凌晨落在前一个 UTC 日期。
  const chinaNow = new Date(now.getTime() + 8 * 3600_000)
  const year = chinaNow.getUTCFullYear() - 1
  const month = chinaNow.getUTCMonth()
  const day = Math.min(chinaNow.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate())
  const start = new Date(Date.UTC(year, month, day))
  return { from: start.toISOString().slice(0, 10), to: chinaNow.toISOString().slice(0, 10) }
}

function listBody(name: string, page: number): URLSearchParams {
  const aoData = [
    { name: 'sEcho', value: page }, { name: 'iColumns', value: 6 },
    { name: 'sColumns', value: ',,,,,' }, { name: 'iDisplayStart', value: page * PAGE_SIZE },
    { name: 'iDisplayLength', value: PAGE_SIZE },
    ...Array.from({ length: 6 }, (_, i) => ({ name: `mDataProp_${i}`, value: 'null' })),
  ]
  return new URLSearchParams({
    [`${prefix}content`]: '', [`${prefix}searchContent`]: name,
    [`${prefix}courtParam`]: '', [`${prefix}IEVersion`]: 'ie',
    [`${prefix}flag`]: 'click', [`${prefix}noticeTypeVal`]: '',
    [`${prefix}aoData`]: JSON.stringify(aoData),
  })
}

class CourtSourceError extends Error {
  constructor(readonly state: 'blocked' | 'unavailable', message: string) { super(message) }
}

async function limitedText(response: Response): Promise<string> {
  if (!response.body) throw new CourtSourceError('unavailable', '来源未返回正文')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_BYTES) {
        await reader.cancel()
        throw new CourtSourceError('unavailable', '来源响应过大')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(bytes)
}

async function allowedByRobots(budget: AbortSignal): Promise<boolean> {
  if (robotsCache && robotsCache.until > Date.now()) return robotsCache.allowed
  const response = await fetch(`${ORIGIN}/robots.txt`, {
    headers: { 'User-Agent': AGENT }, signal: AbortSignal.any([budget, AbortSignal.timeout(TIMEOUT_MS)]),
    cache: 'no-store', redirect: 'error',
  })
  if (![200, 404, 410].includes(response.status)) throw new CourtSourceError('blocked', '无法确认抓取规则')
  const body = response.status === 200 ? await limitedText(response) : ''
  const rules = robotsParser(`${ORIGIN}/robots.txt`, body)
  const allowed = [LIST_URL, DETAIL_URL].every((url) => rules.isAllowed(url, AGENT) !== false)
  robotsCache = { until: Date.now() + 3600_000, allowed }
  return allowed
}

async function postJson(url: string, body: URLSearchParams, budget: AbortSignal): Promise<Row> {
  const response = await fetch(url, {
    method: 'POST', body,
    headers: { 'User-Agent': AGENT, Accept: 'application/json', Referer: ORIGIN,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    signal: AbortSignal.any([budget, AbortSignal.timeout(TIMEOUT_MS)]), cache: 'no-store', redirect: 'error',
  })
  if ([401, 403, 405, 429].includes(response.status)) throw new CourtSourceError('blocked', `来源限制访问 (${response.status})`)
  if (!response.ok) throw new CourtSourceError('unavailable', `来源返回 ${response.status}`)
  try {
    const json: unknown = JSON.parse(await limitedText(response))
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('invalid JSON')
    return json as Row
  } catch (error) {
    if (error instanceof CourtSourceError) throw error
    throw new CourtSourceError('unavailable', '来源响应格式已变化')
  }
}

export function recordFromCourt(list: Row, detail: Row, name: string, window: { from: string; to: string }): CourtAnnouncement | null {
  const id = text(list.uuid)
  const date = dateOf(detail.publishDate ?? list.publishDate)
  const party = text(detail.tosendPeople ?? list.tosendPeople)
  const content = text(detail.noticeContent)
  if (!/^\d{1,30}$/.test(id) || !date || date < window.from || date > window.to ||
    !(comparableName(party).includes(comparableName(name)) || comparableName(content).includes(comparableName(name)))) return null
  const type = text(detail.noticeType ?? list.noticeType) || '其他公告'
  const title = text(detail.noniceTitle) || `${type} · ${party}`
  const summary = content.replace(/\d{11,18}/g, '***').slice(0, 180)
  return {
    id, source: '人民法院公告网', date, type: type.slice(0, 60), party: party.slice(0, 240),
    publisher: (text(detail.court ?? list.court) || '发布机构未标明').slice(0, 120),
    title: title.slice(0, 240), summary, url: `${ORIGIN}/web/rmfyportal/noticedetail?paramStr=${encodeURIComponent(id)}`,
  }
}

export async function searchCourtAnnouncements(name: string | null, now = new Date()): Promise<CourtSearchResult> {
  const window = courtWindow(now)
  const base: CourtSearchResult = {
    status: 'unavailable', queryName: name, ...window, fetchedAt: now.toISOString(),
    records: [], totalReported: null, inspected: 0,
  }
  if (!name || !/(?:有限公司|有限责任公司|股份有限公司)$/.test(name) || name.length > 100) {
    return { ...base, status: 'identity_unverified', queryName: null, message: '缺少经核实的公司全称' }
  }
  const key = `${name}|${window.from}|${window.to}`
  const cached = resultCache.get(key)
  if (cached && cached.until > Date.now() &&
    cached.result.status !== 'blocked' && cached.result.status !== 'unavailable' &&
    !(cached.result.status === 'partial' && !cached.result.historical && cached.result.records.length === 0)) {
    return cached.result
  }
  const disk = await readCourtCache(name)
  const cacheAge = disk ? Date.now() - Date.parse(disk.fetchedAt) : Infinity
  if (disk && cacheAge >= 0 && cacheAge < FRESH_CACHE_MS && disk.from === window.from && disk.to === window.to) {
    resultCache.set(key, { result: disk, until: Date.now() + FRESH_CACHE_MS - cacheAge })
    return disk
  }
  if (cached && cached.until > Date.now() && !disk) return cached.result
  const remember = async (result: CourtSearchResult): Promise<CourtSearchResult> => {
    const previous = [cached?.result, disk]
      .filter((item): item is CourtSearchResult => Boolean(item && !item.historical &&
        (item.status === 'available' || item.status === 'empty' ||
          (item.status === 'partial' && item.records.length > 0))))
      .sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))[0]
    const previousAge = previous ? Date.now() - Date.parse(previous.fetchedAt) : Infinity
    const usablePrevious = previous && previousAge >= 0 && previousAge < HISTORY_MAX_MS
    const historicalRecords = usablePrevious
      ? previous.records.filter((item) => item.date >= window.from && item.date <= window.to)
      : []
    const served: CourtSearchResult = (result.status === 'blocked' || result.status === 'unavailable') && usablePrevious
      ? { ...previous, from: window.from, to: window.to, records: historicalRecords, status: 'partial', historical: true,
          message: historicalRecords.length
            ? '来源当前受限；以下为此前抓取的历史公告，尚未完成实时复核，结果可能不完整。'
            : '来源当前受限；此前快照没有处于当前日期范围的公告，尚未完成实时复核，不能据此判断当前无公告。' }
      : result
    if (result.status === 'available' || result.status === 'empty' || (result.status === 'partial' && result.records.length > 0)) {
      try { await writeCourtCache(name, result) }
      catch (error) { console.warn('[court-cache] 保存失败', error) }
    }
    const ttl = served.status === 'partial' ? 600_000 : served.status === 'available' || served.status === 'empty' ? 300_000 : served.status === 'blocked' ? 120_000 : 30_000
    if (resultCache.size >= 100) resultCache.delete(resultCache.keys().next().value!)
    resultCache.set(key, { result: served, until: Date.now() + ttl })
    return served
  }
  const budget = AbortSignal.timeout(20_000)
  try {
    if (!await allowedByRobots(budget)) return remember({ ...base, status: 'blocked', message: '来源不允许自动读取' })
    const matches: Row[] = []
    const seen = new Set<string>()
    let total = 0
    let inspected = 0
    let capped = false
    for (let page = 0; page < MAX_PAGES; page++) {
      let json: Row
      try { json = await postJson(LIST_URL, listBody(name, page), budget) }
      catch (error) {
        if (page === 0) throw error
        capped = true
        break
      }
      if (!Array.isArray(json.data) || !Number.isFinite(Number(json.iTotalRecords))) {
        throw new CourtSourceError('unavailable', '列表响应格式已变化')
      }
      total = Math.max(total, Number(json.iTotalRecords))
      inspected += json.data.length
      for (const item of json.data) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue
        const row = item as Row
        const id = text(row.uuid)
        const date = dateOf(row.publishDate)
        if (!/^\d{1,30}$/.test(id) || seen.has(id) || !date || date < window.from || date > window.to) continue
        seen.add(id)
        if (matches.length < MAX_DETAILS) matches.push(row)
        else capped = true
      }
      if (inspected >= total || json.data.length === 0) break
      if (page === MAX_PAGES - 1) capped = true
    }
    const records: CourtAnnouncement[] = []
    let detailFailures = 0
    for (let offset = 0; offset < matches.length; offset += 4) {
      if (offset > 0) await new Promise((resolve) => setTimeout(resolve, 250))
      if (budget.aborted) { detailFailures += matches.length - offset; break }
      const batch = await Promise.allSettled(matches.slice(offset, offset + 4).map(async (row) => {
        const detail = await postJson(DETAIL_URL, new URLSearchParams({
          _noticedetail_WAR_rmfynoticeDetailportlet_uuid: text(row.uuid),
        }), budget)
        return recordFromCourt(row, detail, name, window)
      }))
      let blocked = false
      for (const result of batch) {
        if (result.status === 'rejected') {
          detailFailures++
          if (result.reason instanceof CourtSourceError && result.reason.state === 'blocked') blocked = true
        }
        else if (result.value) records.push(result.value)
      }
      if (blocked || budget.aborted) { detailFailures += matches.length - offset - batch.length; break }
    }
    records.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    const partial = capped || detailFailures > 0
    return remember({
      ...base, status: partial ? 'partial' : records.length ? 'available' : 'empty',
      records, totalReported: total, inspected,
      ...(partial ? { message: '来源结果超过读取上限或部分详情未取回；展示结果不代表全部记录。' } : {}),
    })
  } catch (error) {
    const state = error instanceof CourtSourceError ? error.state : 'unavailable'
    return remember({ ...base, status: state, message: state === 'blocked' ? '来源限制访问或需要验证' : '法院公告网暂时不可用' })
  }
}
