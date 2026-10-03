import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rmdir, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readCourtCache, writeCourtCache } from './court-cache'
import type { CourtSearchResult } from '@/lib/types'

const name = '测试股份有限公司'
const result: CourtSearchResult = {
  status: 'available', queryName: name, from: '2025-10-03', to: '2026-10-03',
  fetchedAt: '2026-10-03T12:00:00.000Z', totalReported: 1, inspected: 1,
  records: [{ id: '12345', source: '人民法院公告网', date: '2026-10-01', type: '送达公告',
    party: name, publisher: '测试法院', title: '送达公告', summary: '',
    url: 'https://rmfygg.court.gov.cn/web/rmfyportal/noticedetail?paramStr=12345' }],
}

let tempDir: string
beforeEach(async () => { tempDir = await mkdtemp(path.join(os.tmpdir(), 'court-cache-test-')) })
afterEach(async () => {
  for (const file of await readdir(tempDir)) await unlink(path.join(tempDir, file))
  await rmdir(tempDir)
})

describe('法院公告本地 JSON 快照', () => {
  it('成功结果按主体单独写入并可读回', async () => {
    await writeCourtCache(name, result, tempDir)
    expect(await readCourtCache(name, tempDir)).toEqual(result)
    expect(await readCourtCache('另一家股份有限公司', tempDir)).toBeNull()
    expect(await readdir(tempDir)).toHaveLength(1)
  })

  it('拒绝损坏文件和主体不匹配的内容', async () => {
    await writeCourtCache(name, result, tempDir)
    const [file] = await readdir(tempDir)
    await writeFile(path.join(tempDir, file), '{bad json')
    expect(await readCourtCache(name, tempDir)).toBeNull()
    await writeFile(path.join(tempDir, file), JSON.stringify({ version: 1,
      result: { ...result, queryName: '另一家股份有限公司' } }))
    expect(await readCourtCache(name, tempDir)).toBeNull()
  })

  it('仅保存有效来源链接和可复核的部分结果', async () => {
    await writeCourtCache(name, { ...result, records: [{ ...result.records[0], url: 'https://evil.example/12345' }] }, tempDir)
    await writeCourtCache(name, { ...result, status: 'partial', records: [] }, tempDir)
    expect(await readdir(tempDir)).toHaveLength(0)
    await writeCourtCache(name, { ...result, status: 'partial' }, tempDir)
    const [file] = await readdir(tempDir)
    expect(JSON.parse(await readFile(path.join(tempDir, file), 'utf8')).version).toBe(1)
  })
})
