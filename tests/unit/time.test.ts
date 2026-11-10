import { describe, expect, it } from 'vitest'
import {
  averageDurationMs,
  durationMs,
  formatDuration,
  isOverdue,
  timeToStartMs,
  wasDeliveredLate,
} from '@/lib/domain/time'
import { makeTask } from '../helpers/fixtures'

const NOW = new Date('2026-11-10T12:00:00.000Z')
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('durationMs', () => {
  it('measures completed work from the first start', () => {
    const task = makeTask({
      status: 'done',
      firstStartedAt: '2026-11-09T10:00:00.000Z',
      completedAt: '2026-11-10T08:00:00.000Z',
    })
    expect(durationMs(task, NOW)).toBe(22 * HOUR)
  })

  it('measures unfinished work against the provided now', () => {
    const task = makeTask({ status: 'in_progress', firstStartedAt: '2026-11-10T09:30:00.000Z' })
    expect(durationMs(task, NOW)).toBe(2.5 * HOUR)
  })

  it('returns null when work has not started yet', () => {
    expect(durationMs(makeTask({ status: 'new' }), NOW)).toBeNull()
  })

  it('returns null for a done task without timestamps (data problem, not negative time)', () => {
    expect(durationMs(makeTask({ status: 'done', firstStartedAt: null, completedAt: null }), NOW)).toBeNull()
  })
})

describe('timeToStartMs', () => {
  it('measures time between creation and first pickup', () => {
    const task = makeTask({ createdAt: '2026-11-09T10:00:00.000Z', firstStartedAt: '2026-11-09T13:00:00.000Z' })
    expect(timeToStartMs(task)).toBe(3 * HOUR)
  })

  it('is null before pickup', () => {
    expect(timeToStartMs(makeTask())).toBeNull()
  })
})

describe('overdue rules', () => {
  it('flags unfinished tasks past the deadline', () => {
    expect(isOverdue(makeTask({ status: 'in_progress', deadline: '2026-11-10T11:00:00.000Z' }), NOW)).toBe(true)
    expect(isOverdue(makeTask({ status: 'new', deadline: '2026-11-11T11:00:00.000Z' }), NOW)).toBe(false)
  })

  it('flags finished tasks delivered after the deadline', () => {
    const late = makeTask({
      status: 'done',
      deadline: '2026-11-09T10:00:00.000Z',
      completedAt: '2026-11-09T12:00:00.000Z',
    })
    expect(isOverdue(late, NOW)).toBe(true)
    expect(wasDeliveredLate(late)).toBe(true)
  })

  it('does not flag finished work delivered on time', () => {
    const onTime = makeTask({
      status: 'done',
      deadline: '2026-11-09T18:00:00.000Z',
      completedAt: '2026-11-09T12:00:00.000Z',
    })
    expect(isOverdue(onTime, NOW)).toBe(false)
    expect(wasDeliveredLate(onTime)).toBe(false)
  })
})

describe('averageDurationMs', () => {
  it('averages only completed tasks', () => {
    const tasks = [
      makeTask({ status: 'done', firstStartedAt: '2026-11-01T10:00:00.000Z', completedAt: '2026-11-02T10:00:00.000Z' }),
      makeTask({ status: 'done', firstStartedAt: '2026-11-03T10:00:00.000Z', completedAt: '2026-11-06T10:00:00.000Z' }),
      makeTask({ status: 'in_progress', firstStartedAt: '2026-11-01T10:00:00.000Z' }),
    ]
    expect(averageDurationMs(tasks, NOW)).toBe(2 * DAY)
  })

  it('returns null when nothing is completed', () => {
    expect(averageDurationMs([makeTask()], NOW)).toBeNull()
    expect(averageDurationMs([], NOW)).toBeNull()
  })
})

describe('formatDuration', () => {
  it('formats minutes, hours and days for humans', () => {
    expect(formatDuration(0)).toBe('0м')
    expect(formatDuration(45 * MINUTE)).toBe('45м')
    expect(formatDuration(2 * HOUR)).toBe('2ч')
    expect(formatDuration(2 * HOUR + 15 * MINUTE)).toBe('2ч 15м')
    expect(formatDuration(DAY + HOUR)).toBe('1д 1ч')
    expect(formatDuration(2 * DAY + 3 * HOUR)).toBe('2д 3ч')
  })

  it('renders an em dash for unknown durations', () => {
    expect(formatDuration(null)).toBe('—')
  })
})