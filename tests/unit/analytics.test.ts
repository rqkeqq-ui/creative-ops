import { describe, expect, it } from 'vitest'
import { buildAnalytics } from '@/lib/domain/analytics'
import { makeTask, makeUsage, makeUser } from '../helpers/fixtures'
import type { AiUsage, Task, User } from '@/lib/domain/types'

const NOW = new Date('2026-11-10T12:00:00.000Z')
const HOUR = 3_600_000
const DAY = 24 * HOUR
const iso = (offset: number) => new Date(NOW.getTime() + offset).toISOString()

const manager = makeUser({ id: 'manager-1', name: 'Анна', role: 'manager' })
const buyer = makeUser({ id: 'buyer-1', name: 'Илья', role: 'buyer' })
const c1 = makeUser({ id: 'creative-1', name: 'Даниил', role: 'creative' })
const c2 = makeUser({ id: 'creative-2', name: 'Софья', role: 'creative' })
const users: User[] = [manager, buyer, c1, c2]

const tasks: Task[] = [
  makeTask({
    id: 't1', code: 'CR-1001', status: 'new', buyerId: buyer.id, assigneeId: null,
    priority: 'high', createdAt: iso(-1 * DAY), deadline: iso(2 * DAY),
  }),
  makeTask({
    id: 't2', code: 'CR-1002', status: 'in_progress', buyerId: buyer.id, assigneeId: c1.id,
    priority: 'urgent', createdAt: iso(-3 * DAY), firstStartedAt: iso(-2 * DAY), deadline: iso(1 * DAY),
  }),
  makeTask({
    id: 't3', code: 'CR-1003', status: 'review', buyerId: buyer.id, assigneeId: c1.id,
    priority: 'normal', createdAt: iso(-4 * DAY), firstStartedAt: iso(-3 * DAY),
    submittedAt: iso(-1 * DAY), deadline: iso(3 * DAY),
  }),
  makeTask({
    id: 't4', code: 'CR-1004', status: 'revision', buyerId: buyer.id, assigneeId: c2.id,
    priority: 'normal', createdAt: iso(-6 * DAY), firstStartedAt: iso(-5 * DAY),
    submittedAt: iso(-4 * DAY), deadline: iso(-1 * DAY), revisionCount: 1,
  }),
  makeTask({
    id: 't5', code: 'CR-1005', status: 'done', buyerId: buyer.id, assigneeId: c2.id,
    priority: 'low', createdAt: iso(-8 * DAY), firstStartedAt: iso(-7 * DAY),
    completedAt: iso(-6 * DAY), deadline: iso(-5 * DAY),
  }),
  makeTask({
    id: 't6', code: 'CR-1006', status: 'done', buyerId: buyer.id, assigneeId: c1.id,
    priority: 'normal', createdAt: iso(-9 * DAY), firstStartedAt: iso(-8 * DAY),
    completedAt: iso(-7 * DAY), deadline: iso(-7.5 * DAY),
  }),
  makeTask({
    id: 't7', code: 'CR-1007', status: 'done', buyerId: buyer.id, assigneeId: c1.id,
    priority: 'normal', createdAt: iso(-40 * DAY), firstStartedAt: iso(-39 * DAY),
    completedAt: iso(-33 * DAY), deadline: iso(-30 * DAY),
  }),
  makeTask({
    id: 't8', code: 'CR-1008', status: 'new', buyerId: buyer.id, assigneeId: null,
    priority: 'urgent', createdAt: iso(-2 * DAY), deadline: iso(-1 * HOUR),
  }),
]

const usage: AiUsage[] = [
  makeUsage({ id: 'u1', taskId: 't1', userId: c1.id, service: 'Midjourney', credits: 10, phase: 'initial' }),
  makeUsage({ id: 'u2', taskId: 't5', userId: c2.id, service: 'Midjourney', credits: 5, phase: 'initial' }),
  makeUsage({ id: 'u3', taskId: 't4', userId: c2.id, service: 'Runway', credits: 20, phase: 'revision' }),
  makeUsage({ id: 'u4', taskId: 't2', userId: c1.id, service: 'ChatGPT', credits: 2, phase: 'initial' }),
]

const report = buildAnalytics({ tasks, users, usage, now: NOW, rangeDays: null })

describe('analytics: totals', () => {
  it('counts tasks per kanban column', () => {
    expect(report.totals.all).toBe(8)
    expect(report.totals.byStatus).toEqual({ new: 2, in_progress: 1, review: 1, revision: 1, done: 3 })
    expect(report.totals.active).toBe(5)
    expect(report.totals.completed).toBe(3)
    expect(report.totals.unassigned).toBe(2)
    expect(report.totals.revisions).toBe(1)
    expect(report.totals.completionRate).toBeCloseTo(3 / 8, 5)
  })

  it('counts unfinished and late deliveries as overdue', () => {
    expect(report.totals.overdue).toBe(2)
    expect(report.overdueTasks.map((t) => t.id)).toEqual(['t4', 't8'])
    expect(report.overdueTasks[0].daysLate).toBeCloseTo(1, 5)
    expect(report.overdueTasks[1].daysLate).toBeCloseTo(1 / 24, 5)
  })
})

describe('analytics: timing', () => {
  it('averages completion time over done tasks only', () => {
    // t5: 1d, t6: 1d, t7: 6d → average 8/3 days
    expect(report.timing.avgCompletionMs).toBeCloseTo((8 / 3) * DAY, -3)
    expect(report.timing.medianCompletionMs).toBe(DAY)
    expect(report.timing.avgTimeToStartMs).toBe(DAY)
    expect(report.timing.avgRevisions).toBeCloseTo(1 / 8, 5)
    expect(report.timing.onTimeRate).toBeCloseTo(2 / 3, 5)
  })
})

describe('analytics: workload', () => {
  it('builds a row for every non-manager employee', () => {
    expect(report.team.map((t) => t.id).sort()).toEqual([buyer.id, c1.id, c2.id].sort())
    expect(report.team.find((t) => t.id === manager.id)).toBeUndefined()
  })

  it('computes creative load, completions, credits and overdue', () => {
    const row1 = report.team.find((t) => t.id === c1.id)!
    expect(row1).toMatchObject({ active: 2, inProgress: 1, inReview: 1, completed: 2, overdue: 0, credits: 12 })
    expect(row1.avgCompletionMs).toBeCloseTo((1 + 6) / 2 * DAY, -3)

    const row2 = report.team.find((t) => t.id === c2.id)!
    expect(row2).toMatchObject({ active: 1, inProgress: 0, completed: 1, overdue: 1, credits: 25 })

    const buyerRow = report.team.find((t) => t.id === buyer.id)!
    expect(buyerRow).toMatchObject({ role: 'buyer', active: 5, completed: 0, credits: 0 })
  })
})

describe('analytics: AI spend', () => {
  it('aggregates credits by service, employee and phase', () => {
    expect(report.ai.totalCredits).toBe(37)
    expect(report.ai.entries).toBe(4)
    expect(report.ai.byPhase).toEqual({ initial: 17, revision: 20 })

    expect(report.ai.byService.map((s) => s.service)).toEqual(['Runway', 'Midjourney', 'ChatGPT'])
    expect(report.ai.byService[0]).toMatchObject({ credits: 20, entries: 1, tasks: 1 })
    expect(report.ai.byService[1]).toMatchObject({ credits: 15, entries: 2, tasks: 2 })

    expect(report.ai.byUser.map((u) => [u.userId, u.credits])).toEqual([
      [c2.id, 25],
      [c1.id, 12],
    ])
  })

  it('mixes priorities for the breakdown chart', () => {
    expect(report.priorityMix).toEqual([
      { priority: 'urgent', count: 2 },
      { priority: 'high', count: 1 },
      { priority: 'normal', count: 4 },
      { priority: 'low', count: 1 },
    ])
  })
})

describe('analytics: range filter', () => {
  it('keeps only tasks created within the range (and their AI usage)', () => {
    const week = buildAnalytics({ tasks, users, usage, now: NOW, rangeDays: 7 })
    expect(week.totals.all).toBe(5)
    expect(week.totals.byStatus.done).toBe(0)
    expect(week.totals.overdue).toBe(2)
    expect(week.timing.avgCompletionMs).toBeNull()
    expect(week.ai.totalCredits).toBe(32)
    expect(week.ai.byService.map((s) => s.service)).toEqual(['Runway', 'Midjourney', 'ChatGPT'])
    expect(week.ai.byPhase).toEqual({ initial: 12, revision: 20 })
  })

  it('produces stable zero-state instead of NaN', () => {
    const empty = buildAnalytics({ tasks: [], users, usage: [], now: NOW, rangeDays: 30 })
    expect(empty.totals.all).toBe(0)
    expect(empty.totals.completionRate).toBe(0)
    expect(empty.timing.avgCompletionMs).toBeNull()
    expect(empty.timing.onTimeRate).toBeNull()
    expect(empty.timing.avgRevisions).toBe(0)
    expect(empty.ai.totalCredits).toBe(0)
    expect(empty.ai.byService).toEqual([])
    expect(empty.overdueTasks).toEqual([])
    expect(empty.team.every((row) => row.active === 0 && row.credits === 0)).toBe(true)
  })
})