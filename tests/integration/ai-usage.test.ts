import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addAiUsage, applyAction, createTask, getTaskDetail } from '@/lib/services/tasks'
import { aiUsageRepo } from '@/lib/db/repositories'
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

function startedTask() {
  const task = createTask(t.ctx, buyer, {
    offer: 'AI Usage Offer',
    geo: 'ES',
    creativeType: 'motion',
    quantity: 1,
    description: 'Один моушн-креатив с AI-озвучкой и AI-визуалом.',
    references: [],
    priority: 'normal',
    deadline: new Date(t.clock.current.getTime() + 24 * HOUR).toISOString(),
  })
  applyAction(t.ctx, creative, task.id, { action: 'take' })
  return task
}

describe('AI-расходы: учёт кредитов по задачам', () => {
  it('фиксирует сервис, кредиты, автора и фазу initial до правок', () => {
    const task = startedTask()
    const usage = addAiUsage(t.ctx, creative, task.id, { service: 'Midjourney', credits: 12.5, note: '32 варианта' })
    expect(usage).toMatchObject({
      taskId: task.id,
      userId: creative.id,
      service: 'Midjourney',
      credits: 12.5,
      note: '32 варианта',
      phase: 'initial',
    })
    expect(usage.createdAt).toBe(t.clock.current.toISOString())
    expect(usage.id).toBeTruthy()
  })

  it('помечает расходы фазой revision после отправки на правки', () => {
    const task = startedTask()
    addAiUsage(t.ctx, creative, task.id, { service: 'Midjourney', credits: 10 })
    t.clock.current = new Date(t.clock.current.getTime() + HOUR)
    applyAction(t.ctx, creative, task.id, { action: 'submit', deliverableUrl: 'https://example.com/v1' })
    t.clock.current = new Date(t.clock.current.getTime() + HOUR)
    applyAction(t.ctx, buyer, task.id, { action: 'request_revision', comment: 'Добавить субтитры' })
    applyAction(t.ctx, creative, task.id, { action: 'take' })

    const revisionUsage = addAiUsage(t.ctx, creative, task.id, { service: 'Runway', credits: 20, note: 'перегенерация' })
    expect(revisionUsage.phase).toBe('revision')
  })

  it('суммирует кредиты в карточке задачи и отдаёт имена исполнителей', () => {
    const task = startedTask()
    addAiUsage(t.ctx, creative, task.id, { service: 'Midjourney', credits: 10 })
    t.clock.current = new Date(t.clock.current.getTime() + HOUR)
    addAiUsage(t.ctx, creative, task.id, { service: 'ElevenLabs', credits: 2.25 })

    const detail = getTaskDetail(t.ctx, buyer, task.id)
    expect(detail.creditsTotal).toBe(12.25)
    expect(detail.aiUsage.map((u) => u.service)).toEqual(['Midjourney', 'ElevenLabs'])
    expect(detail.aiUsage[0].userName).toBe(creative.name)
    expect(detail.aiUsage[0].phase).toBe('initial')
  })

  it('не принимает некорректные данные', async () => {
    const task = startedTask()
    await expectAppError(() => addAiUsage(t.ctx, creative, task.id, { service: 'UnknownAI', credits: 1 }), 'VALIDATION_ERROR')
    await expectAppError(() => addAiUsage(t.ctx, creative, task.id, { service: 'Midjourney', credits: 0 }), 'VALIDATION_ERROR')
    await expectAppError(
      () => addAiUsage(t.ctx, creative, task.id, { service: 'Midjourney', credits: 5, note: 'x'.repeat(201) }),
      'VALIDATION_ERROR',
    )
    expect(aiUsageRepo.listByTask(t.db, task.id)).toHaveLength(0)
  })

  it('запрещает дописывать расходы в завершённую задачу', async () => {
    const task = startedTask()
    applyAction(t.ctx, creative, task.id, { action: 'submit', deliverableUrl: 'https://example.com/v1' })
    applyAction(t.ctx, buyer, task.id, { action: 'approve' })
    await expectAppError(() => addAiUsage(t.ctx, creative, task.id, { service: 'Midjourney', credits: 3 }), 'TASK_CLOSED')
  })

  it('запрещает добавлять расходы до взятия задачи в работу', async () => {
    const task = createTask(t.ctx, buyer, {
      offer: 'Not Started',
      geo: 'FR',
      creativeType: 'static',
      quantity: 1,
      description: 'Задача ещё не взята в работу, расходы писать нельзя.',
      references: [],
      priority: 'low',
      deadline: new Date(t.clock.current.getTime() + 24 * HOUR).toISOString(),
    })
    await expectAppError(() => addAiUsage(t.ctx, creative, task.id, { service: 'Midjourney', credits: 3 }), 'FORBIDDEN')
  })
})