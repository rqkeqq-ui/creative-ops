import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyAction, createTask, getTaskDetail } from '@/lib/services/tasks'
import { activityRepo } from '@/lib/db/repositories'
import { expectAppError } from '../helpers/errors'
import { makeTestContext, type TestContext } from '../helpers/db'
import type { User } from '@/lib/domain/types'

const HOUR = 3_600_000

let t: TestContext
let buyer: User
let creative: User

beforeEach(() => {
  t = makeTestContext()
  buyer = t.user('buyer@creativeops.demo')
  creative = t.user('creative@creativeops.demo')
})

afterEach(() => t.cleanup())

function newTask() {
  return createTask(t.ctx, buyer, {
    offer: 'Audit Offer',
    geo: 'US, CA',
    creativeType: 'banner',
    quantity: 5,
    description: 'Пять баннеров для аудита истории изменений статусов.',
    references: [],
    priority: 'urgent',
    deadline: new Date(t.clock.current.getTime() + 12 * HOUR).toISOString(),
  })
}

describe('История действий (аудит)', () => {
  it('пишет по записи на каждое действие, включая комментарии и сдачу результата', () => {
    const task = newTask()
    applyAction(t.ctx, creative, task.id, { action: 'take' })
    applyAction(t.ctx, creative, task.id, {
      action: 'submit',
      deliverableUrl: 'https://drive.google.com/v1',
      deliverableNote: 'Первая версия',
    })
    applyAction(t.ctx, buyer, task.id, { action: 'request_revision', comment: 'Поменять оффер на баннере' })

    const entries = activityRepo.listByTask(t.db, task.id)
    expect(entries).toHaveLength(4)
    const revision = entries[3]
    expect(revision.type).toBe('revision_requested')
    expect(revision.message).toContain('Поменять оффер на баннере')
    expect(revision.fromStatus).toBe('review')
    expect(revision.toStatus).toBe('revision')

    const submission = entries[2]
    expect(submission.message).toContain('Первая версия')
    expect(submission.message).toContain('https://drive.google.com/v1')
  })

  it('не добавляет записей при запрещённых действиях', async () => {
    const task = newTask()
    const before = activityRepo.listByTask(t.db, task.id).length
    await expectAppError(() => applyAction(t.ctx, buyer, task.id, { action: 'approve' }), 'INVALID_TRANSITION')
    await expectAppError(() => applyAction(t.ctx, buyer, task.id, { action: 'take' }), 'FORBIDDEN')
    await expectAppError(() => applyAction(t.ctx, creative, task.id, { action: 'submit', deliverableUrl: 'https://x.com/a' }), 'INVALID_TRANSITION')
    expect(activityRepo.listByTask(t.db, task.id)).toHaveLength(before)
  })

  it('история не удаляется и не переписывается при последующих действиях', () => {
    const task = newTask()
    applyAction(t.ctx, creative, task.id, { action: 'take' })
    const afterTake = activityRepo.listByTask(t.db, task.id)
    applyAction(t.ctx, creative, task.id, { action: 'submit', deliverableUrl: 'https://drive.google.com/v1' })
    applyAction(t.ctx, buyer, task.id, { action: 'approve' })

    const stored = activityRepo.listByTask(t.db, task.id)
    expect(stored.length).toBe(4)
    expect(stored.slice(0, 2)).toEqual(afterTake)
    expect(stored.map((entry) => entry.type)).toEqual(['created', 'taken', 'submitted', 'approved'])
  })

  it('сохраняет историю доступной всем ролям через карточку задачи', () => {
    const task = newTask()
    applyAction(t.ctx, creative, task.id, { action: 'take' })
    const manager = t.user('lead@creativeops.demo')
    const otherCreative = t.user('creative3@creativeops.demo')
    for (const actor of [buyer, creative, manager, otherCreative]) {
      const detail = getTaskDetail(t.ctx, actor, task.id)
      expect(detail.activity.map((a) => a.type)).toEqual(['created', 'taken'])
      expect(detail.activity[0].actorName).toBe(buyer.name)
    }
  })
})