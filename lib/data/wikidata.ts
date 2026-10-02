import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { ProxyAgent, request } from 'undici'
import type { CompanyIdentity, CompanySearchResult, PublicSource } from '@/lib/company'

const API = 'https://www.wikidata.org/w/api.php'
const cache = new Map<string, { expires: number; value: Promise<CompanySearchResult> }>()
let dispatcher: ProxyAgent | undefined

function systemProxy(): string | undefined {
  const configured = process.env.WIKIDATA_PROXY_URL ?? process.env.HTTPS_PROXY ?? process.env.https_proxy
  if (configured) return configured
  if (process.platform !== 'win32') return undefined
  try {
    const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
    const enabled = execFileSync('reg', ['query', key, '/v', 'ProxyEnable'], { encoding: 'utf8', timeout: 1000 })
    if (!/ProxyEnable\s+REG_DWORD\s+0x1/i.test(enabled)) return undefined
    const value = execFileSync('reg', ['query', key, '/v', 'ProxyServer'], { encoding: 'utf8', timeout: 1000 }).match(/ProxyServer\s+REG_SZ\s+([^\r\n]+)/i)?.[1]?.trim()
    const address = value?.includes(';') ? value.split(';').find((part) => part.startsWith('https='))?.slice(6) : value
    return address ? (address.includes('://') ? address : `http://${address}`) : undefined
  } catch { return undefined }
}

function proxyDispatcher(): ProxyAgent | undefined {
  const proxy = systemProxy()
  if (!proxy) return undefined
  return dispatcher ??= new ProxyAgent(proxy)
}
type SearchRow = { id: string; label?: string; description?: string; match?: { text?: string } }
type Claim = { mainsnak?: { datavalue?: { value?: unknown } } }
type Entity = { labels?: Record<string, { value: string }>; aliases?: Record<string, { value: string }[]>; descriptions?: Record<string, { value: string }>; claims?: Record<string, Claim[]> }

function claimValue(entity: Entity, key: string): unknown {
  return entity.claims?.[key]?.[0]?.mainsnak?.datavalue?.value
}

function isCompany(entity: Entity): boolean {
  const types = entity.claims?.P31 ?? []
  return types.some((claim) => {
    const value = claim.mainsnak?.datavalue?.value
    return value && typeof value === 'object' && 'id' in value && [
      'Q4830453', // business
      'Q167037', // corporation
      'Q891723', // public company
      'Q6881511', // enterprise
      'Q783794', // company
    ].includes(String(value.id))
  })
}

function nameOf(entity: Entity, fallback: string): string {
  return entity.labels?.zh?.value ?? entity.labels?.en?.value ?? fallback
}

export function companyFromWikidata(row: SearchRow, entity: Entity, query: string, fetchedAt = new Date().toISOString()): CompanyIdentity | null {
  if (!/^Q\d+$/.test(row.id) || !isCompany(entity)) return null
  const label = nameOf(entity, row.label ?? '')
  const aliases = [...(entity.aliases?.zh ?? []), ...(entity.aliases?.en ?? [])].map((alias) => alias.value)
  const exact = [label, ...aliases].some((value) => value.replace(/\s/g, '') === query.replace(/\s/g, ''))
  if (!exact && !label.includes(query)) return null
  const matchedLegalName = /(?:股份有限公司|有限责任公司|有限公司)$/.test(query) && exact
  const directName = label.replace(/\s/g, '') === query.replace(/\s/g, '')
  const credit = claimValue(entity, 'P6795')
  const founded = claimValue(entity, 'P571')
  const foundedAt = founded && typeof founded === 'object' && 'time' in founded && typeof founded.time === 'string' && /^\+\d{4}-\d{2}-\d{2}/.test(founded.time) && !founded.time.includes('-00-') ? founded.time.slice(1, 11) : undefined
  const website = claimValue(entity, 'P856')
  const source: PublicSource = {
    title: 'Wikidata · 企业实体线索', url: `https://www.wikidata.org/wiki/${row.id}`, fetchedAt, kind: 'discovery', state: 'ok',
    note: directName ? '开放协作数据库记录；工商登记信息仍需公示系统复核。' : '别名命中；可能是集团、品牌或曾用名，不能直接视作同一法律主体。',
  }
  const name = matchedLegalName ? label : exact ? query : label
  return {
    id: `wiki_${row.id}`,
    name, fullName: matchedLegalName ? query : undefined,
    identity: 'lead', listing: 'unknown',
    creditCode: directName && typeof credit === 'string' && /^[0-9A-Z]{18}$/.test(credit) ? credit : undefined,
    foundedAt: directName ? foundedAt : undefined,
    description: entity.descriptions?.zh?.value ?? entity.descriptions?.en?.value ?? row.description,
    website: directName && typeof website === 'string' && /^https:\/\//.test(website) ? website : undefined,
    sources: [source],
  }
}

/** Reopen a discovered entity by its public Q-id, without a local company file. */
export async function getWikidataCompany(id: string): Promise<CompanyIdentity | null> {
  if (!/^Q\d+$/.test(id)) return null
  try {
    const url = new URL(API)
    url.search = new URLSearchParams({ action: 'wbgetentities', ids: id, props: 'labels|aliases|claims|descriptions', languages: 'zh|en', format: 'json' }).toString()
    const detail = await json(url) as { entities?: Record<string, Entity> }
    const entity = detail.entities?.[id]
    return entity ? companyFromWikidata({ id, label: nameOf(entity, '') }, entity, nameOf(entity, '')) : null
  } catch { return null }
}

async function json(url: URL): Promise<unknown> {
  const response = await request(url, { signal: AbortSignal.timeout(15000), dispatcher: proxyDispatcher(), headers: { 'User-Agent': 'HermesCompanyAnalyzer/1.0 (local development)', Accept: 'application/json' } })
  if (response.statusCode !== 200) { await response.body.dump(); throw new Error(`Wikidata ${response.statusCode}`) }
  return response.body.json()
}

export async function searchWikidata(query: string): Promise<CompanySearchResult> {
  const cached = cache.get(query)
  if (cached && cached.expires > Date.now()) return cached.value
  const value = (async (): Promise<CompanySearchResult> => {
    const fetchedAt = new Date().toISOString()
    const source: PublicSource = { title: 'Wikidata · 实时实体检索', url: 'https://www.wikidata.org/', fetchedAt, kind: 'discovery', state: 'ok', note: '仅覆盖该开放数据库收录的企业；非完整工商名录。' }
    try {
      const searchUrl = new URL(API)
      searchUrl.search = new URLSearchParams({ action: 'wbsearchentities', search: query, language: 'zh', uselang: 'zh', format: 'json', limit: '8' }).toString()
      const search = await json(searchUrl) as { search?: SearchRow[] }
      let rows = (search.search ?? []).filter((row) => /^Q\d+$/.test(row.id))
      if (!rows.length && /(?:股份有限公司|有限责任公司|有限公司)$/.test(query)) {
        const shorter = query.replace(/^(?:北京|上海|天津|重庆|深圳|广州|杭州|苏州|南京|成都|武汉|西安|宁波|厦门)(?:市)?/, '').replace(/(?:科技|信息技术|技术)?(?:股份有限公司|有限责任公司|有限公司)$/, '')
        if (shorter.length >= 2 && shorter !== query) {
          searchUrl.searchParams.set('search', shorter)
          const retry = await json(searchUrl) as { search?: SearchRow[] }
          rows = (retry.search ?? []).filter((row) => /^Q\d+$/.test(row.id))
        }
      }
      if (!rows.length) return { suggestions: [], sources: [{ ...source, state: 'empty' }] }
      const detailUrl = new URL(API)
      detailUrl.search = new URLSearchParams({ action: 'wbgetentities', ids: rows.map((row) => row.id).join('|'), props: 'labels|aliases|claims|descriptions', languages: 'zh|en', format: 'json' }).toString()
      const detail = await json(detailUrl) as { entities?: Record<string, Entity> }
      const suggestions = rows.flatMap((row) => {
        const entity = detail.entities?.[row.id]
        const company = entity && companyFromWikidata(row, entity, row.match?.text ?? query, fetchedAt)
        return company ? [company] : []
      })
      return { suggestions, sources: [{ ...source, state: suggestions.length ? 'ok' : 'empty' }] }
    } catch {
      return { suggestions: [], sources: [{ ...source, state: 'unavailable', note: '实时实体检索暂不可用。' }] }
    }
  })()
  if (cache.size >= 100) cache.delete(cache.keys().next().value!)
  cache.set(query, { expires: Date.now() + 60_000, value })
  return value
}

/** Condition-driven discovery. It queries the public knowledge graph for the
 * supplied region/industry on every request; it does not read a local pool. */
const SECTORS: Record<string, { id: string; label: string }> = {
  manufacturing: { id: 'Q187939', label: '制造业' }, technology: { id: 'Q11661', label: '信息技术' },
  consumer: { id: 'Q56573357', label: '消费品行业' }, healthcare: { id: 'Q507443', label: '医药产业' },
  finance: { id: 'Q837171', label: '金融服务' }, energy: { id: 'Q2151621', label: '能源工业' },
  realestate: { id: 'Q2588161', label: '不动产业' },
}

export async function screenWikidata(region: string, industry: string): Promise<CompanySearchResult> {
  if (!region && !industry) return { suggestions: [], sources: [] }
  const fetchedAt = new Date().toISOString()
  const source: PublicSource = { title: 'Wikidata · 条件实时检索', url: 'https://query.wikidata.org/', fetchedAt, kind: 'discovery', state: 'ok', note: '开放知识图谱实时查询；不是完整工商名录，结果需工商主体复核。' }
  try {
    const filters = region ? [`?hq rdfs:label ?hqLabel`, `FILTER(LANG(?hqLabel)="zh")`] : []
    if (region) filters.push(`FILTER(CONTAINS(STR(?hqLabel),${JSON.stringify(region)}))`)
    const sector = SECTORS[industry]
    const query = `SELECT DISTINCT ?item ?itemLabel ${region ? '?hqLabel' : ''} WHERE { ?item wdt:P31 wd:Q4830453; wdt:P17 wd:Q148. ${region ? '?item wdt:P159 ?hq.' : ''} ${sector ? `?item wdt:P452 wd:${sector.id}.` : ''} ${filters.join(' ')} SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". } } LIMIT 24`
    const url = new URL('https://query.wikidata.org/sparql')
    url.search = new URLSearchParams({ format: 'json', query }).toString()
    const data = await json(url) as { results?: { bindings?: Array<{ item?: { value?: string }; itemLabel?: { value?: string }; hqLabel?: { value?: string } }> } }
    const rows = data.results?.bindings ?? []
    const ids = rows.flatMap((row) => row.item?.value?.match(/Q\d+$/)?.[0] ?? [])
    const detailUrl = new URL(API)
    detailUrl.search = new URLSearchParams({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels|aliases|claims|descriptions', languages: 'zh|en', format: 'json' }).toString()
    const detail = ids.length ? await json(detailUrl) as { entities?: Record<string, Entity> } : { entities: {} }
    const suggestions = rows.flatMap((row) => {
      const id = row.item?.value?.match(/Q\d+$/)?.[0]
      const label = row.itemLabel?.value
      if (!id || !label) return []
      const entity = detail.entities?.[id]
      const lead = entity && companyFromWikidata({ id, label }, entity, label, fetchedAt)
      if (!lead) return []
      return [{ ...lead, region: row.hqLabel?.value, industry: sector?.label, sources: [{ ...source, url: `https://www.wikidata.org/wiki/${id}` }] } satisfies CompanyIdentity]
    })
    return { suggestions, sources: [{ ...source, state: suggestions.length ? 'ok' : 'empty' }] }
  } catch {
    return { suggestions: [], sources: [{ ...source, state: 'unavailable', note: '条件实时检索暂不可用。' }] }
  }
}
