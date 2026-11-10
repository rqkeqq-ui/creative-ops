import { appCtx, handle, json, tokenFromRequest } from '@/lib/api/http'
import { clearedSessionCookie, logout } from '@/lib/services/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handle(async () => {
    logout(appCtx(), tokenFromRequest(request))
    return json({ ok: true }, { status: 200, headers: { 'set-cookie': clearedSessionCookie() } })
  })
}