import { ScanBeam } from '@/components/scan/ScanBeam'
import { Skeleton } from '@/components/ui/skeleton'

export default function ReportLoading() {
  return (
    <main className="relative mx-auto min-h-screen max-w-7xl px-6 py-8">
      <ScanBeam />
      <Skeleton className="h-24 w-full" />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[420px]" />
        <div className="grid gap-6 lg:col-span-2 lg:grid-cols-2">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
      <Skeleton className="mt-6 h-40 w-full" />
    </main>
  )
}
