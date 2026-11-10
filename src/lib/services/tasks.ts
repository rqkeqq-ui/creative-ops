import { randomUUID } from 'node:crypto'
import { activityRepo, aiUsageRepo, tasksRepo, usersRepo } from '@/lib/db/repositories'
import type { Activity, AiUsage, Priority, Task, TaskAction, TaskStatus, User } from '@/lib/domain/types'
import { AI_SERVICES, CREATIVE_TYPES, PRIORITIES, TASK_STATUSES } from '@/lib/domain/types'
import { ACTIONS, allowedActions, canCreateTask, checkAction } from '@/lib/domain/workflow'
import { CREATIVE_TYPES as CREATIVE_TYPE_CATALOG, GEO_SUGGESTIONS, PRIORITY_LABELS, STATUS_LABELS } from '@/lib/domain/catalog'
import { daysLate, durationMs, isOverdue, timeToStartMs, wasDeliveredLate } from '@/lib/domain/time'
import { errorFromDeny, errors } from './errors'
import { type Ctx, nowIso, transaction } from './context'
import { actionSchema, aiUsageSchema, createTaskSchema, parseInput, revisionSchema, submitWorkSchema } from './validation'

export interface TaskFilters {
  status?: TaskStatus
  priority?: Priority
  assigneeId?: string | null
  q?: string
  overdue?: boolean
  scope?: 'all' | 'created' | 'assigned'
}

export interface TaskMetrics {
  durationMs: number | null
  timeToStartMs: number | null
  isOverdue: boolean
  wasDeliveredLate: boolean
  daysLate: number
}

export interface ActivityWithActor extends Activity {
  actorName: string
  actorColor: string
}

export interface AiUsageWithUser extends AiUsage {
  userName: string
}

export interface TaskDetail extends Task {
  buyer: User
  assignee: User | null
  activity: ActivityWithActor[]
  aiUsage: AiUsageWithUser[]
  creditsTotal: number
  metrics: TaskMetrics
  allowedActions: TaskAction[]
  buyerName: string
  assigneeName: string | null
}

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

function decorate(ctx: Ctx, task: Task): TaskDetail {
  const buyer = usersRepo.findById(ctx.db, task.buyerId)
  if (!buyer) throw errors.notFound('Автор задачи не найден')
  const assignee = task.assigneeId ? usersRepo.findById(ctx.db, task.assigneeId) : null
  const users = new Map<string, User>([[buyer.id, buyer]])
  if (assignee) users.set(assignee.id, assignee)

  const activity = activityRepo.listByTask(ctx.db, task.id).map((entry) => {
    const actor = users.get(entry.actorId) ?? usersRepo.findById(ctx.db, entry.actorId)
    return {
      ...entry,
      actorName: actor?.name ?? 'Неизвестный',
      actorColor: actor?.color ?? '#8B93A7',
    }
  })

  const aiUsage = aiUsageRepo.listByTask(ctx.db, task.id).map((entry) => {
    const user = users.get(entry.userId) ?? usersRepo.findById(ctx.db, entry.userId)
    return { ...entry, userName: user?.name ?? 'Неизвестный' }
  })

  const now = ctx.now()
  return {
    ...task,
    buyer,
    assignee,
    buyerName: buyer.name,
    assigneeName: assignee?.name ?? null,
    activity,
    aiUsage,
    creditsTotal: Math.round(aiUsage.reduce((sum, entry) => sum + entry.credits, 0) * 100) / 100,
    metrics: {
      durationMs: durationMs(task, now),
      timeToStartMs: timeToStartMs(task),
      isOverdue: isOverdue(task, now),
      wasDeliveredLate: wasDeliveredLate(task),
      daysLate: daysLate(task, now),
    },
    allowedActions: [],
  }
}

export interface TaskListItem extends Task {
  metrics: TaskMetrics
  buyerName: string
  assigneeName: string | null
  creditsTotal: number
}

export function getTaskDetail(ctx: Ctx, actor: User, taskId: string): TaskDetail {
  const task = tasksRepo.findById(ctx.db, taskId)
  if (!task) throw errors.notFound()
  const detail = decorate(ctx, task)
  return { ...detail, allowedActions: allowedActions(actor, task) }
}

export function listTasks(ctx: Ctx, actor: User, filters: TaskFilters = {}): TaskListItem[] {
  const now = ctx.now()
  const users = new Map(usersRepo.list(ctx.db).map((user) => [user.id, user]))
  const query = filters.q?.trim().toLowerCase()

  return tasksRepo
    .list(ctx.db)
    .filter((task) => (filters.status ? task.status === filters.status : true))
    .filter((task) => (filters.priority ? task.priority === filters.priority : true))
    .filter((task) => {
      if (!('assigneeId' in filters) || filters.assigneeId === undefined) return true
      return filters.assigneeId === null ? task.assigneeId === null : task.assigneeId === filters.assigneeId
    })
    .filter((task) => (filters.overdue ? isOverdue(task, now) : true))
    .filter((task) => (filters.scope === 'created' ? task.buyerId === actor.id : true))
    .filter((task) => (filters.scope === 'assigned' ? task.assigneeId === actor.id : true))
    .filter((task) => {
      if (!query) return true
      return [task.offer, task.code, task.geo, task.description].some((value) => value.toLowerCase().includes(query))
    })
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        Date.parse(a.deadline) - Date.parse(b.deadline) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
    )
    .map((task) => ({
      ...task,
      buyerName: users.get(task.buyerId)?.name ?? '—',
      assigneeName: task.assigneeId ? users.get(task.assigneeId)?.name ?? null : null,
      creditsTotal:
        Math.round(aiUsageRepo.listByTask(ctx.db, task.id).reduce((sum, entry) => sum + entry.credits, 0) * 100) / 100,
      metrics: {
        durationMs: durationMs(task, now),
        timeToStartMs: timeToStartMs(task),
        isOverdue: isOverdue(task, now),
        wasDeliveredLate: wasDeliveredLate(task),
        daysLate: daysLate(task, now),
      },
    }))
}

export function createTask(ctx: Ctx, actor: User, input: unknown): Task {
  if (!canCreateTask(actor.role)) {
    throw errors.forbidden('Создавать ТЗ может только медиабайер')
  }
  const parsed = parseInput(createTaskSchema, input)
  const now = ctx.now()
  if (Date.parse(parsed.deadline) <= now.getTime()) {
    throw errors.validation('Дедлайн должен быть в будущем', [
      { field: 'deadline', message: 'Выберите дату и время позже текущего момента' },
    ])
  }

  const id = randomUUID()
  const timestamp = now.toISOString()

  return transaction(ctx.db, () => {
    const task = tasksRepo.create(ctx.db, {
      id,
      buyerId: actor.id,
      offer: parsed.offer,
      geo: parsed.geo,
      creativeType: parsed.creativeType,
      quantity: parsed.quantity,
      description: parsed.description,
      references: parsed.references,
      priority: parsed.priority,
      deadline: parsed.deadline,
      status: 'new',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    activityRepo.create(ctx.db, {
      id: randomUUID(),
      taskId: id,
      actorId: actor.id,
      type: 'created',
      fromStatus: null,
      toStatus: 'new',
      message: `Задача создана: ${parsed.offer} (${parsed.geo})`,
      createdAt: timestamp,
    })
    return task
  })
}

const ACTIVITY_TYPE_BY_ACTION: Record<TaskAction, Activity['type']> = {
  take: 'taken',
  submit: 'submitted',
  approve: 'approved',
  request_revision: 'revision_requested',
}

export function applyAction(ctx: Ctx, actor: User, taskId: string, input: unknown): TaskDetail {
  const parsed = parseInput(actionSchema, input)
  const action: TaskAction = parsed.action

  const task = tasksRepo.findById(ctx.db, taskId)
  if (!task) throw errors.notFound()

  // Сначала права и переход (403/409), затем — обязательные поля действия (422).
  const check = checkAction(action, actor, task, { comment: parsed.comment })
  if (!check.ok) throw errorFromDeny(check.code, check.message)

  const submitPayload =
    action === 'submit'
      ? parseInput(submitWorkSchema, { deliverableUrl: parsed.deliverableUrl, deliverableNote: parsed.deliverableNote })
      : null
  const revisionPayload =
    action === 'request_revision' ? parseInput(revisionSchema, { comment: parsed.comment }) : null

  const timestamp = ctx.now().toISOString()
  const fromStatus = task.status
  const toStatus = ACTIONS[action].to

  transaction(ctx.db, () => {
    const patch: Parameters<typeof tasksRepo.update>[2] = { status: toStatus, updatedAt: timestamp }

    if (action === 'take') {
      patch.assigneeId = actor.id
      patch.firstStartedAt = task.firstStartedAt ?? timestamp
    }
    if (action === 'submit' && submitPayload) {
      patch.deliverableUrl = submitPayload.deliverableUrl
      patch.deliverableNote = submitPayload.deliverableNote
      patch.firstSubmittedAt = task.firstSubmittedAt ?? timestamp
      patch.submittedAt = timestamp
    }
    if (action === 'approve') {
      patch.completedAt = timestamp
    }
    if (action === 'request_revision' && revisionPayload) {
      patch.revisionCount = task.revisionCount + 1
      patch.revisionNote = revisionPayload.comment
    }

    tasksRepo.update(ctx.db, task.id, patch)

    activityRepo.create(ctx.db, {
      id: randomUUID(),
      taskId: task.id,
      actorId: actor.id,
      type: ACTIVITY_TYPE_BY_ACTION[action],
      fromStatus,
      toStatus,
      message: describeAction(action, actor, { submit: submitPayload, revision: revisionPayload }),
      createdAt: timestamp,
    })
  })

  return getTaskDetail(ctx, actor, task.id)
}

function describeAction(
  action: TaskAction,
  actor: User,
  payload: { submit: { deliverableUrl: string; deliverableNote: string | null } | null; revision: { comment: string } | null },
): string {
  switch (action) {
    case 'take':
      return `Взята в работу: ${actor.name}`
    case 'submit':
      return `Сдана на проверку${payload.submit?.deliverableNote ? `: ${payload.submit.deliverableNote}` : ''} · ${payload.submit?.deliverableUrl ?? ''}`
    case 'approve':
      return `Принята: работу одобрил ${actor.name}`
    case 'request_revision':
      return `Отправлена на правки: ${payload.revision?.comment ?? ''}`
  }
}

export function addAiUsage(ctx: Ctx, actor: User, taskId: string, input: unknown): AiUsage {
  const parsed = parseInput(aiUsageSchema, input)
  const task = tasksRepo.findById(ctx.db, taskId)
  if (!task) throw errors.notFound()
  if (actor.role !== 'creative') throw errors.forbidden('Расходы AI указывает креативщик-исполнитель')
  if (task.assigneeId !== actor.id) throw errors.forbidden('Указывать расходы может только исполнитель задачи')
  if (task.status === 'done') throw errors.conflict('TASK_CLOSED', 'Задача закрыта — расходы добавить нельзя')
  if (!task.firstStartedAt) throw errors.forbidden('Сначала возьмите задачу в работу')

  const phase = task.revisionCount > 0 ? 'revision' : 'initial'
  return aiUsageRepo.create(ctx.db, {
    id: randomUUID(),
    taskId: task.id,
    userId: actor.id,
    service: parsed.service,
    credits: parsed.credits,
    note: parsed.note,
    phase,
    createdAt: nowIso(ctx),
  })
}

export interface Meta {
  users: Pick<User, 'id' | 'name' | 'role' | 'color' | 'email'>[]
  aiServices: readonly string[]
  creativeTypes: { value: string; label: string }[]
  priorities: { value: Priority; label: string }[]
  statuses: { value: TaskStatus; label: string }[]
  geoSuggestions: string[]
}

export function getMeta(ctx: Ctx): Meta {
  return {
    users: usersRepo.list(ctx.db).map(({ id, name, role, color, email }) => ({ id, name, role, color, email })),
    aiServices: AI_SERVICES,
    creativeTypes: CREATIVE_TYPE_CATALOG,
    priorities: PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority] })),
    statuses: TASK_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
    geoSuggestions: GEO_SUGGESTIONS,
  }
}