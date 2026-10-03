'use client'

import { useEffect, useState } from 'react'
import type { CourtSearchResult } from '@/lib/types'

export function useCourtAnnouncements(id: string): CourtSearchResult | null {
  const [result, setResult] = useState<CourtSearchResult | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    fetch(`/api/company/${encodeURIComponent(id)}/court`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Court API ${response.status}`)
        return response.json() as Promise<CourtSearchResult>
      })
      .then((data) => { if (!controller.signal.aborted) setResult(data) })
      .catch(() => {
        if (!controller.signal.aborted) setResult({
          status: 'unavailable', queryName: null, from: '', to: '',
          fetchedAt: new Date().toISOString(), records: [], totalReported: null,
          inspected: 0, message: '法院公告查询暂不可用',
        })
      })
    return () => controller.abort()
  }, [id])
  return result
}
