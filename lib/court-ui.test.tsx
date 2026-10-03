import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CourtAnnouncementList } from '@/components/xray/detail/CourtAnnouncementList'
import type { CourtSearchResult } from './types'

const base: CourtSearchResult = {
  status: 'empty', queryName: '测试股份有限公司', from: '2025-10-03', to: '2026-10-03',
  fetchedAt: '2026-10-03T00:00:00Z', records: [], totalReported: 0, inspected: 0,
}

describe('司法公告展示', () => {
  it('空结果明确说明不能证明没有司法风险', () => {
    const html = renderToStaticMarkup(<CourtAnnouncementList result={base} />)
    expect(html).toContain('本次检索未匹配到公告')
    expect(html).toContain('不能证明没有司法风险')
  })

  it('公告展示来源链接和发布机构，不把仲裁发布机构称为法院', () => {
    const html = renderToStaticMarkup(<CourtAnnouncementList result={{ ...base, status: 'available',
      records: [{ id: '1', source: '人民法院公告网', date: '2026-10-01', type: '仲裁文书', party: '测试股份有限公司',
        publisher: '非法院单位', title: '仲裁文书', summary: '公告正文',
        url: 'https://rmfygg.court.gov.cn/web/rmfyportal/noticedetail?paramStr=1' }] }} />)
    expect(html).toContain('发布机构：非法院单位')
    expect(html).toContain('paramStr=1')
    expect(html).toContain('匹配 1 条公开公告')
  })

  it('历史空快照显示抓取时间和待复核状态', () => {
    const html = renderToStaticMarkup(<CourtAnnouncementList result={{ ...base, status: 'partial',
      historical: true, message: '来源当前受限；不能据此判断当前无公告。' }} />)
    expect(html).toContain('仅有历史快照，当前公告待复核')
    expect(html).toContain('历史抓取时间')
    expect(html).not.toContain('本次检索未匹配到公告')
  })
})
