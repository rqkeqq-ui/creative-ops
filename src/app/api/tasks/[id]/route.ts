import { appCtx, currentUser, handle, json } from '@/lib/api/http'
import { getTaskDetail } from '@/lib/services/tasks'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { user } = currentUser(request)
    const { id } = await params
    return json({ task: getTaskDetail(appCtx(), user, id) })
  })
}