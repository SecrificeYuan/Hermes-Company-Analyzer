'use client'

import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { LineChart } from 'lucide-react'

/** 股票提及：可选中文/字母名 + 括号内带交易所后缀的 6 位代码，或裸代码（600080.SH / 600080．SH 全角也算） */
const NAMED_RE = /([\u4e00-\u9fa5A-Za-z0-9*＊]{2,12}?)[（(]\s*(\d{6})\s*[.。．]\s*(SH|SZ|BJ)\s*[)）]/g
const BARE_RE = /(?<![\w.])(\d{6})\s*[.。．]\s*(SH|SZ|BJ)(?![\w.])/g

export interface StockMention {
  name: string | null
  code: string
  exchange: string
}

interface Segment {
  text: string
  stock?: StockMention
}

/** 股票提及 tokenize：按出现顺序切分文本，命中的段落带 stock 信息（fenced code block 内不识别） */
export function tokenizeStockMentions(text: string): Segment[] {
  // 1) 收集命名提及（名称+括号代码）
  const hits: { start: number; end: number; stock: StockMention }[] = []
  for (const m of text.matchAll(NAMED_RE)) {
    let name = m[1]
    // 名称可能被前面的句子粘连（如「按附件核实的ST金花」）：截到最后一个胶水字之后
    const glue = /[的了吗呢吧啊呀嘛么在把被让向对按和与跟过及，。、；：]/
    const cut = name.split('').map((ch, i) => (glue.test(ch) ? i : -1)).reduce((a, b) => Math.max(a, b), -1)
    name = name.slice(cut + 1)
    if (name.length > 8) name = name.slice(-8)
    hits.push({ start: m.index, end: m.index + m[0].length, stock: { name, code: m[2], exchange: m[3] } })
  }
  // 2) 裸代码提及（排除已被命名提及覆盖的位置）
  for (const m of text.matchAll(BARE_RE)) {
    if (hits.some((h) => m.index >= h.start && m.index < h.end)) continue
    hits.push({ start: m.index, end: m.index + m[0].length, stock: { name: null, code: m[1], exchange: m[2] } })
  }
  hits.sort((a, b) => a.start - b.start)

  // 3) fenced code block 内的命中丢弃，其余按位置切分（命中可能跨段边界，重叠即弃）
  const codeRanges = [...text.matchAll(/```[\s\S]*?(?:```|$)/g)].map((m) => [m.index, m.index + m[0].length] as const)
  const valid = hits.filter((h) => !codeRanges.some(([s, e]) => h.start < e && h.end > s))
  const out: Segment[] = []
  let pos = 0
  for (const h of valid) {
    if (h.start > pos) out.push({ text: text.slice(pos, h.start) })
    out.push({ text: text.slice(h.start, h.end), stock: h.stock })
    pos = h.end
  }
  if (pos < text.length) out.push({ text: text.slice(pos) })
  return out
}

/** 股票提及 chip：点击跳对应 /report/<6 位代码> 报告页 */
function StockChip({ stock }: { stock: StockMention }) {
  const label = stock.name ? `${stock.name} (${stock.code}.${stock.exchange})` : `${stock.code}.${stock.exchange}`
  return (
    <Link
      href={`/report/${stock.code}`}
      className="mx-0.5 inline-flex items-center gap-1.5 rounded-full border border-neon/40 bg-ink-card/80 py-0.5 pl-2.5 pr-3 align-middle font-mono text-[0.85em] text-slate-200 transition-colors hover:border-neon hover:bg-ink-card"
      title={`打开 ${stock.code} 的 X 光报告`}
    >
      <LineChart className="h-3 w-3 text-neon" />
      {label}
    </Link>
  )
}

/** AI 气泡的 markdown 渲染：暗色终端风，重点词用霓虹色；股票提及渲染为可点击 chip */
export function Markdown({ text }: { text: string }) {
  const segments = tokenizeStockMentions(text)
  return (
    <div className="text-sm leading-relaxed text-slate-100">
      {segments.map((seg, i) =>
        seg.stock ? (
          <StockChip key={i} stock={seg.stock} />
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
            {seg.text}
          </ReactMarkdown>
        ),
      )}
    </div>
  )
}

const MD_COMPONENTS = {
  h1: ({ children }: { children?: React.ReactNode }) => <p className="my-1.5 font-bold first:mt-0 last:mb-0">{children}</p>,
  h2: ({ children }: { children?: React.ReactNode }) => <p className="my-1.5 font-bold first:mt-0 last:mb-0">{children}</p>,
  h3: ({ children }: { children?: React.ReactNode }) => <p className="my-1.5 font-semibold first:mt-0 last:mb-0">{children}</p>,
  p: ({ children }: { children?: React.ReactNode }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="my-1.5 list-disc pl-5 first:mt-0 last:mb-0">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="my-1.5 list-decimal pl-5 first:mt-0 last:mb-0">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="my-0.5">{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-neon">{children}</strong>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-1.5 border-l-2 border-ink-edge pl-3 text-slate-400">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-ink-edge" />,
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-neon underline underline-offset-2">
      {children}
    </a>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 overflow-x-auto rounded bg-black/40 p-3 text-xs leading-relaxed">{children}</pre>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) =>
    className?.includes('language-') ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.85em] text-neon">{children}</code>
    ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-ink-edge bg-ink-card/60 px-2.5 py-1.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => <td className="border border-ink-edge px-2.5 py-1.5">{children}</td>,
} as const
