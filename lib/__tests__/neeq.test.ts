// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { filingFromRow, parseNeeqFinancialText, parseNeeqProfileText, parseNeeqResponse } from '../data/neeq'

describe('全国股转系统公开年报适配器', () => {
  it('parses the announcement response and rejects non-annual-report rows', () => {
    const payload = JSON.stringify([{ listInfo: { totalPages: 1, content: [
      { companyCd: '874536', companyName: '浙江天际', disclosureTitle: '浙江天际2025年年度报告', publishDate: '2026-05-12', destFilePath: '/disclosure/2026/report.pdf', fileExt: 'pdf' },
      { companyCd: '874536', companyName: '浙江天际', disclosureTitle: '浙江天际2025年半年度报告', publishDate: '2025-08-20', destFilePath: '/disclosure/2025/half.pdf', fileExt: 'pdf' },
    ] } }])
    expect(parseNeeqResponse(payload).totalPages).toBe(1)
    expect(filingFromRow(JSON.parse(payload)[0].listInfo.content[0])).toMatchObject({ code: '874536', year: '2025', url: 'https://www.neeq.com.cn/disclosure/2026/report.pdf' })
    expect(filingFromRow(JSON.parse(payload)[0].listInfo.content[1])).toBeNull()
  })

  it('extracts verified profile fields from the annual report overview', () => {
    const profile = parseNeeqProfileText('公司中文全称 浙江天际互感器股份有限公司\n成立时间 1999年5月20日\n公司网址 https://www.tjhgq.net/\n主要产品与服务项目 互感器产品的研发、生产与销售\n统一社会信用代码 91330881147874810W\n注册地址 浙江省衢州市江山市\n注册资本（元） 135,000,000.00')
    expect(profile).toMatchObject({ fullName: '浙江天际互感器股份有限公司', creditCode: '91330881147874810W', foundedAt: '1999-05-20', registeredCapital: '13500 万元' })
  })

  it('keeps consolidated statement years and units aligned', () => {
    const text = [
      '浙江天际互感器股份有限公司',
      '合并资产负债表\n单位：元\n项目 附注 2025年12月31日 2024年12月31日',
      '流动资产合计 550,792,046.18 503,699,280.41',
      '资产总计 966,115,962.57 863,092,661.09',
      '流动负债合计 281,447,712.64 244,097,446.36',
      '负债合计 393,908,840.29 403,998,526.96',
      '母公司资产负债表',
      '合并利润表\n单位：元\n项目 附注 2025年 2024年',
      '其中：营业收入 656,835,629.92 579,057,440.00',
      '五、净利润（净亏损以“－”号填列） 113,031,327.03 107,531,367.63',
      '母公司利润表',
      '合并现金流量表\n单位：元\n项目 附注 2025年 2024年',
      '经营活动产生的现金流量净额 98,310,124.16 80,824,063.32',
      '母公司现金流量表',
    ].join('\n')
    const years = parseNeeqFinancialText(text, '2025').years
    expect(years.map(({ year }) => year)).toEqual(['2024', '2025'])
    expect(years[0].revenue).toBeCloseTo(57905.744, 8)
    expect(years[0].netProfit).toBeCloseTo(10753.136763, 8)
    expect(years[0].operatingCashFlow).toBeCloseTo(8082.406332, 8)
    expect(years[0].debtRatio).toBeCloseTo(46.8082449513, 8)
    expect(years[0].currentRatio).toBeCloseTo(2.0635172056, 8)
    expect(years[1].revenue).toBeCloseTo(65683.562992, 8)
    expect(years[1].netProfit).toBeCloseTo(11303.132703, 8)
    expect(years[1].operatingCashFlow).toBeCloseTo(9831.012416, 8)
    expect(years[1].debtRatio).toBeCloseTo(40.7724181725, 8)
    expect(years[1].currentRatio).toBeCloseTo(1.9569959941, 8)
  })
})
