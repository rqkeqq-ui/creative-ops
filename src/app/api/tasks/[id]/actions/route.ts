import { appCtx, currentUser, handle, json, readJson } from '@/lib/api/http'
import { applyAction } from '@/lib/services/tasks'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { user } = currentUser(request)
    const { id } = await params
    const body = await readJson(request)
    return json({ task: applyAction(appCtx(), user, id, body) })
  })
}