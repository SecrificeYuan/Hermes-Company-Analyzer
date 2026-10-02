// app/compare/page.tsx
import { CompareClient } from '@/components/compare/CompareClient'
import { parseCompareParams } from '@/lib/compare-params'

export const dynamic = 'force-dynamic'

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const initial = parseCompareParams({
    a: typeof sp.a === 'string' ? sp.a : undefined,
    b: typeof sp.b === 'string' ? sp.b : undefined,
  })
  return <CompareClient initialPick={initial} />
}
