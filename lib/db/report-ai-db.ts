// 报告页 AI 点评的服务端缓存（Node 内置 node:sqlite，零原生依赖）。
// 全网同一家公司同一数据快照（report_id + as_of）只需生成一次 LLM，
// 之后任何人打开都直接读库回放。db 文件不可写（serverless 等）时整体降级为无缓存。
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

export interface ReportAiRow {
  summary: string
  lightReason: string
  /** 五维短评 JSON 字符串 */
  sectionNotes: string
  model: string
  generatedAt: string
}

let db: DatabaseSync | null | undefined // undefined=未初始化 null=不可用

function openDbAt(file: string): DatabaseSync | null {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const instance = new DatabaseSync(file)
    instance.exec(`
      CREATE TABLE IF NOT EXISTS report_ai (
        report_id    TEXT NOT NULL,
        as_of        TEXT NOT NULL,
        summary      TEXT NOT NULL,
        light_reason TEXT NOT NULL DEFAULT '',
        section_notes TEXT NOT NULL DEFAULT '{}',
        model        TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        PRIMARY KEY (report_id, as_of)
      )
    `)
    // 对比页深度对比缓存：同一对公司同一对数据快照只生成一次
    instance.exec(`
      CREATE TABLE IF NOT EXISTS compare_ai (
        cache_key        TEXT PRIMARY KEY,
        summary          TEXT NOT NULL,
        verdict          TEXT NOT NULL DEFAULT '',
        dimension_notes  TEXT NOT NULL DEFAULT '{}',
        model            TEXT NOT NULL,
        generated_at     TEXT NOT NULL
      )
    `)
    return instance
  } catch {
    return null
  }
}

function getDb(): DatabaseSync | null {
  if (db !== undefined) return db
  db = openDbAt(path.join(process.cwd(), 'data', 'report-ai.db'))
  return db
}

export function getReportAi(reportId: string, asOf: string): ReportAiRow | null {
  const d = getDb()
  if (!d) return null
  try {
    const row = d
      .prepare('SELECT summary, light_reason, section_notes, model, generated_at FROM report_ai WHERE report_id = ? AND as_of = ?')
      .get(reportId, asOf) as unknown
    if (!row || typeof row !== 'object') return null
    const r = row as Record<string, unknown>
    return {
      summary: String(r.summary ?? ''),
      lightReason: String(r.light_reason ?? ''),
      sectionNotes: String(r.section_notes ?? '{}'),
      model: String(r.model ?? ''),
      generatedAt: String(r.generated_at ?? ''),
    }
  } catch {
    return null
  }
}

export function saveReportAi(
  reportId: string,
  asOf: string,
  row: ReportAiRow,
): void {
  const d = getDb()
  if (!d) return
  try {
    d.prepare(`
      INSERT INTO report_ai (report_id, as_of, summary, light_reason, section_notes, model, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (report_id, as_of) DO UPDATE SET
        summary = excluded.summary,
        light_reason = excluded.light_reason,
        section_notes = excluded.section_notes,
        model = excluded.model,
        generated_at = excluded.generated_at
    `).run(reportId, asOf, row.summary, row.lightReason, row.sectionNotes, row.model, row.generatedAt)
  } catch {
    // 写失败仅损失缓存，不影响当次输出
  }
}

/** 测试专用：重置连接并指向指定文件（:memory: 亦可） */
export function __resetReportAiDbForTest(file?: string): void {
  try {
    db?.close()
  } catch {
    // 已关闭
  }
  db = file ? openDbAt(file) : undefined
}

export interface CompareAiRow {
  summary: string
  verdict: string
  /** 五维对比短评 JSON 字符串 */
  dimensionNotes: string
  model: string
  generatedAt: string
}

export function getCompareAi(cacheKey: string): CompareAiRow | null {
  const d = getDb()
  if (!d) return null
  try {
    const row = d
      .prepare('SELECT summary, verdict, dimension_notes, model, generated_at FROM compare_ai WHERE cache_key = ?')
      .get(cacheKey) as unknown
    if (!row || typeof row !== 'object') return null
    const r = row as Record<string, unknown>
    return {
      summary: String(r.summary ?? ''),
      verdict: String(r.verdict ?? ''),
      dimensionNotes: String(r.dimension_notes ?? '{}'),
      model: String(r.model ?? ''),
      generatedAt: String(r.generated_at ?? ''),
    }
  } catch {
    return null
  }
}

export function saveCompareAi(cacheKey: string, row: CompareAiRow): void {
  const d = getDb()
  if (!d) return
  try {
    d.prepare(`
      INSERT INTO compare_ai (cache_key, summary, verdict, dimension_notes, model, generated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (cache_key) DO UPDATE SET
        summary = excluded.summary,
        verdict = excluded.verdict,
        dimension_notes = excluded.dimension_notes,
        model = excluded.model,
        generated_at = excluded.generated_at
    `).run(cacheKey, row.summary, row.verdict, row.dimensionNotes, row.model, row.generatedAt)
  } catch {
    // 写失败仅损失缓存，不影响当次输出
  }
}
