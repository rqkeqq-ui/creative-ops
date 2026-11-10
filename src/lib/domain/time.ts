import type { Task } from './types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export type TimeTask = Pick<Task, 'status' | 'createdAt' | 'firstStartedAt' | 'completedAt' | 'deadline'>

/** Длительность работы: от первого взятия до завершения (или до `now` для незавершённых). */
export function durationMs(task: TimeTask, now: Date): number | null {
  if (task.completedAt) {
    if (!task.firstStartedAt) return null
    return Math.max(0, Date.parse(task.completedAt) - Date.parse(task.firstStartedAt))
  }
  if (task.status === 'done') return null
  if (!task.firstStartedAt) return null
  return Math.max(0, now.getTime() - Date.parse(task.firstStartedAt))
}

/** Сколько задача ждала первого взятия в работу. */
export function timeToStartMs(task: Pick<Task, 'createdAt' | 'firstStartedAt'>): number | null {
  if (!task.firstStartedAt) return null
  return Math.max(0, Date.parse(task.firstStartedAt) - Date.parse(task.createdAt))
}

/** Просрочка: для незавершённых — дедлайн прошёл; для завершённых — сдано позже дедлайна. */
export function isOverdue(task: Pick<Task, 'status' | 'deadline' | 'completedAt'>, now: Date): boolean {
  const deadline = Date.parse(task.deadline)
  if (task.status === 'done') {
    return task.completedAt ? Date.parse(task.completedAt) > deadline : false
  }
  return now.getTime() > deadline
}

export function wasDeliveredLate(task: Pick<Task, 'status' | 'deadline' | 'completedAt'>): boolean {
  if (task.status !== 'done' || !task.completedAt) return false
  return Date.parse(task.completedAt) > Date.parse(task.deadline)
}

export function averageDurationMs(tasks: TimeTask[], now: Date): number | null {
  const durations = tasks
    .filter((task) => task.status === 'done')
    .map((task) => durationMs(task, now))
    .filter((value): value is number => value !== null)
  if (durations.length === 0) return null
  return durations.reduce((sum, value) => sum + value, 0) / durations.length
}

/** «45м», «2ч 15м», «1д 3ч». */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—'
  const total = Math.max(0, Math.floor(ms / MINUTE))
  const days = Math.floor(total / (24 * 60))
  const hours = Math.floor((total % (24 * 60)) / 60)
  const minutes = total % 60

  if (days > 0) return hours > 0 ? `${days}д ${hours}ч` : `${days}д`
  if (hours > 0) return minutes > 0 ? `${hours}ч ${minutes}м` : `${hours}ч`
  return `${minutes}м`
}

/** Просрочка в днях (дробная), для таблиц. */
export function daysLate(task: Pick<Task, 'status' | 'deadline' | 'completedAt'>, now: Date): number {
  const reference = task.status === 'done' && task.completedAt ? Date.parse(task.completedAt) : now.getTime()
  return Math.max(0, (reference - Date.parse(task.deadline)) / DAY)
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
}

export function formatDeadline(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
}

export function relativeDeadline(iso: string, now: Date): string {
  const diff = Date.parse(iso) - now.getTime()
  const abs = Math.abs(diff)
  const value = formatDuration(abs)
  return diff >= 0 ? `через ${value}` : `${value} назад`
}