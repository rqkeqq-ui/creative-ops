import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Handler = (req: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response> | Response

let dir: string
let loginPOST: Handler
let logoutPOST: Handler
let meGET: Handler
let tasksGET: Handler
let tasksPOST: Handler
let taskGET: Handler
let actionsPOST: Handler
let aiUsagePOST: Handler
let analyticsGET: Handler
let metaGET: Handler
let healthGET: Handler

interface ApiResult<T = unknown> {
  status: number
  body: T
  cookie: string | null
  rawCookie: string | null
}

async function call<T = unknown>(handler: Handler, path: string, init: RequestInit = {}, params?: Record<string, string>): Promise<ApiResult<T>> {
  const request = new Request(`http://localhost:3000${path}`, init)
  const response = await handler(request, params ? { params: Promise.resolve(params) } : undefined)
  const rawCookie = response.headers.get('set-cookie')
  const text = await response.text()
  return {
    status: response.status,
    body: (text ? JSON.parse(text) : null) as T,
    rawCookie,
    cookie: rawCookie ? rawCookie.split(';')[0] : null,
  }
}

function json(method: string, body: unknown, cookie?: string | null): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }
}

let managerCookie: string | null = null
let buyerCookie: string | null = null
let creativeCookie: string | null = null
let otherCreativeCookie: string | null = null

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'creativeops-api-'))
  process.env.APP_DB_PATH = join(dir, 'api.db')
  process.env.SEED_DEMO = 'true'

  ;({ POST: loginPOST } = await import('@/app/api/auth/login/route'))
  ;({ POST: logoutPOST } = await import('@/app/api/auth/logout/route'))
  ;({ GET: meGET } = await import('@/app/api/auth/me/route'))
  ;({ GET: tasksGET, POST: tasksPOST } = await import('@/app/api/tasks/route'))
  ;({ GET: taskGET } = (await import('@/app/api/tasks/[id]/route')) as unknown as { GET: Handler })
  ;({ POST: actionsPOST } = (await import('@/app/api/tasks/[id]/actions/route')) as unknown as { POST: Handler })
  ;({ POST: aiUsagePOST } = (await import('@/app/api/tasks/[id]/ai-usage/route')) as unknown as { POST: Handler })
  ;({ GET: analyticsGET } = await import('@/app/api/analytics/route'))
  ;({ GET: metaGET } = await import('@/app/api/meta/route'))
  ;({ GET: healthGET } = await import('@/app/api/health/route'))

  const login = async (email: string) => {
    const res = await call<{ user: { id: string } }>(loginPOST, '/api/auth/login', json('POST', { email, password: 'demo1234' }))
    expect(res.status).toBe(200)
    return res.cookie
  }
  managerCookie = await login('lead@creativeops.demo')
  buyerCookie = await login('buyer@creativeops.demo')
  creativeCookie = await login('creative@creativeops.demo')
  otherCreativeCookie = await login('creative2@creativeops.demo')
})

afterAll(async () => {
  const { closeDb } = await import('@/lib/db/client')
  closeDb()
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

describe('GET /api/health', () => {
  it('отвечает без авторизации', async () => {
    const res = await call<{ ok: boolean }>(healthGET, '/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('POST /api/auth/login', () => {
  it('валидирует тело запроса', async () => {
    const broken = await call(loginPOST, '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' })
    expect(broken.status).toBe(400)
    const invalid = await call<{ error: { code: string } }>(loginPOST, '/api/auth/login', json('POST', { email: 'x', password: '1' }))
    expect(invalid.status).toBe(422)
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('отклоняет неверный пароль', async () => {
    const res = await call<{ error: { code: string } }>(loginPOST, '/api/auth/login', json('POST', { email: 'buyer@creativeops.demo', password: 'wrong-pass' }))
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(res.rawCookie).toBeNull()
  })

  it('выдаёт httpOnly-сессию при верных данных', async () => {
    const res = await call<{ user: { role: string } }>(loginPOST, '/api/auth/login', json('POST', { email: 'lead@creativeops.demo', password: 'demo1234' }))
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('manager')
    expect(res.cookie).toMatch(/^co_session=/)
    expect(res.rawCookie).toContain('HttpOnly')
    expect(res.rawCookie).toContain('SameSite=Lax')
  })
})

describe('сессия', () => {
  it('GET /api/auth/me без cookie → 401', async () => {
    const res = await call<{ error: { code: string } }>(meGET, '/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('GET /api/auth/me с cookie → пользователь', async () => {
    const res = await call<{ user: { email: string } }>(meGET, '/api/auth/me', { headers: { cookie: buyerCookie! } })
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('buyer@creativeops.demo')
  })
})

describe('POST /api/tasks', () => {
  const valid = {
    offer: 'API Offer',
    geo: 'DE',
    creativeType: 'ugc_video',
    quantity: 2,
    description: 'Валидное описание задачи через API-тест.',
    references: ['https://example.com/a'],
    priority: 'high',
    deadline: new Date(Date.now() + 86_400_000 * 3).toISOString(),
  }

  it('требует авторизации', async () => {
    const res = await call<{ error: { code: string } }>(tasksPOST, '/api/tasks', json('POST', valid))
    expect(res.status).toBe(401)
  })

  it('запрещает создание креативщику (403)', async () => {
    const res = await call<{ error: { code: string } }>(tasksPOST, '/api/tasks', json('POST', valid, creativeCookie))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('возвращает 422 с деталями по полям', async () => {
    const res = await call<{ error: { code: string; details?: Array<{ field: string }> } }>(
      tasksPOST, '/api/tasks', json('POST', { ...valid, offer: '', quantity: 0 }, buyerCookie),
    )
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details?.map((d) => d.field)).toEqual(expect.arrayContaining(['offer', 'quantity']))
  })

  it('создаёт задачу (201) и отдаёт её в списке и в карточке', async () => {
    const created = await call<{ task: { id: string; code: string; status: string } }>(tasksPOST, '/api/tasks', json('POST', valid, buyerCookie))
    expect(created.status).toBe(201)
    expect(created.body.task.status).toBe('new')
    expect(created.body.task.code).toMatch(/^CR-\d+$/)

    const id = created.body.task.id
    const list = await call<{ tasks: Array<{ id: string; status: string }> }>(tasksGET, '/api/tasks?status=new', { headers: { cookie: buyerCookie! } })
    expect(list.status).toBe(200)
    expect(list.body.tasks.every((task) => task.status === 'new')).toBe(true)
    expect(list.body.tasks.some((task) => task.id === id)).toBe(true)

    const search = await call<{ tasks: Array<{ id: string }> }>(tasksGET, '/api/tasks?q=API%20Offer', { headers: { cookie: buyerCookie! } })
    expect(search.body.tasks.map((task) => task.id)).toContain(id)

    const detail = await call<{ task: { id: string; activity: unknown[] } }>(taskGET, `/api/tasks/${id}`, { headers: { cookie: buyerCookie! } }, { id })
    expect(detail.status).toBe(200)
    expect(detail.body.task.activity).toHaveLength(1)
  })

  it('отдаёт 404 на несуществующую задачу', async () => {
    const res = await call<{ error: { code: string } }>(taskGET, '/api/tasks/nope', { headers: { cookie: buyerCookie! } }, { id: 'nope' })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('проходит сценарий действий через API с проверкой прав', async () => {
    const created = await call<{ task: { id: string } }>(tasksPOST, '/api/tasks', json('POST', { ...valid, offer: 'API Lifecycle' }, buyerCookie))
    const id = created.body.task.id

    const forbidden = await call<{ error: { code: string } }>(actionsPOST, `/api/tasks/${id}/actions`, json('POST', { action: 'take' }, buyerCookie), { id })
    expect(forbidden.status).toBe(403)

    const taken = await call<{ task: { status: string; assigneeId: string } }>(actionsPOST, `/api/tasks/${id}/actions`, json('POST', { action: 'take' }, creativeCookie), { id })
    expect(taken.status).toBe(200)
    expect(taken.body.task.status).toBe('in_progress')

    const notAssignee = await call<{ error: { code: string } }>(
      actionsPOST, `/api/tasks/${id}/actions`, json('POST', { action: 'submit', deliverableUrl: 'https://example.com/x' }, otherCreativeCookie), { id },
    )
    expect(notAssignee.status).toBe(403)

    const noDeliverable = await call<{ error: { code: string } }>(actionsPOST, `/api/tasks/${id}/actions`, json('POST', { action: 'submit' }, creativeCookie), { id })
    expect(noDeliverable.status).toBe(422)

    const submitted = await call<{ task: { status: string } }>(
      actionsPOST, `/api/tasks/${id}/actions`, json('POST', { action: 'submit', deliverableUrl: 'https://example.com/x' }, creativeCookie), { id },
    )
    expect(submitted.body.task.status).toBe('review')

    const revisionWithoutComment = await call<{ error: { code: string } }>(
      actionsPOST, `/api/tasks/${id}/actions`, json('POST', { action: 'request_revision', comment: '' }, buyerCookie), { id },
    )
    expect(revisionWithoutComment.status).toBe(422)

    const approved = await call<{ task: { status: string; completedAt: string | null } }>(
      actionsPOST, `/api/tasks/${id}/actions`, json('POST', { action: 'approve' }, buyerCookie), { id },
    )
    expect(approved.status).toBe(200)
    expect(approved.body.task.status).toBe('done')
    expect(approved.body.task.completedAt).not.toBeNull()

    const afterDone = await call<{ error: { code: string } }>(
      actionsPOST, `/api/tasks/${id}/actions`, json('POST', { action: 'take' }, creativeCookie), { id },
    )
    expect(afterDone.status).toBe(409)
  })
})

describe('POST /api/tasks/:id/ai-usage', () => {
  it('разрешает исполнителю и запрещает остальным', async () => {
    const created = await call<{ task: { id: string } }>(
      tasksPOST, '/api/tasks',
      json('POST', { offer: 'API AI Usage', geo: 'DE', creativeType: 'static', quantity: 1, description: 'Задача для API-теста расходов.', references: [], priority: 'low', deadline: new Date(Date.now() + 86_400_000).toISOString() }, buyerCookie),
    )
    const id = created.body.task.id
    await call(actionsPOST, `/api/tasks/${id}/actions`, json('POST', { action: 'take' }, creativeCookie), { id })

    const forbidden = await call<{ error: { code: string } }>(aiUsagePOST, `/api/tasks/${id}/ai-usage`, json('POST', { service: 'Midjourney', credits: 3 }, buyerCookie), { id })
    expect(forbidden.status).toBe(403)

    const invalid = await call<{ error: { code: string } }>(aiUsagePOST, `/api/tasks/${id}/ai-usage`, json('POST', { service: 'Midjourney', credits: 0 }, creativeCookie), { id })
    expect(invalid.status).toBe(422)

    const ok = await call<{ usage: { credits: number; phase: string } }>(aiUsagePOST, `/api/tasks/${id}/ai-usage`, json('POST', { service: 'Midjourney', credits: 7.5, note: 'тест' }, creativeCookie), { id })
    expect(ok.status).toBe(201)
    expect(ok.body.usage).toMatchObject({ credits: 7.5, phase: 'initial' })

    const detail = await call<{ task: { creditsTotal: number } }>(taskGET, `/api/tasks/${id}`, { headers: { cookie: buyerCookie! } }, { id })
    expect(detail.body.task.creditsTotal).toBe(7.5)
  })
})

describe('GET /api/analytics', () => {
  it('закрыта для байера и открыта руководителю', async () => {
    const forbidden = await call<{ error: { code: string } }>(analyticsGET, '/api/analytics', { headers: { cookie: buyerCookie! } })
    expect(forbidden.status).toBe(403)

    const ok = await call<{ report: { totals: { all: number; byStatus: Record<string, number> }; ai: { totalCredits: number } } }>(
      analyticsGET, '/api/analytics?range=30', { headers: { cookie: managerCookie! } },
    )
    expect(ok.status).toBe(200)
    expect(ok.body.report.totals.all).toBeGreaterThan(0)
    expect(ok.body.report.ai.totalCredits).toBeGreaterThan(0)
    expect(Object.values(ok.body.report.totals.byStatus).reduce((a, b) => a + b, 0)).toBe(ok.body.report.totals.all)
  })

  it('требует авторизации', async () => {
    const res = await call(analyticsGET, '/api/analytics')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/meta', () => {
  it('отдаёт справочники без хешей паролей', async () => {
    const res = await call<{ users: Array<Record<string, unknown>>; aiServices: string[]; creativeTypes: Array<{ value: string; label: string }> }>(
      metaGET, '/api/meta', { headers: { cookie: creativeCookie! } },
    )
    expect(res.status).toBe(200)
    expect(res.body.users.length).toBe(6)
    expect(res.body.users[0]).not.toHaveProperty('passwordHash')
    expect(res.body.aiServices).toContain('Midjourney')
    expect(res.body.creativeTypes.map((item) => item.value)).toContain('ugc_video')
  })
})

describe('POST /api/auth/logout', () => {
  it('уничтожает сессию', async () => {
    const login = await call(loginPOST, '/api/auth/login', json('POST', { email: 'creative3@creativeops.demo', password: 'demo1234' }))
    const cookie = login.cookie!
    const before = await call(meGET, '/api/auth/me', { headers: { cookie } })
    expect(before.status).toBe(200)

    const out = await call(logoutPOST, '/api/auth/logout', json('POST', {}, cookie))
    expect(out.status).toBe(200)
    expect(out.rawCookie).toMatch(/co_session=;|co_session=;/)

    const after = await call(meGET, '/api/auth/me', { headers: { cookie } })
    expect(after.status).toBe(401)
  })
})