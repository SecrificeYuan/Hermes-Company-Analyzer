import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { FinancialYear, RawCompanyData } from '@/lib/types'
import type { DataAdapter } from '../adapter'

interface Snapshot {
  company?: { name?: unknown; stockCode?: unknown }
  financial?: { years?: unknown }
}

export async function readAkshareSnapshot(companyId: string): Promise<Snapshot | null> {
  try {
    if (!/^\d{6}$/.test(companyId)) return null
    const file = path.join(process.cwd(), 'data', 'akshare', `${companyId}.json`)
    return JSON.parse(await readFile(file, 'utf-8')) as Snapshot
  } catch {
    return null
  }
}

/**
 * A 股财务适配器（AKShare）。
 *
 * 黑客松策略：离线预跑 scripts/prefetch-akshare.py，把财务 JSON 落到
 * data/akshare/<companyId>.json，运行时直接读文件，避免现场依赖 Python。
 *
 */
export const akshareAdapter: DataAdapter = {
  name: 'akshare',
  async fetch(companyId): Promise<Partial<RawCompanyData> | null> {
    try {
      const snapshot = await readAkshareSnapshot(companyId)
      const years = snapshot?.financial?.years
      const name = snapshot?.company?.name
      const stockCode = snapshot?.company?.stockCode
      if (!Array.isArray(years) || years.length === 0 || typeof name !== 'string' || !name.trim()) return null
      if (typeof stockCode !== 'string' || !/^\d{6}\.(SH|SZ|BJ)$/.test(stockCode) || !stockCode.startsWith(companyId)) return null
      if (!years.every((year) =>
        year && typeof year === 'object' && /^\d{4}$/.test(year.year) &&
        ['revenue', 'netProfit', 'operatingCashFlow', 'debtRatio', 'currentRatio']
          .every((key) => typeof year[key] === 'number' && Number.isFinite(year[key])) &&
        year.revenue >= 0 && year.currentRatio >= 0 && year.debtRatio >= 0,
      )) return null

      return {
        meta: {
          id: companyId,
          name: name.trim(),
          stockCode,
          industry: '未知行业',
          fetchedAt: new Date().toISOString(),
          sources: [],
        },
        financial: { years: years as FinancialYear[] },
      }
    } catch {
      return null // 文件不存在或格式错误 → 静默降级
    }
  },
}
