'use client'

import { useEffect, useState } from 'react'
import { scoreMorale } from '@/lib/analysis/scoring/morale'
import { mergeSentimentItems } from '@/lib/data/adapters/eastmoney-sentiment'
import type { SentimentItem, SentimentSnapshot } from '@/lib/types'

const SLOW_REQUEST_MS = 6000
const PAGE_PAUSE_MS = 200
const MAX_HISTORY_PAGES = 17
const YEAR_MS = 365 * 24 * 60 * 60 * 1000

interface SentimentState {
  snapshot?: SentimentSnapshot
  loading: boolean
  slow: boolean
}

function coverageOf(items: SentimentItem[]): SentimentSnapshot['coverage'] {
  return items.length ? { from: items[0].date, to: items[items.length - 1].date } : undefined
}

function hasReachedOneYear(items: SentimentItem[]): boolean {
  const earliest = items[0]
  if (!earliest) return false
  const timestamp = new Date(`${earliest.date}T00:00:00`).getTime()
  return Number.isFinite(timestamp) && timestamp <= Date.now() - YEAR_MS
}

function waitBetweenPages(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, PAGE_PAUSE_MS))
}

/**
 * 先渲染最近一页，再逐页补全年历史。每一页都是独立 HTTP 请求，因而慢页、
 * 限流或取消只影响后续回补，不会阻塞已展示的报告与新闻证据。
 */
export function useSentiment(companyId: string): SentimentState {
  const [state, setState] = useState<SentimentState>({ loading: true, slow: false })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let lastSnapshot: SentimentSnapshot | undefined
    const slowTimer = window.setTimeout(() => {
      if (active) setState((current) => ({ ...current, slow: true }))
    }, SLOW_REQUEST_MS)

    const fetchPage = async (page: number): Promise<SentimentSnapshot> => {
      const response = await fetch(`/api/company/${encodeURIComponent(companyId)}/sentiment?page=${page}`, {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('SENTIMENT_REQUEST_FAILED')
      return response.json() as Promise<SentimentSnapshot>
    }

    const publish = (
      base: SentimentSnapshot,
      items: SentimentItem[],
      page: number,
      historyStatus: NonNullable<SentimentSnapshot['historyStatus']>,
      message?: string,
    ): SentimentSnapshot => ({
      ...base,
      status: 'available',
      items,
      coverage: coverageOf(items),
      morale: scoreMorale(items, new Date()),
      page,
      loadedPages: page,
      historyStatus,
      message,
    })

    const run = async () => {
      try {
        const first = await fetchPage(1)
        if (!active) return
        window.clearTimeout(slowTimer)

        if (first.status !== 'available') {
          setState({ snapshot: first, loading: false, slow: false })
          return
        }

        let items = first.items
        let page = 1
        let current = first
        const stopAfterFirst = !first.hasMore || hasReachedOneYear(items)
        if (stopAfterFirst) {
          lastSnapshot = publish(first, items, page, 'complete')
          setState({ snapshot: lastSnapshot, loading: false, slow: false })
          return
        }

        lastSnapshot = publish(first, items, page, 'backfilling')
        setState({ snapshot: lastSnapshot, loading: false, slow: false })

        while (active && current.hasMore && !hasReachedOneYear(items) && page < MAX_HISTORY_PAGES) {
          await waitBetweenPages()
          if (!active) return
          const next = await fetchPage(page + 1)
          if (!active) return
          if (next.status !== 'available') {
            const message = next.status === 'failed'
              ? '年度历史回补中断，已展示此前可验证的新闻。'
              : '年度历史已回补完成，未找到更多可验证新闻。'
            lastSnapshot = publish(current, items, page, next.status === 'failed' ? 'partial' : 'complete', message)
            setState({ snapshot: lastSnapshot, loading: false, slow: false })
            return
          }

          page += 1
          current = next
          items = mergeSentimentItems(items, next.items)
          const complete = !next.hasMore || hasReachedOneYear(items)
          lastSnapshot = publish(next, items, page, complete ? 'complete' : 'backfilling')
          setState({ snapshot: lastSnapshot, loading: false, slow: false })
          if (complete) return
        }

        if (active) {
          lastSnapshot = publish(current, items, page, current.hasMore ? 'limited' : 'complete', current.hasMore
              ? `年度历史回补达到 ${MAX_HISTORY_PAGES * 30} 条安全上限，已展示可验证部分。`
              : undefined)
          setState({
            snapshot: lastSnapshot,
            loading: false,
            slow: false,
          })
        }
      } catch {
        if (!active || controller.signal.aborted) return
        window.clearTimeout(slowTimer)
        if (lastSnapshot) {
          setState({
            snapshot: { ...lastSnapshot, historyStatus: 'partial', message: '年度历史回补中断，已展示此前可验证的新闻。' },
            loading: false,
            slow: false,
          })
          return
        }
        setState({
          loading: false,
          slow: false,
          snapshot: {
            companyId,
            status: 'failed',
            source: '东方财富新闻',
            fetchedAt: new Date().toISOString(),
            items: [],
            message: '东方财富新闻暂不可用，请稍后重试。',
          },
        })
      }
    }

    setState({ loading: true, slow: false })
    void run()

    return () => {
      active = false
      controller.abort()
      window.clearTimeout(slowTimer)
    }
  }, [companyId])

  return state
}
