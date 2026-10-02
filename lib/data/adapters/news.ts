/** 东财 7×24 快讯：newsapi JSONP 包装，解析出标题 / 链接 / 时间 */
export interface FlashNews {
  title: string
  url: string
  time: string // HH:MM
}

export async function fetchFlashNews(limit = 20): Promise<FlashNews[]> {
  const url = `https://newsapi.eastmoney.com/kuaixun/v1/getlist_102_ajaxResult_${limit}_1_.html`
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) return []
  const text = await res.text()
  const m = text.match(/ajaxResult=(.*)/s)
  if (!m) return []
  try {
    const json = JSON.parse(m[1].trim().replace(/;$/, '')) as {
      LivesList?: Array<{ title?: string; url_w?: string; showtime?: string }>
    }
    return (json.LivesList ?? [])
      .filter((n) => n.title && n.url_w)
      .map((n) => ({
        title: String(n.title),
        url: String(n.url_w).replace(/^http:\/\//, 'https://'),
        time: String(n.showtime ?? '').slice(11, 16),
      }))
  } catch {
    return []
  }
}
