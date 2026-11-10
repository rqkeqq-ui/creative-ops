import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Handler = (req: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response> | Response

let dir: string
let loginPOST: Handler
let tasksGET: Handler
let tasksPOST: Handler
let taskGET: Handler
let actionsPOST: Handler
let aiUsagePOST: Handler

interface ApiResult<T = unknown> {
  status: number
  body: T
  cookie: string | null
}

async function call<T = unknown>(handler: Handler, path: string, init: RequestInit = {}, params?: Record<string, string>): Promise<ApiResult<T>> {
  const request = new Request(`http://localhost:3000${path}`, init)
  const response = await handler(request, params ? { params: Promise.resolve(params) } : undefined)
  const rawCookie = response.headers.get('set-cookie')
  const text = await response.text()
  return {
    status: response.status,
    body: (text ? JSON.parse(text) : null) as T,
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

/** Сырое тело (в т.ч. сломанный JSON) без сериализации. */
function raw(method: string, body: string, cookie?: string | null): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body,
  }
}

let buyerCookie: string | null = null
let creativeCookie: string | null = null
let otherCreativeCookie: string | null = null

const futureDeadline = () => new Date(Date.now() + 86_400_000).toISOString()
const taskPayload = (overrides: Record<string, unknown> = {}) => ({
  offer: 'Hardening',
  geo: 'DE',
  creativeType: 'static',
  quantity: 1,
  description: 'Описание для теста устойчивости API-слоя.',
  references: [],
  priority: 'normal',
  deadline: futureDeadline(),
  ...overrides,
})

async function createTask(cookie: string | null, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await call<{ task: { id: string } }>(tasksPOST, '/api/tasks', json('POST', taskPayload(overrides), cookie))
  expect(res.status).toBe(201)
  return res.body.task.id
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'creativeops-hardening-'))
  process.env.APP_DB_PATH = join(dir, 'hardening.db')
  process.env.SEED_DEMO = 'true'

  ;({ POST: loginPOST } = await import('@/app/api/auth/login/route'))
  ;({ GET: tasksGET, POST: tasksPOST } = await import('@/app/api/tasks/route'))
  ;({ GET: taskGET } = (await import('@/app/api/tasks/[id]/route')) as unknown as { GET: Handler })
  ;({ POST: actionsPOST } = (await import('@/app/api/tasks/[id]/actions/route')) as unknown as { POST: Handler })
  ;({ POST: aiUsagePOST } = (await import('@/app/api/tasks/[id]/ai-usage/route')) as unknown as { POST: Handler })

  const login = async (email: string) => {
    const res = await call<{ user: { id: string } }>(loginPOST, '/api/auth/login', json('POST', { email, password: 'demo1234' }))
    expect(res.status).toBe(200)
    return res.cookie
  }
  buyerCookie = await login('buyer@creativeops.demo')
  creativeCookie = await login('creative@creativeops.demo')
  otherCreativeCookie = await login('creative2@creativeops.demo')
})

afterAll(async () => {
  const { closeDb } = await import('@/lib/db/client')
  closeDb()
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

describe('Битые тела запросов не приводят к 500', () => {
  it('сломанный и пустой JSON → 400 INVALID_JSON на всех POST-роутах', async () => {
    const id = await createTask(buyerCookie)
    const cases: Array<[string, Handler, string, Record<string, string> | undefined]> = [
      ['login', loginPOST, '/api/auth/login', undefined],
      ['tasks', tasksPOST, '/api/tasks', undefined],
      ['actions', actionsPOST, `/api/tasks/${id}/actions`, { id }],
      ['ai-usage', aiUsagePOST, `/api/tasks/${id}/ai-usage`, { id }],
    ]
    for (const [name, handler, path, params] of cases) {
      for (const broken of ['{oops', '', 'not json at all', '<xml/>']) {
        const res = await call<{ error: { code: string } }>(handler, path, raw('POST', broken, buyerCookie), params)
        expect(res.status, `${name} ← ${JSON.stringify(broken)}`).toBe(400)
        expect(res.body.error.code).toBe('INVALID_JSON')
      }
    }
  })

  it('тело не-объект (null, число) → 422, а не 500', async () => {
    const id = await createTask(buyerCookie)
    for (const body of [null, 42, 'text', true]) {
      const res = await call(actionsPOST, `/api/tasks/${id}/actions`, raw('POST', JSON.stringify(body), buyerCookie), { id })
      expect(res.status, `body=${JSON.stringify(body)}`).toBe(422)
    }
  })
})

describe('Поддельные и повреждённые сессии', () => {
  it('произвольный/пустой/бинарный токен → 401', async () => {
    for (const cookie of ['co_session=deadbeefdeadbeef', 'co_session=', 'co_session=%00%01', 'co_session=' + 'z'.repeat(200)]) {
      const res = await call<{ error: { code: string } }>(tasksGET, '/api/tasks', { headers: { cookie } })
      expect(res.status, cookie).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    }
  })

  it('токен другой cookie не подходит', async () => {
    const res = await call(tasksGET, '/api/tasks', { headers: { cookie: 'other=abc; co_session_extra=1' } })
    expect(res.status).toBe(401)
  })
})

describe('AI-расходы: числовые границы', () => {
  async function takenTask(): Promise<string> {
    const id = await createTask(buyerCookie)
    const taken = await call(actionsPOST, `/api/tasks/${id}/actions`, json('POST', { action: 'take' }, creativeCookie), { id })
    expect(taken.status).toBe(200)
    return id
  }

  it('принимает 1, 100000 и дробные кредиты', async () => {
    const id = await takenTask()
    for (const credits of [1, 100_000, 1.5, 0.01]) {
      const res = await call(aiUsagePOST, `/api/tasks/${id}/ai-usage`, json('POST', { service: 'Midjourney', credits }, creativeCookie), { id })
      expect(res.status, `credits=${credits}`).toBe(201)
    }
  })

  it('отклоняет 0, отрицательные, >100000 и нечисловые значения как 422', async () => {
    const id = await takenTask()
    const bad = [0, -5, 100_001, 1e12, 'Infinity', 'NaN', '100', null, true, [1], {}, '']
    for (const credits of bad) {
      const res = await call<{ error: { code: string } }>(aiUsagePOST, `/api/tasks/${id}/ai-usage`, json('POST', { service: 'Midjourney', credits }, creativeCookie), { id })
      expect(res.status, `credits=${JSON.stringify(credits)}`).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('отклоняет неизвестный сервис и слишком длинную заметку', async () => {
    const id = await takenTask()
    const service = await call(aiUsagePOST, `/api/tasks/${id}/ai-usage`, json('POST', { service: 'Photoshop', credits: 1 }, creativeCookie), { id })
    expect(service.status).toBe(422)
    const note = await call(aiUsagePOST, `/api/tasks/${id}/ai-usage`, json('POST', { service: 'Midjourney', credits: 1, note: 'n'.repeat(201) }, creativeCookie), { id })
    expect(note.status).toBe(422)
  })
})

describe('Создание задачи: границы полей', () => {
  const badQuantities: Array<[string, unknown]> = [
    ['ноль', 0], ['больше максимума', 201], ['дробное', 1.5],
    ['строка', '2'], ['NaN-строка', 'NaN'], ['огромное', 1e21],
  ]
  it.each(badQuantities)('quantity: %s → 422 по полю quantity', async (_label, quantity) => {
    const res = await call<{ error: { code: string; details?: Array<{ field: string }> } }>(
      tasksPOST, '/api/tasks', json('POST', taskPayload({ quantity }), buyerCookie),
    )
    expect(res.status).toBe(422)
    expect(res.body.error.details?.map((d) => d.field)).toContain('quantity')
  })

  it('слишком длинные offer/description и >10 референсов → 422', async () => {
    const longOffer = await call(tasksPOST, '/api/tasks', json('POST', taskPayload({ offer: 'X'.repeat(81) }), buyerCookie))
    expect(longOffer.status).toBe(422)
    const shortDesc = await call(tasksPOST, '/api/tasks', json('POST', taskPayload({ description: 'short' }), buyerCookie))
    expect(shortDesc.status).toBe(422)
    const manyRefs = await call(tasksPOST, '/api/tasks', json('POST', taskPayload({ references: Array(11).fill('https://a.com') }), buyerCookie))
    expect(manyRefs.status).toBe(422)
  })

  it('references не массив / не строки → 422, а не 500', async () => {
    const notArray = await call(tasksPOST, '/api/tasks', json('POST', taskPayload({ references: 'https://a.com' }), buyerCookie))
    expect(notArray.status).toBe(422)
    const nonString = await call(tasksPOST, '/api/tasks', json('POST', taskPayload({ references: [42, null] }), buyerCookie))
    expect(nonString.status).toBe(422)
  })

  it('некорректный и null-дедлайн → 422', async () => {
    for (const deadline of ['not-a-date', null, 12345, '']) {
      const res = await call(tasksPOST, '/api/tasks', json('POST', taskPayload({ deadline }), buyerCookie))
      expect(res.status, `deadline=${JSON.stringify(deadline)}`).toBe(422)
    }
  })

  it('неизвестные дополнительные поля игнорируются, задача создаётся', async () => {
    const res = await call<{ task: { id: string; offer: string } }>(
      tasksPOST, '/api/tasks', json('POST', taskPayload({ hacker: '<script>', isAdmin: true }), buyerCookie),
    )
    expect(res.status).toBe(201)
    expect(res.body.task.offer).toBe('Hardening')
  })
})

describe('Странные идентификаторы задач → 404, а не 500', () => {
  it('обход путей, длинный id, null-байт', async () => {
    for (const id of ['../../etc/passwd', 'a'.repeat(500), '\u0000', '%00']) {
      const res = await call<{ error: { code: string } }>(taskGET, `/api/tasks/${encodeURIComponent(id)}`, { headers: { cookie: buyerCookie! } }, { id })
      expect(res.status, id).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    }
  })
})

describe('Гонка за задачу: один победитель', () => {
  it('два одновременных взятия → ровно одно 200 и одно 409, исполнитель один', async () => {
    const id = await createTask(buyerCookie, { offer: 'Hardening race' })
    const [a, b] = await Promise.all([
      call<{ task?: { assigneeId: string } }>(actionsPOST, `/api/tasks/${id}/actions`, json('POST', { action: 'take' }, creativeCookie), { id }),
      call<{ task?: { assigneeId: string } }>(actionsPOST, `/api/tasks/${id}/actions`, json('POST', { action: 'take' }, otherCreativeCookie), { id }),
    ])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([200, 409])

    const detail = await call<{ task: { status: string; assigneeId: string } }>(taskGET, `/api/tasks/${id}`, { headers: { cookie: buyerCookie! } }, { id })
    expect(detail.body.task.status).toBe('in_progress')
    const winner = a.status === 200 ? a.body.task!.assigneeId : b.body.task!.assigneeId
    expect(detail.body.task.assigneeId).toBe(winner)
  })
})
