import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { sessionsRepo, usersRepo } from '@/lib/db/repositories'
import type { User } from '@/lib/domain/types'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { errors } from './errors'
import { loginSchema, parseInput } from './validation'
import { type Ctx } from './context'

export const SESSION_COOKIE = 'co_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface LoginResult {
  user: User
  token: string
  expiresAt: string
}

export async function login(ctx: Ctx, input: unknown): Promise<LoginResult> {
  const { email, password } = parseInput(loginSchema, input)
  const credentials = usersRepo.findCredentialsByEmail(ctx.db, email)
  if (!credentials || !verifyPassword(password, credentials.passwordHash)) {
    throw errors.invalidCredentials()
  }

  const token = randomBytes(32).toString('base64url')
  const createdAt = ctx.now().toISOString()
  const expiresAt = new Date(ctx.now().getTime() + SESSION_TTL_MS).toISOString()

  sessionsRepo.deleteExpired(ctx.db, createdAt)
  sessionsRepo.create(ctx.db, {
    id: randomUUID(),
    userId: credentials.user.id,
    tokenHash: hashToken(token),
    createdAt,
    expiresAt,
  })

  return { user: credentials.user, token, expiresAt }
}

export function getUserByToken(ctx: Ctx, token: string | null | undefined): User | null {
  if (!token) return null
  const found = sessionsRepo.findValidByTokenHash(ctx.db, hashToken(token), ctx.now().toISOString())
  return found?.user ?? null
}

export function logout(ctx: Ctx, token: string | null | undefined): void {
  if (!token) return
  sessionsRepo.deleteByTokenHash(ctx.db, hashToken(token))
}

/** Хеширование пароля доступно сервисам (используется сидированием и админ-операциями). */
export { hashPassword }

export function sessionCookie(token: string, expiresAt: string): string {
  const maxAge = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000))
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function clearedSessionCookie(): string {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}