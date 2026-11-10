import type { Db } from '@/lib/db/client'

export interface Ctx {
  db: Db
  now: () => Date
}

export function createCtx(db: Db, now: () => Date = () => new Date()): Ctx {
  return { db, now }
}

export function nowIso(ctx: Ctx): string {
  return ctx.now().toISOString()
}

/** Простая транзакция для набора операций (без вложенности). */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}