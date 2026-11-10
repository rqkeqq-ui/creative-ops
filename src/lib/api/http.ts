import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getDb } from '@/lib/db/client'
import { createCtx, type Ctx } from '@/lib/services/context'
import { SESSION_COOKIE, getUserByToken } from '@/lib/services/auth'
import { AppError } from '@/lib/services/errors'
import type { User } from '@/lib/domain/types'

export function appCtx(): Ctx {
  return createCtx(getDb())
}

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init)
}

export function tokenFromRequest(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE) return rest.join('=') || null
  }
  return null
}

export function currentUser(request: Request): { user: User; token: string } {
  const token = tokenFromRequest(request)
  const user = getUserByToken(appCtx(), token)
  if (!user || !token) {
    throw new AppError('UNAUTHORIZED', 401, 'Требуется авторизация')
  }
  return { user, token }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AppError('INVALID_JSON', 400, 'Некорректный JSON в теле запроса')
  }
}

export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof AppError) {
      return json(
        { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
        { status: error.status },
      )
    }
    // Страховка: любой несобранный zod-парс должен стать 422, а не 500.
    if (error instanceof ZodError) {
      return json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Проверьте заполнение полей',
            details: error.issues.map((issue) => ({ field: String(issue.path[0] ?? 'form'), message: issue.message })),
          },
        },
        { status: 422 },
      )
    }
    console.error('[api] unexpected error', error)
    return json({ error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' } }, { status: 500 })
  }
}

export function boolParam(value: string | null): boolean | undefined {
  if (value === null) return undefined
  return value === '1' || value === 'true'
}