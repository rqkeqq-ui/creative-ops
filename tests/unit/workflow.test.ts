import { describe, expect, it } from 'vitest'
import { ACTIONS, allowedActions, checkAction, isTaskAction } from '@/lib/domain/workflow'
import { makeTask, makeUser } from '../helpers/fixtures'

const buyer = makeUser({ id: 'buyer-1', role: 'buyer' })
const otherBuyer = makeUser({ id: 'buyer-2', role: 'buyer' })
const creative = makeUser({ id: 'creative-1', role: 'creative' })
const otherCreative = makeUser({ id: 'creative-2', role: 'creative' })
const manager = makeUser({ id: 'manager-1', role: 'manager' })

function task(overrides: Parameters<typeof makeTask>[0] = {}) {
  return makeTask({ buyerId: buyer.id, ...overrides })
}

function expectDenied(result: ReturnType<typeof checkAction>, code: string) {
  expect(result.ok).toBe(false)
  expect(result.ok === false && result.code).toBe(code)
}

describe('workflow: metadata', () => {
  it('defines exactly the four kanban actions', () => {
    expect(Object.keys(ACTIONS).sort()).toEqual(['approve', 'request_revision', 'submit', 'take'])
    expect(ACTIONS.take.to).toBe('in_progress')
    expect(ACTIONS.submit.to).toBe('review')
    expect(ACTIONS.approve.to).toBe('done')
    expect(ACTIONS.request_revision.to).toBe('revision')
  })

  it('guards unknown action names', () => {
    expect(isTaskAction('take')).toBe(true)
    expect(isTaskAction('delete')).toBe(false)
  })
})

describe('workflow: take', () => {
  it('allows a creative to take a new unassigned task', () => {
    expect(checkAction('take', creative, task())).toEqual({ ok: true })
  })

  it('forbids buyer and manager from taking work', () => {
    expectDenied(checkAction('take', buyer, task()), 'FORBIDDEN')
    expectDenied(checkAction('take', manager, task()), 'FORBIDDEN')
  })

  it('only allows take from new or revision', () => {
    for (const status of ['in_progress', 'review', 'done'] as const) {
      expectDenied(checkAction('take', creative, task({ status, assigneeId: creative.id })), 'INVALID_TRANSITION')
    }
  })

  it('lets the assignee resume their own revision', () => {
    const revised = task({ status: 'revision', assigneeId: creative.id })
    expect(checkAction('take', creative, revised)).toEqual({ ok: true })
  })

  it('blocks another creative from taking over someone else’s revision', () => {
    const revised = task({ status: 'revision', assigneeId: creative.id })
    expectDenied(checkAction('take', otherCreative, revised), 'ASSIGNED_TO_OTHER')
  })

  it('allows taking an unassigned revision', () => {
    expect(checkAction('take', creative, task({ status: 'revision', assigneeId: null }))).toEqual({ ok: true })
  })
})

describe('workflow: submit', () => {
  it('allows the assignee to submit work for review', () => {
    const inProgress = task({ status: 'in_progress', assigneeId: creative.id, firstStartedAt: '2026-11-02T09:00:00.000Z' })
    expect(checkAction('submit', creative, inProgress)).toEqual({ ok: true })
  })

  it('forbids submitting a task assigned to another creative', () => {
    const inProgress = task({ status: 'in_progress', assigneeId: creative.id })
    expectDenied(checkAction('submit', otherCreative, inProgress), 'NOT_ASSIGNEE')
  })

  it('forbids submitting an unassigned or not started task', () => {
    expectDenied(checkAction('submit', creative, task({ status: 'in_progress', assigneeId: null })), 'NOT_ASSIGNEE')
    expectDenied(checkAction('submit', creative, task({ status: 'new' })), 'INVALID_TRANSITION')
  })

  it('forbids buyer and manager from submitting', () => {
    const inProgress = task({ status: 'in_progress', assigneeId: creative.id })
    expectDenied(checkAction('submit', buyer, inProgress), 'FORBIDDEN')
    expectDenied(checkAction('submit', manager, inProgress), 'FORBIDDEN')
  })
})

describe('workflow: approve', () => {
  const review = () => task({ status: 'review', assigneeId: creative.id, firstStartedAt: '2026-11-02T09:00:00.000Z' })

  it('lets the owning buyer accept the work', () => {
    expect(checkAction('approve', buyer, review())).toEqual({ ok: true })
  })

  it('lets the manager accept work as a supervisor', () => {
    expect(checkAction('approve', manager, review())).toEqual({ ok: true })
  })

  it('blocks a different buyer from approving someone else’s task', () => {
    expectDenied(checkAction('approve', otherBuyer, review()), 'FORBIDDEN')
  })

  it('blocks creatives from approving anything', () => {
    expectDenied(checkAction('approve', creative, review()), 'FORBIDDEN')
  })

  it('only approves tasks sitting in review', () => {
    for (const status of ['new', 'in_progress', 'revision', 'done'] as const) {
      expectDenied(checkAction('approve', buyer, task({ status })), 'INVALID_TRANSITION')
    }
  })
})

describe('workflow: request_revision', () => {
  const review = () => task({ status: 'review', assigneeId: creative.id })

  it('requires a meaningful comment', () => {
    expectDenied(checkAction('request_revision', buyer, review(), { comment: '' }), 'COMMENT_REQUIRED')
    expectDenied(checkAction('request_revision', buyer, review(), { comment: 'ок' }), 'COMMENT_REQUIRED')
    expectDenied(checkAction('request_revision', buyer, review(), { comment: '     ' }), 'COMMENT_REQUIRED')
  })

  it('accepts a comment and moves work back to revisions', () => {
    expect(checkAction('request_revision', buyer, review(), { comment: 'Поправить логотип и субтитры' })).toEqual({ ok: true })
  })

  it('blocks non-owning users', () => {
    expectDenied(checkAction('request_revision', otherBuyer, review(), { comment: 'Поправить субтитры' }), 'FORBIDDEN')
    expectDenied(checkAction('request_revision', creative, review(), { comment: 'Поправить субтитры' }), 'FORBIDDEN')
  })

  it('only works from review', () => {
    expectDenied(
      checkAction('request_revision', buyer, task({ status: 'in_progress', assigneeId: creative.id }), {
        comment: 'Поправить субтитры',
      }),
      'INVALID_TRANSITION',
    )
  })
})

describe('workflow: allowedActions (UI hints)', () => {
  it('lists actions available to each role', () => {
    expect(allowedActions(creative, task())).toEqual(['take'])
    expect(allowedActions(creative, task({ status: 'in_progress', assigneeId: creative.id }))).toEqual(['submit'])
    expect(allowedActions(creative, task({ status: 'review', assigneeId: creative.id }))).toEqual([])
    expect(allowedActions(buyer, task({ status: 'review', assigneeId: creative.id }))).toEqual(['approve', 'request_revision'])
    expect(allowedActions(manager, task({ status: 'review', assigneeId: creative.id }))).toEqual(['approve', 'request_revision'])
    expect(allowedActions(buyer, task())).toEqual([])
    expect(allowedActions(otherBuyer, task({ status: 'review' }))).toEqual([])
    expect(allowedActions(creative, task({ status: 'done', assigneeId: creative.id }))).toEqual([])
  })
})