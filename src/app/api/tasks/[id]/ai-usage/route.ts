import { appCtx, currentUser, handle, json, readJson } from '@/lib/api/http'
import { addAiUsage, getTaskDetail } from '@/lib/services/tasks'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { user } = currentUser(request)
    const { id } = await params
    const body = await readJson(request)
    const usage = addAiUsage(appCtx(), user, id, body)
    return json({ usage, task: getTaskDetail(appCtx(), user, id) }, { status: 201 })
  })
}