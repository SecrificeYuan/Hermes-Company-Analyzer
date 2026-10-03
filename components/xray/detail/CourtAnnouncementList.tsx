'use client'

import type { CourtSearchResult } from '@/lib/types'

export function CourtAnnouncementList({ result }: { result: CourtSearchResult | null }) {
  return (
    <div>
      <h4 className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">人民法院公告网 · 近 12 个月</h4>
      {!result ? (
        <p className="rounded-btn border border-edge px-3 py-3 text-xs text-slate-400">正在检索法院公告…</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-slate-400">
            {result.queryName ? `检索主体：${result.queryName}；` : ''}
            {result.from && result.to ? `公告日期：${result.from} 至 ${result.to}；` : ''}
            {result.status === 'available' ? `匹配 ${result.records.length} 条公开公告。` :
              result.status === 'empty' ? '本次检索未匹配到公告。' :
              result.status === 'partial' ? result.historical
                ? result.records.length
                  ? `历史快照匹配 ${result.records.length} 条公告；结果不完整，尚未实时复核。`
                  : '仅有历史快照，当前公告待复核。'
                : `已读取 ${result.inspected} 条列表，匹配 ${result.records.length} 条；结果不完整。` :
              result.status === 'identity_unverified' ? '公司工商全称尚未核实，暂不发起查询。' :
              result.status === 'blocked' ? '来源限制访问，暂时无法查询。' : '来源暂不可用。'}
            {' '}公告是名称匹配线索，不等于完整案件、被执行或失信记录；无匹配也不能证明没有司法风险。
          </p>
          {result.historical && <p className="text-xs text-warn">历史抓取时间：{new Date(result.fetchedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）</p>}
          {result.records.length > 0 && (
            <ul className="divide-y divide-edge/50 rounded-btn border border-edge">
              {result.records.map((item) => (
                <li key={item.id} className="px-3 py-2.5 text-xs">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-[10px] text-slate-500">{item.date}</span>
                    <span className="rounded border border-edge px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{item.type}</span>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-neon hover:underline">{item.title}</a>
                  </div>
                  <p className="mt-1 break-words text-slate-400">当事人：{item.party} · 发布机构：{item.publisher}</p>
                  {item.summary && <p className="mt-1 line-clamp-2 text-slate-500">{item.summary}</p>}
                </li>
              ))}
            </ul>
          )}
          {result.message && <p className="text-xs text-warn">{result.message}</p>}
          {result.totalReported !== null && <p className="font-mono text-[10px] text-slate-500">{result.historical ? '历史抓取时' : '来源搜索'}返回 {result.totalReported} 条；{result.historical ? '历史读取' : '本次读取'} {result.inspected} 条列表。</p>}
          <a href="https://rmfygg.court.gov.cn/web/rmfyportal/noticeinfo" target="_blank" rel="noopener noreferrer" className="inline-block text-[11px] text-neon hover:underline">到人民法院公告网复查 →</a>
        </div>
      )}
    </div>
  )
}
