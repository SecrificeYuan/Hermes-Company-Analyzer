import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { RawCompanyData } from '@/lib/types'
import type { DataAdapter } from '../adapter'

/**
 * A 股财务适配器（AKShare）。
 *
 * 黑客松策略：离线预跑 scripts/prefetch-akshare.py，把财务 JSON 落到
 * data/akshare/<companyId>.json，运行时直接读文件，避免现场依赖 Python。
 *
 * TODO(feat/data-engine)：若时间充裕，可改为 Python 子进程实时调用 akshare。
 */
export const akshareAdapter: DataAdapter = {
  name: 'akshare',
  async fetch(companyId): Promise<Partial<RawCompanyData> | null> {
    try {
      const file = path.join(process.cwd(), 'data', 'akshare', `${companyId}.json`)
      const raw = await readFile(file, 'utf-8')
      const parsed = JSON.parse(raw)
      if (!parsed?.financial?.years?.length) return null
      return { financial: parsed.financial }
    } catch {
      return null // 文件不存在或格式错误 → 静默降级
    }
  },
}
