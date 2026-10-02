// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { deduplicateCompanies, identityFromPage, legalName, listingFromProfile, validCreditCode } from '../data/company-discovery'
import { isPublicIPv4, parseDirectoryHtml } from '../data/public-web'
import { companyFromWikidata } from '../data/wikidata'
import type { CompanyIdentity } from '../company'
const lead: CompanyIdentity = { id: 'web_example', name: '示例科技有限公司', identity: 'lead', listing: 'unknown', sources: [] }

describe('public enterprise discovery', () => {
  it('reads only company links from public directories without elevating nearby text to evidence', () => {
    const qcc = 'https://www.qcc.com/firm/123abc.html'
    const ncss = 'https://www.ncss.cn/ncss/keyunits/202003/20200311/2101729310.html'
    const html = `<a href="${qcc}">1 示例科技有限公司</a><p>年回报保证 80%</p><a href="${ncss}">华为技术有限公司</a><a href="https://example.com/firm/123abc.html">伪造科技有限公司</a>`
    expect(parseDirectoryHtml(html, '')).toEqual([{ title: '示例科技有限公司', url: qcc, snippet: '' }, { title: '华为技术有限公司', url: ncss, snippet: '' }])
    expect(parseDirectoryHtml(html, '华为')).toEqual([{ title: '华为技术有限公司', url: ncss, snippet: '' }])
    expect(parseDirectoryHtml('<a href="/ncss/keyunits/202003/20200311/2101729310.html">华为技术有限公司</a>', '华为', 'https://www.ncss.cn/ncss/keyunits/')).toEqual([{ title: '华为技术有限公司', url: ncss, snippet: '' }])
    expect(legalName('企业名单 - 示例科技有限公司')).toBeNull()
    expect(legalName('示例科技有限公司 - 企业资料')).toBe('示例科技有限公司')
  })
  it('does not infer unlisted from a name or a missing stock match', () => {
    expect(identityFromPage(lead, '<title>示例科技有限公司</title><h1>示例科技有限公司</h1><p>主营软件开发</p>').listing).toBe('unknown')
    const verified = identityFromPage(lead, '<title>示例科技有限公司</title><h1>示例科技有限公司</h1><p>示例科技有限公司是一家未上市企业。</p>')
    expect(verified.identity).toBe('verified')
    expect(verified.listing).toBe('unlisted')
    expect(identityFromPage(lead, '<title>母公司</title><p>母公司是一家上市公司，拥有子公司示例科技有限公司。</p>').identity).toBe('lead')
  })
  it('validates credit-code checksum and does not merge same-name entities without an identifier', () => {
    expect(validCreditCode('91350900587527783P')).toBe(true)
    expect(validCreditCode('91350900587527783Q')).toBe(false)
    expect(deduplicateCompanies([lead, { ...lead, id: 'other' }])).toHaveLength(2)
    expect(deduplicateCompanies([{ ...lead, creditCode: '91350900587527783P' }, { ...lead, id: 'other', creditCode: '91350900587527783P' }])).toHaveLength(1)
    expect(deduplicateCompanies([{ ...lead, id: '300750', stockCode: '300750.SZ', creditCode: '91350900587527783P' }, { ...lead, id: '300750', stockCode: '300750.SZ' }])).toHaveLength(1)
  })
  it('distinguishes pending IPOs from listed companies', () => {
    expect(listingFromProfile({ LISTING_STATE: '9', LISTING_DATE: null })).toBe('unlisted')
    expect(listingFromProfile({ LISTING_STATE: '0', LISTING_DATE: '2020-01-01' })).toBe('listed')
    expect(listingFromProfile({ LISTING_STATE: '0', LISTING_DATE: '2099-01-01' })).toBe('unknown')
  })
  it('rejects local, private and reserved crawl targets', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '999.1.1.1']) expect(isPublicIPv4(ip)).toBe(false)
    expect(isPublicIPv4('8.8.8.8')).toBe(true)
  })
  it('keeps collaborative knowledge graph records as unverified leads', () => {
    const company = companyFromWikidata(
      { id: 'Q16924332', label: '大疆创新', match: { text: '大疆创新' } },
      { labels: { zh: { value: '大疆创新' } }, descriptions: { zh: { value: '中国科技公司' } }, claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q4830453' } } } }], P6795: [{ mainsnak: { datavalue: { value: '914403007954257495' } } }] } },
      '大疆创新',
    )
    expect(company).toMatchObject({ name: '大疆创新', identity: 'lead', listing: 'unknown', creditCode: '914403007954257495' })
    expect(company?.sources[0].url).toBe('https://www.wikidata.org/wiki/Q16924332')
    expect(companyFromWikidata({ id: 'Q1', label: '非企业' }, { labels: { zh: { value: '非企业' } } }, '非企业')).toBeNull()
  })
})
