import { lookup } from 'node:dns/promises'
import https from 'node:https'
import { load } from 'cheerio'
import robotsParser from 'robots-parser'
import type { PublicSource } from '@/lib/company'

const USER_AGENT = 'HermesCompanyAnalyzer/1.0'
const MAX_BYTES = 2_000_000
const robotsCache = new Map<string, { expires: number; body: string }>()
const directoryCache = new Map<string, { expires: number; body: Promise<string> }>()

export class PublicWebError extends Error {
  constructor(public state: 'blocked' | 'unavailable', message: string) { super(message) }
}

// Resolve and pin public IPv4 addresses for every redirect; discovered URLs are untrusted.
export function isPublicIPv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b, c] = parts
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99) || (b === 2))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113))
}

function webUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password ||
    !url.hostname.includes('.') || url.hostname.endsWith('.local')) throw new PublicWebError('blocked', '不支持的网页地址')
  return url
}

async function requestText(value: string, signal: AbortSignal, redirects = 0): Promise<{ body: string; status: number; url: string }> {
  const url = webUrl(value)
  const addresses = await lookup(url.hostname, { family: 4, all: true })
  if (!addresses.length || addresses.some((item) => !isPublicIPv4(item.address))) throw new PublicWebError('blocked', '非公开网络地址')
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      signal,
      family: 4,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/plain', 'Accept-Encoding': 'identity' },
      lookup: (_host, _options, callback) => callback(null, addresses[0].address, 4),
    }, (res) => {
      const status = res.statusCode ?? 500
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        if (redirects >= 3) return reject(new PublicWebError('unavailable', '重定向过多'))
        const next = new URL(res.headers.location, url).toString()
        // Page redirects are handled by the caller so the destination robots rules are checked.
        if (!url.pathname.endsWith('/robots.txt')) return reject(new PublicWebError('unavailable', `页面已跳转：${next}`))
        requestText(next, signal, redirects + 1).then(resolve, reject)
        return
      }
      const chunks: Buffer[] = []
      let bytes = 0
      res.on('data', (chunk: Buffer) => {
        bytes += chunk.length
        if (bytes > MAX_BYTES) { req.destroy(new PublicWebError('unavailable', '网页内容过大')); return }
        chunks.push(chunk)
      })
      res.on('error', reject)
      res.on('end', () => resolve({ status, body: Buffer.concat(chunks).toString('utf8'), url: url.toString() }))
    })
    req.on('error', reject)
  })
}

export async function fetchPublicPage(value: string): Promise<string> {
  const url = webUrl(value)
  const signal = AbortSignal.timeout(9000)
  let rules = robotsCache.get(url.origin)
  if (!rules || rules.expires < Date.now()) {
    const response = await requestText(`${url.origin}/robots.txt`, signal)
    if (response.status !== 404 && response.status !== 410 && response.status !== 200) throw new PublicWebError('blocked', '无法确认来源的公开抓取规则')
    rules = { expires: Date.now() + 3600_000, body: response.status === 200 ? response.body : '' }
    if (robotsCache.size >= 100) robotsCache.delete(robotsCache.keys().next().value!)
    robotsCache.set(url.origin, rules)
  }
  if (robotsParser(`${url.origin}/robots.txt`, rules.body).isAllowed(url.toString(), USER_AGENT) === false) {
    throw new PublicWebError('blocked', '来源不允许自动读取此页面')
  }
  const response = await requestText(url.toString(), signal)
  if ([401, 403, 405, 429].includes(response.status)) throw new PublicWebError('blocked', '来源限制访问或需要验证')
  if (response.status !== 200) throw new PublicWebError('unavailable', `来源返回 ${response.status}`)
  const $ = load(response.body)
  if (/验证码|安全验证|405错误|访问验证|Just a moment/i.test($('title').text())) throw new PublicWebError('blocked', '来源需要人工验证')
  return response.body
}

export interface WebHit { title: string; url: string; snippet: string }
function directoryHtml(url: string): Promise<string> {
  const cached = directoryCache.get(url)
  if (cached && cached.expires > Date.now()) return cached.body
  const body = fetchPublicPage(url)
  directoryCache.set(url, { expires: Date.now() + 60_000, body })
  void body.catch(() => directoryCache.delete(url))
  return body
}
export function parseDirectoryHtml(html: string, query: string, baseUrl = 'https://top.qcc.com/'): WebHit[] {
  const $ = load(html)
  const hits: WebHit[] = []
  const terms = query.trim().split(/\s+/).filter(Boolean)
  $('a[href]').each((_index, element) => {
    const row = $(element)
    const link = row.attr('href') ?? ''
    try {
      const target = webUrl(new URL(link, baseUrl).toString())
      const qcc = target.hostname === 'www.qcc.com' && /^\/firm\/[a-z0-9]+\.html$/.test(target.pathname)
      const ncss = target.hostname === 'www.ncss.cn' && /^\/ncss\/keyunits\/\d{6}\/\d{8}\/\d+\.html$/.test(target.pathname)
      if (!qcc && !ncss) return
      const title = row.text().replace(/^\s*\d+\s*/, '').trim()
      if (!/(?:股份有限公司|有限责任公司|有限公司)$/.test(title)) return
      if (terms.length && !terms.every((term) => title.includes(term))) return
      hits.push({ title, url: target.toString(), snippet: '' })
    } catch { /* Ignore non-web links. */ }
  })
  return [...new Map(hits.map((hit) => [hit.url, hit])).values()].slice(0, 12)
}

export async function searchPublicDirectory(query: string): Promise<{ hits: WebHit[]; sources: PublicSource[] }> {
  const directories = [
    { url: 'https://www.ncss.cn/ncss/keyunits/', title: '国家大学生就业服务平台 · 公开企业目录' },
    { url: 'https://top.qcc.com/', title: '企查查 · 公开热搜企业目录' },
  ]
  const results = await Promise.all(directories.map(async ({ url, title }) => {
    const source: PublicSource = { title, url, fetchedAt: new Date().toISOString(), kind: 'discovery', state: 'ok', note: '仅覆盖该页面展示的企业，不能代表完整工商名录。' }
    try {
      const hits = parseDirectoryHtml(await directoryHtml(url), query, url)
      return { hits, source: { ...source, state: hits.length ? 'ok' as const : 'empty' as const } }
    } catch (error) {
      return { hits: [], source: { ...source, state: error instanceof PublicWebError ? error.state : 'unavailable' as const, note: '公开目录暂不可用。' } }
    }
  }))
  return { hits: [...new Map(results.flatMap((result) => result.hits).map((hit) => [hit.url, hit])).values()].slice(0, 12), sources: results.map((result) => result.source) }
}
