import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyAction, addAiUsage, createTask, getTaskDetail } from '@/lib/services/tasks'
import { getAnalyticsReport } from '@/lib/services/analytics'
import { expectAppError } from '../helpers/errors'
import { makeTestContext, type TestContext } from '../helpers/db'
import type { User } from '@/lib/domain/types'

const HOUR = 3_600_000

let t: TestContext
let manager: User
let buyer: User
let otherBuyer: User
let creative: User
let otherCreative: User

beforeEach(() => {
  t = makeTestContext()
  manager = t.user('lead@creativeops.demo')
  buyer = t.user('buyer@creativeops.demo')
  otherBuyer = t.user('buyer2@creativeops.demo')
  creative = t.user('creative@creativeops.demo')
  otherCreative = t.user('creative2@creativeops.demo')
})

afterEach(() => t.cleanup())

function taskInput(overrides: Record<string, unknown> = {}) {
  return {
    offer: 'RBAC Offer',
    geo: 'PL',
    creativeType: 'static' as const,
    quantity: 2,
    description: 'Два статичных креатива для теста прав доступа.',
    references: [],
    priority: 'normal' as const,
    deadline: new Date(t.clock.current.getTime() + 24 * HOUR).toISOString(),
    ...overrides,
  }
}

function makeTaskForBuyer(owner: User = buyer) {
  return createTask(t.ctx, owner, taskInput())
}

/** Создаёт задачу в статусе review: байер создал, креативщик взял и сдал. */
function makeReviewTask(owner: User = buyer, assignee: User = creative) {
  const task = makeTaskForBuyer(owner)
  applyAction(t.ctx, assignee, task.id, { action: 'take' })
  t.clock.current = new Date(t.clock.current.getTime() + HOUR)
  return applyAction(t.ctx, assignee, task.id, { action: 'submit', deliverableUrl: 'https://example.com/result' })
}

describe('RBAC: создание задач', () => {
  it('позволяет байеру и запрещает остальным ролям', async () => {
    expect(makeTaskForBuyer(buyer).buyerId).toBe(buyer.id)
    await expectAppError(() => createTask(t.ctx, creative, taskInput()), 'FORBIDDEN')
    await expectAppError(() => createTask(t.ctx, manager, taskInput()), 'FORBIDDEN')
  })
})

describe('RBAC: работа с задачей', () => {
  it('запрещает байеру и руководителю брать задачу в работу', async () => {
    const task = makeTaskForBuyer()
    await expectAppError(() => applyAction(t.ctx, buyer, task.id, { action: 'take' }), 'FORBIDDEN')
    await expectAppError(() => applyAction(t.ctx, manager, task.id, { action: 'take' }), 'FORBIDDEN')
  })

  it('запрещает сдавать и «перехватывать» чужую задачу', async () => {
    const task = makeTaskForBuyer()
    applyAction(t.ctx, creative, task.id, { action: 'take' })
    await expectAppError(
      () => applyAction(t.ctx, otherCreative, task.id, { action: 'submit', deliverableUrl: 'https://example.com/x' }),
      'NOT_ASSIGNEE',
    )
    await expectAppError(() => applyAction(t.ctx, otherCreative, task.id, { action: 'take' }), 'INVALID_TRANSITION')
  })

  it('не даёт другому креативщику подхватить задачу на правках', async () => {
    const task = makeReviewTask()
    applyAction(t.ctx, buyer, task.id, { action: 'request_revision', comment: 'Переделать субтитры' })
    await expectAppError(() => applyAction(t.ctx, otherCreative, task.id, { action: 'take' }), 'ASSIGNED_TO_OTHER')
    expect(applyAction(t.ctx, creative, task.id, { action: 'take' }).status).toBe('in_progress')
  })

  it('принимает работу только владелец задачи или руководитель', async () => {
    const foreignReview = makeReviewTask(buyer, creative)
    await expectAppError(() => applyAction(t.ctx, otherBuyer, foreignReview.id, { action: 'approve' }), 'FORBIDDEN')
    await expectAppError(() => applyAction(t.ctx, creative, foreignReview.id, { action: 'approve' }), 'FORBIDDEN')

    const supervisorReview = makeReviewTask(buyer, otherCreative)
    expect(applyAction(t.ctx, manager, supervisorReview.id, { action: 'approve' }).status).toBe('done')

    const ownReview = makeReviewTask(buyer, creative)
    expect(applyAction(t.ctx, buyer, ownReview.id, { action: 'approve' }).status).toBe('done')
  })

  it('не даёт отправлять на правки без комментария', async () => {
    const task = makeReviewTask()
    await expectAppError(() => applyAction(t.ctx, buyer, task.id, { action: 'request_revision', comment: '' }), 'COMMENT_REQUIRED')
    await expectAppError(() => applyAction(t.ctx, buyer, task.id, { action: 'request_revision' }), 'COMMENT_REQUIRED')
  })

  it('требует ссылку на результат при сдаче', async () => {
    const task = makeTaskForBuyer()
    applyAction(t.ctx, creative, task.id, { action: 'take' })
    await expectAppError(() => applyAction(t.ctx, creative, task.id, { action: 'submit' }), 'VALIDATION_ERROR')
    await expectAppError(
      () => applyAction(t.ctx, creative, task.id, { action: 'submit', deliverableUrl: 'не ссылка' }),
      'VALIDATION_ERROR',
    )
  })
})

describe('RBAC: AI-расходы', () => {
  it('разрешает логировать кредиты только исполнителю задачи', async () => {
    const task = makeTaskForBuyer()
    applyAction(t.ctx, creative, task.id, { action: 'take' })
    expect(addAiUsage(t.ctx, creative, task.id, { service: 'Midjourney', credits: 4 }).phase).toBe('initial')
    await expectAppError(() => addAiUsage(t.ctx, otherCreative, task.id, { service: 'Runway', credits: 4 }), 'FORBIDDEN')
    await expectAppError(() => addAiUsage(t.ctx, buyer, task.id, { service: 'Runway', credits: 4 }), 'FORBIDDEN')
    await expectAppError(() => addAiUsage(t.ctx, manager, task.id, { service: 'Runway', credits: 4 }), 'FORBIDDEN')
  })
})

describe('RBAC: аналитика', () => {
  it('доступна только руководителю', async () => {
    expect(getAnalyticsReport(t.ctx, manager).totals.all).toBe(0)
    await expectAppError(() => getAnalyticsReport(t.ctx, buyer), 'FORBIDDEN')
    await expectAppError(() => getAnalyticsReport(t.ctx, creative), 'FORBIDDEN')
  })
})

describe('RBAC: неизвестная задача', () => {
  it('возвращает NOT_FOUND вместо утечки данных', async () => {
    await expectAppError(() => applyAction(t.ctx, creative, 'nope', { action: 'take' }), 'NOT_FOUND')
    await expectAppError(() => addAiUsage(t.ctx, creative, 'nope', { service: 'Midjourney', credits: 1 }), 'NOT_FOUND')
    await expectAppError(() => getTaskDetail(t.ctx, buyer, 'nope'), 'NOT_FOUND')
  })
})