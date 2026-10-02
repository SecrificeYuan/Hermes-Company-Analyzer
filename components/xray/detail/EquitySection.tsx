'use client'
import { StatNumber } from '../StatNumber'
import { useTokens } from '@/lib/theme/use-tokens'
import type { CompanyXRay } from '@/lib/types'

/** 股权与质押（第一期）：质押比例大数字 + 预警状态；桑基图第三期接入 */
export function EquitySection({ xray }: { xray: CompanyXRay }) {
  const t = useTokens()
  const p = xray.def.pledgeRatio
  const color = p >= 60 ? t.riskColor.red : p >= 40 ? t.riskColor.yellow : t.riskColor.green
  const status = p >= 60 ? '已爆预警线' : p >= 40 ? '逼近预警线' : '未质押警戒'

  return (
    <div className="flex items-center gap-8">
      <div>
        <div className="flex items-baseline gap-2">
          <StatNumber value={p} className="text-5xl font-extrabold" duration={1.2} />
          <span className="text-2xl font-bold" style={{ color }}>%</span>
        </div>
        <div className="mt-1 font-mono text-[11px] text-slate-500">股权质押比例 · {status}</div>
      </div>
      <div className="font-mono text-xs leading-relaxed text-slate-400">
        实控人质押占总股本 {xray.def.pledgeRatio}%<br />
        资产覆盖率 {xray.def.assetCoverage}
      </div>
    </div>
  )
}
