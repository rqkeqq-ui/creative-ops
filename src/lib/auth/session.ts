import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { createCtx } from '@/lib/services/context'
import { SESSION_COOKIE, getUserByToken } from '@/lib/services/auth'
import type { User } from '@/lib/domain/types'

/** Текущий пользователь или null (для серверных компонентов). */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value ?? null
  if (!token) return null
  return getUserByToken(createCtx(getDb()), token)
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}