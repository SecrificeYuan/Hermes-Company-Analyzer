'use client'
import { SentimentCurve } from '../SentimentCurve'
import type { CompanyXRay } from '@/lib/types'

export function SentimentSection({ xray }: { xray: CompanyXRay }) {
  return <SentimentCurve morale={xray.morale} height={280} />
}
