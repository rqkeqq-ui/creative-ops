import { handle, json } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(() => json({ ok: true, service: 'creative-ops', version: '1.0.0' }))
}