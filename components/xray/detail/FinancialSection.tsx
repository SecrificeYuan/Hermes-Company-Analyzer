'use client'
import { CashFlowChart } from '../CashFlowChart'
import type { CompanyXRay } from '@/lib/types'

export function FinancialSection({ xray }: { xray: CompanyXRay }) {
  return <CashFlowChart hp={xray.hp} height={300} />
}
