import { appCtx, currentUser, handle, json } from '@/lib/api/http'
import { getMeta } from '@/lib/services/tasks'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handle(() => {
    currentUser(request)
    return json(getMeta(appCtx()))
  })
}