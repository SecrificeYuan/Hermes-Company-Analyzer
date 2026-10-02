import { llmAvailable } from '@/lib/llm/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ available: llmAvailable() })
}
