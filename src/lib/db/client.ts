import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { SCHEMA_SQL } from './schema'
import { ensureDemoData } from './seed-runtime'

export type Db = DatabaseSync

export function resolveDbPath(path?: string): string {
  return path ?? process.env.APP_DB_PATH ?? resolve(process.cwd(), 'data', 'app.db')
}

/** Открывает БД, применяет схему (идемпотентно) и включает WAL. */
export function createDatabase(path: string): Db {
  if (path !== ':memory:') {
    const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path)
    mkdirSync(dirname(absolute), { recursive: true })
    path = absolute
  }
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec(SCHEMA_SQL)
  return db
}

let singleton: Db | null = null
let singletonPath: string | null = null

/**
 * Ленивый синглтон для Next.js: при первом обращении создаёт БД и, если она пустая,
 * наполняет демо-данными (чтобы `npm run dev` давал рабочий сервис без доп. шагов).
 */
export function getDb(): Db {
  const path = resolveDbPath()
  if (!singleton || singletonPath !== path) {
    singleton?.close()
    singleton = createDatabase(path)
    singletonPath = path

    if (process.env.SEED_DEMO !== 'false' && process.env.NEXT_PHASE !== 'phase-production-build') {
      ensureDemoData(singleton)
    }
  }
  return singleton
}

export function closeDb(): void {
  singleton?.close()
  singleton = null
  singletonPath = null
}