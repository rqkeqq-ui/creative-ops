import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAnalyticsReport } from '@/lib/services/analytics'
import { expectAppError } from '../helpers/errors'
import { makeTestContext, type TestContext } from '../helpers/db'
import type { User } from '@/lib/domain/types'

let t: TestContext
let manager: User

beforeEach(() => {
  t = makeTestContext({ seed: 'full' })
  manager = t.user('lead@creativeops.demo')
})

afterEach(() => t.cleanup())

describe('аналитика руководителя (интеграция с БД)', () => {
  it('внутренне согласована: суммы разрезов совпадают с итогами', () => {
    const report = getAnalyticsReport(t.ctx, manager)

    const byStatusSum = Object.values(report.totals.byStatus).reduce((a, b) => a + b, 0)
    expect(byStatusSum).toBe(report.totals.all)
    expect(report.totals.completed).toBe(report.totals.byStatus.done)
    expect(report.totals.active).toBe(report.totals.all - report.totals.completed)

    const serviceSum = report.ai.byService.reduce((sum, row) => sum + row.credits, 0)
    const userSum = report.ai.byUser.reduce((sum, row) => sum + row.credits, 0)
    expect(serviceSum).toBeCloseTo(report.ai.totalCredits, 6)
    expect(userSum).toBeCloseTo(report.ai.totalCredits, 6)
    expect(report.ai.byPhase.initial + report.ai.byPhase.revision).toBeCloseTo(report.ai.totalCredits, 6)

    const teamCompleted = report.team.reduce((sum, row) => sum + row.completed, 0)
    expect(teamCompleted).toBe(report.totals.completed)

    expect(report.timing.onTimeRate).toBeGreaterThanOrEqual(0)
    expect(report.timing.onTimeRate).toBeLessThanOrEqual(1)
  })

  it('строит загрузку по каждому исполнителю с кредитами', () => {
    const report = getAnalyticsReport(t.ctx, manager)
    const creatives = report.team.filter((row) => row.role === 'creative')
    expect(creatives.length).toBeGreaterThanOrEqual(2)
    for (const row of creatives) {
      expect(row.active + row.completed).toBeGreaterThan(0)
      expect(row.credits).toBeGreaterThanOrEqual(0)
      expect(row.name.length).toBeGreaterThan(0)
    }
    expect(report.team.some((row) => row.overdue > 0)).toBe(true)
  })

  it('фильтрует по периоду и не ломает итоги', () => {
    const all = getAnalyticsReport(t.ctx, manager)
    const week = getAnalyticsReport(t.ctx, manager, { rangeDays: 7 })
    expect(week.totals.all).toBeLessThan(all.totals.all)
    expect(week.totals.all).toBeGreaterThan(0)
    expect(week.ai.totalCredits).toBeLessThanOrEqual(all.ai.totalCredits)
    const sum = Object.values(week.totals.byStatus).reduce((a, b) => a + b, 0)
    expect(sum).toBe(week.totals.all)
  })

  it('считает просрочки по дате, а не по статусу', () => {
    const report = getAnalyticsReport(t.ctx, manager)
    expect(report.totals.overdue).toBe(report.overdueTasks.length)
    for (const item of report.overdueTasks) {
      expect(item.daysLate).toBeGreaterThan(0)
      expect(item.code).toMatch(/^CR-\d+$/)
    }
  })

  it('закрыта для байеров и креативщиков', async () => {
    await expectAppError(() => getAnalyticsReport(t.ctx, t.user('buyer@creativeops.demo')), 'FORBIDDEN')
    await expectAppError(() => getAnalyticsReport(t.ctx, t.user('creative@creativeops.demo')), 'FORBIDDEN')
  })
})