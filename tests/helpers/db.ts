import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDatabase } from '@/lib/db/client'
import { seedDatabase, DEMO_PASSWORD } from '@/lib/seed'
import { createCtx, type Ctx } from '@/lib/services/context'
import { usersRepo } from '@/lib/db/repositories'
import type { User } from '@/lib/domain/types'

export const FIXED_NOW = '2026-11-10T12:00:00.000Z'

export { DEMO_PASSWORD }

export interface TestContext {
  db: ReturnType<typeof createDatabase>
  ctx: Ctx
  clock: { current: Date }
  dir: string
  user: (email: string) => User
  cleanup: () => void
}

/**
 * seed: 'users' — только демо-пользователи (для тестов с контролируемыми задачами)
 *       'full'  — пользователи + демо-задачи/расходы/история (для проверки демо-данных)
 *       'none'  — пустая БД
 */
export function makeTestContext(options: { seed?: 'users' | 'full' | 'none'; now?: string } = {}): TestContext {
  const dir = mkdtempSync(join(tmpdir(), 'creativeops-test-'))
  const db = createDatabase(join(dir, 'test.db'))
  const clock = { current: new Date(options.now ?? FIXED_NOW) }
  const ctx = createCtx(db, () => clock.current)

  const seedMode = options.seed ?? 'users'
  if (seedMode === 'users') {
    seedDatabase(db, clock.current, { tasks: false })
  } else if (seedMode === 'full') {
    seedDatabase(db, clock.current)
  }

  return {
    db,
    ctx,
    clock,
    dir,
    user(email: string): User {
      const found = usersRepo.findByEmail(db, email)
      if (!found) throw new Error(`Test user not found: ${email}`)
      return found
    },
    cleanup() {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}