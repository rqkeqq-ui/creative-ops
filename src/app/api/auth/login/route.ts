import { appCtx, handle, json, readJson } from '@/lib/api/http'
import { login, sessionCookie } from '@/lib/services/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request)
    const result = await login(appCtx(), body)
    return json(
      { user: result.user, expiresAt: result.expiresAt },
      { status: 200, headers: { 'set-cookie': sessionCookie(result.token, result.expiresAt) } },
    )
  })
}