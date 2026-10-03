'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** AI 气泡的 markdown 渲染：暗色终端风，重点词用霓虹色 */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed text-slate-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <p className="my-1.5 font-bold first:mt-0 last:mb-0">{children}</p>,
          h2: ({ children }) => <p className="my-1.5 font-bold first:mt-0 last:mb-0">{children}</p>,
          h3: ({ children }) => <p className="my-1.5 font-semibold first:mt-0 last:mb-0">{children}</p>,
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 list-disc pl-5 first:mt-0 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal pl-5 first:mt-0 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-neon">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="my-1.5 border-l-2 border-ink-edge pl-3 text-slate-400">{children}</blockquote>
          ),
          hr: () => <hr className="my-3 border-ink-edge" />,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-neon underline underline-offset-2">
              {children}
            </a>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded bg-black/40 p-3 text-xs leading-relaxed">{children}</pre>
          ),
          code: ({ className, children }) =>
            className?.includes('language-') ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.85em] text-neon">{children}</code>
            ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-ink-edge bg-ink-card/60 px-2.5 py-1.5 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-ink-edge px-2.5 py-1.5">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
