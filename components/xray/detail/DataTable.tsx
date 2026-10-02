import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DetailColumn<T> {
  key: string
  label: string
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
}

/**
 * PRO 详读层紧凑表格：font-mono 终端风、数字右对齐、行 hover 高亮、统一空态。
 * 数据多于 maxRows 时截断并显示 "+N more"。
 */
export function DetailTable<T>({
  columns,
  rows,
  rowKey,
  maxRows = 12,
  empty = '░ 数据暂缺',
}: {
  columns: DetailColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  maxRows?: number
  empty?: string
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center rounded-btn border border-dashed border-edge font-mono text-xs text-slate-500">
        {empty}
      </div>
    )
  }
  const shown = rows.slice(0, maxRows)
  return (
    <div className="overflow-x-auto rounded-btn border border-edge">
      <table className="w-full font-mono text-xs">
        <thead>
          <tr className="border-b border-edge text-left text-slate-500">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn('whitespace-nowrap px-3 py-2 font-medium', c.align === 'right' && 'text-right')}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={rowKey(row)} className="border-b border-edge/50 transition-colors last:border-0 hover:bg-neon/5">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn('whitespace-nowrap px-3 py-2 text-slate-300', c.align === 'right' && 'text-right')}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div className="border-t border-edge px-3 py-1.5 text-right font-mono text-[10px] text-slate-500">
          +{rows.length - maxRows} 条，详见证据溯源
        </div>
      )}
    </div>
  )
}
