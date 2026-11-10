import type { AiUsage, Task, User } from '@/lib/domain/types'

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Тестовый Пользователь',
    role: 'creative',
    color: '#7C5CFF',
    createdAt: '2026-10-01T09:00:00.000Z',
    ...overrides,
  }
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    number: 1,
    code: 'CR-1001',
    buyerId: 'buyer-1',
    assigneeId: null,
    offer: 'Test Offer',
    geo: 'DE',
    creativeType: 'ugc_video',
    quantity: 3,
    description: 'Описание тестовой задачи для проверки',
    references: ['https://example.com/ref'],
    priority: 'normal',
    deadline: '2026-11-15T12:00:00.000Z',
    status: 'new',
    revisionCount: 0,
    revisionNote: null,
    deliverableUrl: null,
    deliverableNote: null,
    createdAt: '2026-11-01T09:00:00.000Z',
    firstStartedAt: null,
    firstSubmittedAt: null,
    submittedAt: null,
    completedAt: null,
    updatedAt: '2026-11-01T09:00:00.000Z',
    ...overrides,
  }
}

export function makeUsage(overrides: Partial<AiUsage> = {}): AiUsage {
  return {
    id: 'usage-1',
    taskId: 'task-1',
    userId: 'user-1',
    service: 'Midjourney',
    credits: 10,
    note: null,
    phase: 'initial',
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  }
}