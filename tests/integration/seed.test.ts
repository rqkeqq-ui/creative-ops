import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { seedDatabase, DEMO_PASSWORD, DEMO_USERS } from '@/lib/seed'
import { activityRepo, aiUsageRepo, tasksRepo, usersRepo } from '@/lib/db/repositories'
import { login } from '@/lib/services/auth'
import { getAnalyticsReport } from '@/lib/services/analytics'
import { makeTestContext, type TestContext } from '../helpers/db'
import { TASK_STATUSES } from '@/lib/domain/types'

let t: TestContext

beforeEach(() => {
  t = makeTestContext({ seed: 'full' })
})

afterEach(() => t.cleanup())

describe('демо-данные', () => {
  it('создаёт 6 пользователей со всеми тремя ролями', () => {
    expect(DEMO_USERS).toHaveLength(6)
    const users = usersRepo.list(t.db)
    expect(users).toHaveLength(6)
    expect(new Set(users.map((u) => u.role))).toEqual(new Set(['manager', 'buyer', 'creative']))
    expect(users.filter((u) => u.role === 'creative').length).toBeGreaterThanOrEqual(2)
    expect(users.filter((u) => u.role === 'buyer').length).toBeGreaterThanOrEqual(1)
  })

  it('создаёт задачи во всех статусах Kanban, часть — с просрочкой', () => {
    const tasks = tasksRepo.list(t.db)
    expect(tasks.length).toBeGreaterThanOrEqual(12)
    for (const status of TASK_STATUSES) {
      expect(tasks.filter((task) => task.status === status).length, `no demo task in ${status}`).toBeGreaterThan(0)
    }
    expect(tasks.filter((task) => task.assigneeId).length).toBeGreaterThanOrEqual(8)
    expect(tasks.filter((task) => task.revisionCount > 0).length).toBeGreaterThanOrEqual(2)
    expect(tasks.filter((task) => task.status === 'done').length).toBeGreaterThanOrEqual(4)
  })

  it('наполняет историю и AI-расходы', () => {
    const tasks = tasksRepo.list(t.db)
    const usage = aiUsageRepo.listAll(t.db)
    expect(usage.length).toBeGreaterThanOrEqual(10)
    expect(new Set(usage.map((u) => u.phase))).toEqual(new Set(['initial', 'revision']))
    expect(usage.reduce((sum, u) => sum + u.credits, 0)).toBeGreaterThan(100)

    const activityCount = tasks.reduce((sum, task) => sum + activityRepo.listByTask(t.db, task.id).length, 0)
    expect(activityCount).toBeGreaterThan(tasks.length * 2)
  })

  it('регистрирует всех демо-пользователей с паролем demo1234', async () => {
    for (const demo of DEMO_USERS) {
      const result = await login(t.ctx, { email: demo.email, password: DEMO_PASSWORD })
      expect(result.user.email).toBe(demo.email)
      expect(result.token.length).toBeGreaterThan(20)
    }
  })

  it('не дублирует данные при повторном сидировании', () => {
    const before = { users: usersRepo.list(t.db).length, tasks: tasksRepo.list(t.db).length, usage: aiUsageRepo.listAll(t.db).length }
    seedDatabase(t.db, t.clock.current)
    expect({ users: usersRepo.list(t.db).length, tasks: tasksRepo.list(t.db).length, usage: aiUsageRepo.listAll(t.db).length }).toEqual(before)
  })

  it('даёт руководителю осмысленную аналитику', () => {
    const manager = t.user('lead@creativeops.demo')
    const report = getAnalyticsReport(t.ctx, manager)
    expect(report.totals.all).toBe(tasksRepo.list(t.db).length)
    expect(report.totals.completed).toBeGreaterThanOrEqual(4)
    expect(report.totals.overdue).toBeGreaterThanOrEqual(1)
    expect(report.ai.totalCredits).toBeGreaterThan(100)
    expect(report.ai.byService.length).toBeGreaterThanOrEqual(3)
    expect(report.team).toHaveLength(5)
    expect(report.timing.avgCompletionMs).not.toBeNull()
  })
})