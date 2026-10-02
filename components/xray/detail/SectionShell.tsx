import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * PRO 详读层 section 容器（威胁情报式）：锚点 id + 编号标题（SEC.0N）+ 卡片。
 * 编号与微步报告的小节序号同款：mono 小字 + 标题 + 细分隔线。
 */
export function SectionShell({ id, index, title, children }: { id: string; index?: number; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <Card>
        <CardHeader className="border-b border-edge/60">
          <CardTitle className="flex items-baseline gap-3">
            {index !== undefined && (
              <span className="font-mono text-[10px] tracking-[0.3em] text-neon">
                SEC.{String(index).padStart(2, '0')}
              </span>
            )}
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  )
}
