import type { Role, Task, TaskAction, TaskStatus } from './types'

export interface ActionRule {
  label: string
  from: readonly TaskStatus[]
  to: TaskStatus
  roles: readonly Role[]
}

export const ACTIONS: Record<TaskAction, ActionRule> = {
  take: { label: 'Взять в работу', from: ['new', 'revision'], to: 'in_progress', roles: ['creative'] },
  submit: { label: 'Сдать на проверку', from: ['in_progress'], to: 'review', roles: ['creative'] },
  approve: { label: 'Принять работу', from: ['review'], to: 'done', roles: ['buyer', 'manager'] },
  request_revision: { label: 'Отправить на правки', from: ['review'], to: 'revision', roles: ['buyer', 'manager'] },
}

export type DenyCode =
  | 'FORBIDDEN'
  | 'INVALID_TRANSITION'
  | 'ASSIGNED_TO_OTHER'
  | 'NOT_ASSIGNEE'
  | 'COMMENT_REQUIRED'

export type ActionCheck =
  | { ok: true }
  | { ok: false; code: DenyCode; message: string }

const ALLOW: ActionCheck = { ok: true }

function deny(code: DenyCode, message: string): ActionCheck {
  return { ok: false, code, message }
}

export function isTaskAction(value: unknown): value is TaskAction {
  return typeof value === 'string' && (TASK_ACTIONS_SET as Set<string>).has(value)
}

const TASK_ACTIONS_SET = new Set<string>(Object.keys(ACTIONS))

export interface ActionActor {
  id: string
  role: Role
}

/**
 * Единственное место, где описано, кому и когда можно менять статус задачи.
 * Проверки идут в порядке: роль → текущий статус → принадлежность → обязательные поля.
 */
export function checkAction(
  action: TaskAction,
  actor: ActionActor,
  task: Pick<Task, 'status' | 'buyerId' | 'assigneeId'>,
  extra: { comment?: string | null } = {},
): ActionCheck {
  const rule = ACTIONS[action]

  if (!rule.roles.includes(actor.role)) {
    return deny('FORBIDDEN', 'Ваша роль не позволяет выполнить это действие')
  }

  if (!rule.from.includes(task.status)) {
    return deny('INVALID_TRANSITION', `Действие «${rule.label}» недоступно для статуса «${task.status}»`)
  }

  if (action === 'take' && task.assigneeId && task.assigneeId !== actor.id) {
    return deny('ASSIGNED_TO_OTHER', 'Задача уже закреплена за другим креативщиком')
  }

  if (action === 'submit' && task.assigneeId !== actor.id) {
    return deny('NOT_ASSIGNEE', 'Сдать работу может только назначенный исполнитель')
  }

  if ((action === 'approve' || action === 'request_revision') && actor.role === 'buyer' && task.buyerId !== actor.id) {
    return deny('FORBIDDEN', 'Принимать работу по этой задаче может только её автор или руководитель')
  }

  if (action === 'request_revision' && (extra.comment ?? '').trim().length < 5) {
    return deny('COMMENT_REQUIRED', 'Опишите, что нужно исправить (минимум 5 символов)')
  }

  return ALLOW
}

/** Подсказки для UI: какие кнопки показывать. Комментарий проверяется при отправке. */
export function allowedActions(actor: ActionActor, task: Task): TaskAction[] {
  return (Object.keys(ACTIONS) as TaskAction[]).filter(
    (action) =>
      checkAction(action, actor, task, { comment: action === 'request_revision' ? 'проверка' : undefined }).ok,
  )
}

export function canCreateTask(role: Role): boolean {
  return role === 'buyer'
}

export function canViewAnalytics(role: Role): boolean {
  return role === 'manager'
}