import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CourtAnnouncement, CourtSearchResult } from '@/lib/types'

const MAX_CACHE_BYTES = 256_000
const DETAIL_BASE = 'https://rmfygg.court.gov.cn/web/rmfyportal/noticedetail?paramStr='

function directory(): string {
  return path.join(process.cwd(), '.data', 'court-announcements')
}

function fileFor(name: string, dir: string): string {
  return path.join(dir, `${createHash('sha256').update(name).digest('hex')}.json`)
}

function validRecord(value: unknown): value is CourtAnnouncement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && /^\d{1,30}$/.test(item.id) &&
    item.source === '人民法院公告网' &&
    typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    typeof item.type === 'string' && item.type.length <= 60 &&
    typeof item.party === 'string' && item.party.length <= 240 &&
    typeof item.publisher === 'string' && item.publisher.length <= 120 &&
    typeof item.title === 'string' && item.title.length <= 240 &&
    typeof item.summary === 'string' && item.summary.length <= 180 &&
    item.url === `${DETAIL_BASE}${item.id}`
}

function validResult(value: unknown, name: string): value is CourtSearchResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const result = value as Record<string, unknown>
  return result.queryName === name &&
    ['available', 'empty', 'partial'].includes(String(result.status)) &&
    typeof result.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.from) &&
    typeof result.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.to) &&
    typeof result.fetchedAt === 'string' && Number.isFinite(Date.parse(result.fetchedAt)) &&
    result.historical !== true &&
    (result.message === undefined || typeof result.message === 'string' && result.message.length <= 500) &&
    (result.totalReported === null || Number.isSafeInteger(result.totalReported) && Number(result.totalReported) >= 0) &&
    Number.isSafeInteger(result.inspected) && Number(result.inspected) >= 0 &&
    Array.isArray(result.records) && result.records.length <= 24 && result.records.every(validRecord) &&
    (result.status !== 'partial' || result.records.length > 0) &&
    (result.status !== 'available' || result.records.length > 0) &&
    (result.status !== 'empty' || result.records.length === 0)
}

/** Only reads a bounded, versioned snapshot for this exact verified legal name. */
export async function readCourtCache(name: string, dir = directory()): Promise<CourtSearchResult | null> {
  try {
    const file = fileFor(name, dir)
    if ((await stat(file)).size > MAX_CACHE_BYTES) return null
    const stored: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return null
    const snapshot = stored as { version?: unknown; result?: unknown }
    return snapshot.version === 1 && validResult(snapshot.result, name) ? snapshot.result : null
  } catch { return null }
}

/** Writes a successful search atomically; the directory is already ignored by Git. */
export async function writeCourtCache(name: string, result: CourtSearchResult, dir = directory()): Promise<void> {
  if (!validResult(result, name)) return
  const payload = JSON.stringify({ version: 1, result })
  if (Buffer.byteLength(payload) > MAX_CACHE_BYTES) return
  await mkdir(dir, { recursive: true })
  const temporary = path.join(dir, `.${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, payload, { encoding: 'utf8', flag: 'wx' })
    await rename(temporary, fileFor(name, dir))
  } finally {
    await unlink(temporary).catch(() => undefined)
  }
}
