import { appCtx, boolParam, currentUser, handle, json, readJson } from '@/lib/api/http'
import { createTask, getTaskDetail, listTasks, type TaskFilters } from '@/lib/services/tasks'
import { parseInput, taskFiltersSchema } from '@/lib/services/validation'
import type { Priority, TaskStatus } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handle(() => {
    const { user } = currentUser(request)
    const params = new URL(request.url).searchParams
    const filters = parseInput(taskFiltersSchema, {
      status: params.get('status') ?? undefined,
      priority: params.get('priority') ?? undefined,
      q: params.get('q') ?? undefined,
      scope: params.get('scope') ?? undefined,
    })

    const assigneeParam = params.get('assigneeId')
    const overdue = boolParam(params.get('overdue'))

    const query: TaskFilters = {
      status: filters.status as TaskStatus | undefined,
      priority: filters.priority as Priority | undefined,
      q: filters.q,
      scope: filters.scope,
      overdue,
      ...(assigneeParam === null ? {} : { assigneeId: assigneeParam === 'unassigned' ? null : assigneeParam }),
    }

    return json({ tasks: listTasks(appCtx(), user, query) })
  })
}

export async function POST(request: Request) {
  return handle(async () => {
    const { user } = currentUser(request)
    const body = await readJson(request)
    const task = createTask(appCtx(), user, body)
    return json({ task: getTaskDetail(appCtx(), user, task.id) }, { status: 201 })
  })
}