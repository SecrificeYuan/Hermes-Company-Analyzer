'use client'
import { RelationGraph } from '../RelationGraph'
import type { CompanyXRay } from '@/lib/types'

export function NetworkSection({ xray }: { xray: CompanyXRay }) {
  return <RelationGraph graph={xray.graph} height={380} />
}
