import type { AiUsage, Priority, Role, Task, TaskStatus, User } from './types'
import { daysLate, durationMs, isOverdue, timeToStartMs, wasDeliveredLate } from './time'
import { PRIORITY_ORDER } from './catalog'
import { TASK_STATUSES } from './types'

const DAY = 86_400_000

export interface AnalyticsInput {
  tasks: Task[]
  users: User[]
  usage: AiUsage[]
  now: Date
  rangeDays: number | null
}

export interface TeamRow {
  id: string
  name: string
  role: Role
  color: string
  active: number
  inProgress: number
  inReview: number
  completed: number
  overdue: number
  credits: number
  avgCompletionMs: number | null
}

export interface AnalyticsReport {
  generatedAt: string
  rangeDays: number | null
  totals: {
    all: number
    byStatus: Record<TaskStatus, number>
    completed: number
    active: number
    overdue: number
    unassigned: number
    revisions: number
    completionRate: number
  }
  timing: {
    avgCompletionMs: number | null
    medianCompletionMs: number | null
    avgTimeToStartMs: number | null
    avgRevisions: number
    onTimeRate: number | null
  }
  team: TeamRow[]
  ai: {
    totalCredits: number
    entries: number
    byService: { service: string; credits: number; entries: number; tasks: number }[]
    byUser: { userId: string; name: string; credits: number; entries: number }[]
    byPhase: { initial: number; revision: number }
  }
  overdueTasks: {
    id: string
    code: string
    offer: string
    deadline: string
    assigneeName: string | null
    daysLate: number
  }[]
  priorityMix: { priority: Priority; count: number }[]
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function roundCredits(value: number): number {
  return Math.round(value * 100) / 100
}

export function buildAnalytics(input: AnalyticsInput): AnalyticsReport {
  const { users, now, rangeDays } = input

  const tasks =
    rangeDays === null
      ? input.tasks
      : input.tasks.filter((task) => Date.parse(task.createdAt) >= now.getTime() - rangeDays * DAY)
  const includedIds = new Set(tasks.map((task) => task.id))
  const usage = input.usage.filter((entry) => includedIds.has(entry.taskId))

  const byStatus = Object.fromEntries(TASK_STATUSES.map((status) => [status, 0])) as Record<TaskStatus, number>
  for (const task of tasks) byStatus[task.status] += 1

  const completed = tasks.filter((task) => task.status === 'done')
  // «Просрочки» = задачи, которые просрочены прямо сейчас. Опоздания по завершённым
  // учитываются отдельно через timing.onTimeRate.
  const overdue = tasks.filter((task) => task.status !== 'done' && isOverdue(task, now))
  const userById = new Map(users.map((user) => [user.id, user]))

  const completedDurations = completed
    .map((task) => durationMs(task, now))
    .filter((value): value is number => value !== null)
  const startDurations = tasks
    .map((task) => timeToStartMs(task))
    .filter((value): value is number => value !== null)
  const revisions = tasks.reduce((sum, task) => sum + task.revisionCount, 0)
  const onTime = completed.filter((task) => !wasDeliveredLate(task)).length

  const team: TeamRow[] = users
    .filter((user) => user.role !== 'manager')
    .map((user) => {
      const relevant = tasks.filter((task) =>
        user.role === 'buyer' ? task.buyerId === user.id : task.assigneeId === user.id,
      )
      const ownCompleted = user.role === 'creative' ? relevant.filter((task) => task.status === 'done') : []
      const durations = ownCompleted
        .map((task) => durationMs(task, now))
        .filter((value): value is number => value !== null)
      const credits = usage.filter((entry) => entry.userId === user.id).reduce((sum, entry) => sum + entry.credits, 0)

      return {
        id: user.id,
        name: user.name,
        role: user.role,
        color: user.color,
        active: relevant.filter((task) => task.status !== 'done').length,
        inProgress: relevant.filter((task) => task.status === 'in_progress').length,
        inReview: relevant.filter((task) => task.status === 'review').length,
        completed: ownCompleted.length,
        overdue: relevant.filter((task) => task.status !== 'done' && isOverdue(task, now)).length,
        credits: roundCredits(credits),
        avgCompletionMs: average(durations),
      }
    })
    .sort((a, b) => {
      const rank = (role: Role) => (role === 'creative' ? 0 : 1)
      return rank(a.role) - rank(b.role) || b.active - a.active || a.name.localeCompare(b.name, 'ru')
    })

  const serviceMap = new Map<string, { credits: number; entries: number; tasks: Set<string> }>()
  const userSpend = new Map<string, { credits: number; entries: number }>()
  const phase = { initial: 0, revision: 0 }
  let creditsTotal = 0

  for (const entry of usage) {
    creditsTotal += entry.credits
    phase[entry.phase] += entry.credits
    const service = serviceMap.get(entry.service) ?? { credits: 0, entries: 0, tasks: new Set<string>() }
    service.credits += entry.credits
    service.entries += 1
    service.tasks.add(entry.taskId)
    serviceMap.set(entry.service, service)

    const spender = userSpend.get(entry.userId) ?? { credits: 0, entries: 0 }
    spender.credits += entry.credits
    spender.entries += 1
    userSpend.set(entry.userId, spender)
  }

  return {
    generatedAt: now.toISOString(),
    rangeDays,
    totals: {
      all: tasks.length,
      byStatus,
      completed: completed.length,
      active: tasks.length - completed.length,
      overdue: overdue.length,
      unassigned: tasks.filter((task) => !task.assigneeId).length,
      revisions,
      completionRate: tasks.length === 0 ? 0 : completed.length / tasks.length,
    },
    timing: {
      avgCompletionMs: average(completedDurations),
      medianCompletionMs: median(completedDurations),
      avgTimeToStartMs: average(startDurations),
      avgRevisions: tasks.length === 0 ? 0 : revisions / tasks.length,
      onTimeRate: completed.length === 0 ? null : onTime / completed.length,
    },
    team,
    ai: {
      totalCredits: roundCredits(creditsTotal),
      entries: usage.length,
      byService: [...serviceMap.entries()]
        .map(([service, value]) => ({
          service,
          credits: roundCredits(value.credits),
          entries: value.entries,
          tasks: value.tasks.size,
        }))
        .sort((a, b) => b.credits - a.credits || a.service.localeCompare(b.service)),
      byUser: [...userSpend.entries()]
        .map(([userId, value]) => ({
          userId,
          name: userById.get(userId)?.name ?? 'Неизвестный',
          credits: roundCredits(value.credits),
          entries: value.entries,
        }))
        .sort((a, b) => b.credits - a.credits || a.name.localeCompare(b.name, 'ru')),
      byPhase: { initial: roundCredits(phase.initial), revision: roundCredits(phase.revision) },
    },
    overdueTasks: overdue
      .map((task) => ({
        id: task.id,
        code: task.code,
        offer: task.offer,
        deadline: task.deadline,
        assigneeName: task.assigneeId ? userById.get(task.assigneeId)?.name ?? null : null,
        daysLate: daysLate(task, now),
      }))
      .sort((a, b) => b.daysLate - a.daysLate),
    priorityMix: PRIORITY_ORDER.map((priority) => ({
      priority,
      count: tasks.filter((task) => task.priority === priority).length,
    })),
  }
}