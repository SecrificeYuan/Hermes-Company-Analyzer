import { NextResponse } from 'next/server'
import { CompanyNotFoundError, fetchRawCompany, NoVerifiedDataError } from '@/lib/data/fetcher'
import { CompanyLookupUnavailableError } from '@/lib/data/eastmoney'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    return NextResponse.json(await fetchRawCompany(id))
  } catch (error) {
    if (error instanceof CompanyNotFoundError) {
      return NextResponse.json({ error: 'COMPANY_NOT_FOUND', id }, { status: 404 })
    }
    if (error instanceof NoVerifiedDataError || error instanceof CompanyLookupUnavailableError) {
      return NextResponse.json({ error: error.message.split(':')[0], id }, { status: 503 })
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
