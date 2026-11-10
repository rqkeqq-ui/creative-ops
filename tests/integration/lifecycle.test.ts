import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyAction, createTask, getTaskDetail, listTasks } from '@/lib/services/tasks'
import { tasksRepo } from '@/lib/db/repositories'
import { expectAppError } from '../helpers/errors'
import { makeTestContext, type TestContext } from '../helpers/db'

const OFFER = 'Lifecycle Wallet Offer'
const HOUR = 3_600_000

let t: TestContext
let buyer: ReturnType<TestContext['user']>
let creative: ReturnType<TestContext['user']>

beforeEach(() => {
  t = makeTestContext()
  buyer = t.user('buyer@creativeops.demo')
  creative = t.user('creative@creativeops.demo')
})

afterEach(() => t.cleanup())

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    offer: OFFER,
    geo: 'DE, AT',
    creativeType: 'ugc_video' as const,
    quantity: 3,
    description: 'Три вертикальных UGC-видео с озвучкой на немецком языке.',
    references: ['https://example.com/ref'],
    priority: 'high' as const,
    deadline: new Date(t.clock.current.getTime() + 48 * HOUR).toISOString(),
    ...overrides,
  }
}

describe('task creation', () => {
  it('creates a task with code, new status, empty timestamps and audit record', () => {
    const task = createTask(t.ctx, buyer, createInput())
    expect(task.code).toMatch(/^CR-\d{3,}$/)
    expect(task.status).toBe('new')
    expect(task.buyerId).toBe(buyer.id)
    expect(task.assigneeId).toBeNull()
    expect(task.firstStartedAt).toBeNull()
    expect(task.submittedAt).toBeNull()
    expect(task.completedAt).toBeNull()
    expect(task.references).toEqual(['https://example.com/ref'])
    expect(task.createdAt).toBe(t.clock.current.toISOString())

    const detail = getTaskDetail(t.ctx, buyer, task.id)
    expect(detail.activity).toHaveLength(1)
    expect(detail.activity[0]).toMatchObject({ type: 'created', fromStatus: null, toStatus: 'new', actorId: buyer.id })
    expect(detail.buyer.id).toBe(buyer.id)
    expect(detail.allowedActions).toEqual([])
  })

  it('rejects invalid input and deadlines in the past', async () => {
    await expectAppError(() => createTask(t.ctx, buyer, createInput({ offer: '' })), 'VALIDATION_ERROR')
    await expectAppError(() => createTask(t.ctx, buyer, createInput({ quantity: 0 })), 'VALIDATION_ERROR')
    await expectAppError(
      () => createTask(t.ctx, buyer, createInput({ deadline: new Date(t.clock.current.getTime() - HOUR).toISOString() })),
      'VALIDATION_ERROR',
    )
  })

  it('does not create an audit record when validation fails', () => {
    const before = tasksRepo.list(t.db).length
    try {
      createTask(t.ctx, buyer, createInput({ description: 'x' }))
    } catch {
      // expected
    }
    expect(tasksRepo.list(t.db)).toHaveLength(before)
  })
})

describe('full lifecycle', () => {
  it('moves through take → submit → revision → take → submit → approve and freezes timings', async () => {
    const start = t.clock.current.getTime()
    const task = createTask(t.ctx, buyer, createInput())

    t.clock.current = new Date(start + 1 * HOUR)
    let detail = applyAction(t.ctx, creative, task.id, { action: 'take' })
    expect(detail.status).toBe('in_progress')
    expect(detail.assigneeId).toBe(creative.id)
    expect(detail.firstStartedAt).toBe(new Date(start + HOUR).toISOString())
    expect(detail.metrics.timeToStartMs).toBe(HOUR)

    // Buyer cannot approve work that is not in review yet.
    await expectAppError(() => applyAction(t.ctx, buyer, task.id, { action: 'approve' }), 'INVALID_TRANSITION')

    t.clock.current = new Date(start + 3 * HOUR)
    detail = applyAction(t.ctx, creative, task.id, {
      action: 'submit',
      deliverableUrl: 'https://drive.google.com/deliverable-1',
      deliverableNote: 'Первые 3 видео готовы',
    })
    expect(detail.status).toBe('review')
    expect(detail.submittedAt).toBe(new Date(start + 3 * HOUR).toISOString())
    expect(detail.firstSubmittedAt).toBe(detail.submittedAt)
    expect(detail.deliverableUrl).toBe('https://drive.google.com/deliverable-1')
    // Подсказки действий зависят от зрителя: байер может принять/вернуть, креативщик — нет.
    expect(detail.allowedActions).toEqual([])
    expect(getTaskDetail(t.ctx, buyer, task.id).allowedActions).toEqual(['approve', 'request_revision'])

    t.clock.current = new Date(start + 4 * HOUR)
    detail = applyAction(t.ctx, buyer, task.id, {
      action: 'request_revision',
      comment: 'Заменить первые 2 секунды и добавить субтитры',
    })
    expect(detail.status).toBe('revision')
    expect(detail.revisionCount).toBe(1)
    expect(detail.revisionNote).toBe('Заменить первые 2 секунды и добавить субтитры')
    expect(detail.allowedActions).toEqual([])
    expect(getTaskDetail(t.ctx, creative, task.id).allowedActions).toEqual(['take'])

    t.clock.current = new Date(start + 5 * HOUR)
    detail = applyAction(t.ctx, creative, task.id, { action: 'take' })
    expect(detail.status).toBe('in_progress')
    expect(detail.firstStartedAt, 'first start must never be overwritten').toBe(new Date(start + HOUR).toISOString())
    expect(detail.revisionCount).toBe(1)

    t.clock.current = new Date(start + 7 * HOUR)
    detail = applyAction(t.ctx, creative, task.id, {
      action: 'submit',
      deliverableUrl: 'https://drive.google.com/deliverable-2',
    })
    expect(detail.status).toBe('review')
    expect(detail.submittedAt).toBe(new Date(start + 7 * HOUR).toISOString())
    expect(detail.firstSubmittedAt).toBe(new Date(start + 3 * HOUR).toISOString())

    t.clock.current = new Date(start + 8 * HOUR)
    detail = applyAction(t.ctx, buyer, task.id, { action: 'approve' })
    expect(detail.status).toBe('done')
    expect(detail.completedAt).toBe(new Date(start + 8 * HOUR).toISOString())
    expect(detail.metrics.durationMs).toBe(7 * HOUR)
    expect(detail.metrics.isOverdue).toBe(false)
    expect(detail.allowedActions).toEqual([])

    const stored = tasksRepo.findById(t.db, task.id)!
    expect(stored.status).toBe('done')
    expect(stored.completedAt).toBe(detail.completedAt)
  })

  it('keeps a complete, ordered audit trail of status changes', () => {
    const start = t.clock.current.getTime()
    const task = createTask(t.ctx, buyer, createInput())

    const step = (hours: number) => {
      t.clock.current = new Date(start + hours * HOUR)
    }

    step(1)
    applyAction(t.ctx, creative, task.id, { action: 'take' })
    step(2)
    applyAction(t.ctx, creative, task.id, { action: 'submit', deliverableUrl: 'https://example.com/v1' })
    step(3)
    applyAction(t.ctx, buyer, task.id, { action: 'request_revision', comment: 'Поправить субтитры' })
    step(4)
    applyAction(t.ctx, creative, task.id, { action: 'take' })
    step(5)
    applyAction(t.ctx, creative, task.id, { action: 'submit', deliverableUrl: 'https://example.com/v2' })
    step(6)
    applyAction(t.ctx, buyer, task.id, { action: 'approve' })

    const detail = getTaskDetail(t.ctx, buyer, task.id)
    expect(detail.activity.map((a) => a.type)).toEqual([
      'created',
      'taken',
      'submitted',
      'revision_requested',
      'taken',
      'submitted',
      'approved',
    ])
    expect(detail.activity.map((a) => [a.fromStatus, a.toStatus])).toEqual([
      [null, 'new'],
      ['new', 'in_progress'],
      ['in_progress', 'review'],
      ['review', 'revision'],
      ['revision', 'in_progress'],
      ['in_progress', 'review'],
      ['review', 'done'],
    ])
    expect(detail.activity.map((a) => a.actorId)).toEqual([
      buyer.id, creative.id, creative.id, buyer.id, creative.id, creative.id, buyer.id,
    ])
    const timestamps = detail.activity.map((a) => Date.parse(a.createdAt))
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b))
  })
})

describe('task listing and filters', () => {
  it('supports status, assignee, search, overdue and ownership filters', () => {
    const start = t.clock.current.getTime()
    const a = createTask(t.ctx, buyer, createInput({ offer: 'Alpha Offer' }))
    const b = createTask(t.ctx, buyer, createInput({ offer: 'Beta Offer' }))
    const c = createTask(t.ctx, buyer, createInput({ offer: 'Gamma Offer', deadline: new Date(start + 2 * HOUR).toISOString() }))
    applyAction(t.ctx, creative, a.id, { action: 'take' })
    applyAction(t.ctx, creative, b.id, { action: 'take' })

    t.clock.current = new Date(start + 3 * HOUR)

    expect(listTasks(t.ctx, buyer, { status: 'new' }).map((x) => x.id)).toEqual([c.id])
    expect(listTasks(t.ctx, buyer, { assigneeId: creative.id }).map((x) => x.id).sort()).toEqual([a.id, b.id].sort())
    expect(listTasks(t.ctx, buyer, { q: 'beta' }).map((x) => x.id)).toEqual([b.id])
    expect(listTasks(t.ctx, buyer, { overdue: true }).map((x) => x.id)).toEqual([c.id])
    expect(listTasks(t.ctx, buyer, { scope: 'created' })).toHaveLength(3)
    expect(listTasks(t.ctx, creative, { scope: 'created' })).toHaveLength(0)
    expect(listTasks(t.ctx, buyer, { priority: 'urgent' })).toHaveLength(0)
  })

  it('returns 404 for a missing task', async () => {
    await expectAppError(() => getTaskDetail(t.ctx, buyer, 'does-not-exist'), 'NOT_FOUND')
  })
})