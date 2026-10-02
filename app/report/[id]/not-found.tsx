import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ReportNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="font-mono text-6xl text-danger text-glow-danger">404</div>
      <p className="max-w-sm text-sm text-slate-400">
        未找到该公司的数据。演示版仅收录 3 家预设企业；接入真实数据源后可查询任意 A 股公司（见 docs/DOC-A）。
      </p>
      <Button asChild variant="outline">
        <Link href="/">返回首页重新扫描</Link>
      </Button>
    </main>
  )
}
