import type { Db } from './client'
import type {
  Activity,
  ActivityType,
  AiUsage,
  AiUsagePhase,
  CreativeType,
  Priority,
  Role,
  Session,
  Task,
  TaskStatus,
  User,
} from '@/lib/domain/types'

type Row = Record<string, unknown>

const str = (value: unknown): string => String(value ?? '')
const strOrNull = (value: unknown): string | null => (value === null || value === undefined ? null : String(value))

function toUser(row: Row): User {
  return {
    id: str(row.id),
    email: str(row.email),
    name: str(row.name),
    role: str(row.role) as Role,
    color: str(row.color),
    createdAt: str(row.created_at),
  }
}

function toTask(row: Row): Task {
  let references: string[] = []
  try {
    const parsed = JSON.parse(str(row.refs) || '[]')
    if (Array.isArray(parsed)) references = parsed.map(String)
  } catch {
    references = []
  }
  return {
    id: str(row.id),
    number: Number(row.number),
    code: str(row.code),
    buyerId: str(row.buyer_id),
    assigneeId: strOrNull(row.assignee_id),
    offer: str(row.offer),
    geo: str(row.geo),
    creativeType: str(row.creative_type) as CreativeType,
    quantity: Number(row.quantity),
    description: str(row.description),
    references,
    priority: str(row.priority) as Priority,
    deadline: str(row.deadline),
    status: str(row.status) as TaskStatus,
    revisionCount: Number(row.revision_count ?? 0),
    revisionNote: strOrNull(row.revision_note),
    deliverableUrl: strOrNull(row.deliverable_url),
    deliverableNote: strOrNull(row.deliverable_note),
    createdAt: str(row.created_at),
    firstStartedAt: strOrNull(row.first_started_at),
    firstSubmittedAt: strOrNull(row.first_submitted_at),
    submittedAt: strOrNull(row.submitted_at),
    completedAt: strOrNull(row.completed_at),
    updatedAt: str(row.updated_at),
  }
}

function toUsage(row: Row): AiUsage {
  return {
    id: str(row.id),
    taskId: str(row.task_id),
    userId: str(row.user_id),
    service: str(row.service),
    credits: Number(row.credits),
    note: strOrNull(row.note),
    phase: str(row.phase) as AiUsagePhase,
    createdAt: str(row.created_at),
  }
}

function toActivity(row: Row): Activity {
  return {
    id: str(row.id),
    taskId: str(row.task_id),
    actorId: str(row.actor_id),
    type: str(row.type) as ActivityType,
    fromStatus: (strOrNull(row.from_status) as TaskStatus | null) ?? null,
    toStatus: (strOrNull(row.to_status) as TaskStatus | null) ?? null,
    message: str(row.message),
    createdAt: str(row.created_at),
  }
}

export interface UserCredentials {
  user: User
  passwordHash: string
}

export const usersRepo = {
  list(db: Db): User[] {
    const rows = db.prepare(`SELECT * FROM users ORDER BY CASE role WHEN 'manager' THEN 0 WHEN 'buyer' THEN 1 ELSE 2 END, name`).all() as Row[]
    return rows.map(toUser)
  },

  findById(db: Db, id: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined
    return row ? toUser(row) : null
  },

  findByEmail(db: Db, email: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email.trim()) as Row | undefined
    return row ? toUser(row) : null
  },

  findCredentialsByEmail(db: Db, email: string): UserCredentials | null {
    const row = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email.trim()) as Row | undefined
    if (!row) return null
    return { user: toUser(row), passwordHash: str(row.password_hash) }
  },

  create(
    db: Db,
    input: { id: string; email: string; name: string; role: Role; color: string; passwordHash: string; createdAt: string },
  ): User {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(input.id, input.email.toLowerCase(), input.passwordHash, input.name, input.role, input.color, input.createdAt)
    const created = usersRepo.findById(db, input.id)
    if (!created) throw new Error('Пользователь не создан')
    return created
  },

  count(db: Db): number {
    const row = db.prepare('SELECT COUNT(*) AS count FROM users').get() as Row
    return Number(row.count)
  },
}

export const sessionsRepo = {
  create(db: Db, session: Session): void {
    db.prepare('INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(
      session.id,
      session.userId,
      session.tokenHash,
      session.createdAt,
      session.expiresAt,
    )
  },

  findValidByTokenHash(db: Db, tokenHash: string, nowIso: string): { session: Session; user: User } | null {
    const row = db
      .prepare(
        `SELECT s.id AS s_id, s.user_id AS s_user_id, s.token_hash AS s_token_hash, s.created_at AS s_created_at,
                s.expires_at AS s_expires_at, u.*
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(tokenHash, nowIso) as Row | undefined
    if (!row) return null
    return {
      session: {
        id: str(row.s_id),
        userId: str(row.s_user_id),
        tokenHash: str(row.s_token_hash),
        createdAt: str(row.s_created_at),
        expiresAt: str(row.s_expires_at),
      },
      user: toUser(row),
    }
  },

  deleteByTokenHash(db: Db, tokenHash: string): void {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
  },

  deleteExpired(db: Db, nowIso: string): void {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso)
  },
}

export interface CreateTaskData {
  id: string
  buyerId: string
  offer: string
  geo: string
  creativeType: CreativeType
  quantity: number
  description: string
  references: string[]
  priority: Priority
  deadline: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
}

export const tasksRepo = {
  list(db: Db): Task[] {
    const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC, number DESC').all() as Row[]
    return rows.map(toTask)
  },

  findById(db: Db, id: string): Task | null {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row | undefined
    return row ? toTask(row) : null
  },

  create(db: Db, data: CreateTaskData): Task {
    const nextRow = db.prepare('SELECT COALESCE(MAX(number), 0) + 1 AS next FROM tasks').get() as Row
    const number = Number(nextRow.next)
    const code = `CR-${1000 + number}`
    db.prepare(
      `INSERT INTO tasks (id, number, code, buyer_id, offer, geo, creative_type, quantity, description, refs, priority, deadline,
                          status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      data.id,
      number,
      code,
      data.buyerId,
      data.offer,
      data.geo,
      data.creativeType,
      data.quantity,
      data.description,
      JSON.stringify(data.references),
      data.priority,
      data.deadline,
      data.status,
      data.createdAt,
      data.updatedAt,
    )
    const created = tasksRepo.findById(db, data.id)
    if (!created) throw new Error('Задача не создана')
    return created
  },

  /** Точечное обновление полей задачи: пишутся только переданные ключи. */
  update(db: Db, id: string, patch: Partial<Omit<Task, 'id' | 'number' | 'code' | 'references'>> & { references?: string[] }): void {
    const columns: Record<string, string> = {
      buyerId: 'buyer_id',
      assigneeId: 'assignee_id',
      offer: 'offer',
      geo: 'geo',
      creativeType: 'creative_type',
      quantity: 'quantity',
      description: 'description',
      priority: 'priority',
      deadline: 'deadline',
      status: 'status',
      revisionCount: 'revision_count',
      revisionNote: 'revision_note',
      deliverableUrl: 'deliverable_url',
      deliverableNote: 'deliverable_note',
      firstStartedAt: 'first_started_at',
      firstSubmittedAt: 'first_submitted_at',
      submittedAt: 'submitted_at',
      completedAt: 'completed_at',
      updatedAt: 'updated_at',
      references: 'refs',
    }

    const assignments: string[] = []
    const values: (string | number | null)[] = []
    for (const [key, value] of Object.entries(patch)) {
      const column = columns[key]
      if (!column) continue
      assignments.push(`${column} = ?`)
      values.push(key === 'references' ? JSON.stringify(value) : (value as string | number | null))
    }
    if (assignments.length === 0) return
    db.prepare(`UPDATE tasks SET ${assignments.join(', ')} WHERE id = ?`).run(...values, id)
  },

  count(db: Db): number {
    const row = db.prepare('SELECT COUNT(*) AS count FROM tasks').get() as Row
    return Number(row.count)
  },
}

export const aiUsageRepo = {
  create(
    db: Db,
    data: { id: string; taskId: string; userId: string; service: string; credits: number; note: string | null; phase: AiUsagePhase; createdAt: string },
  ): AiUsage {
    db.prepare(
      'INSERT INTO ai_usage (id, task_id, user_id, service, credits, note, phase, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(data.id, data.taskId, data.userId, data.service, data.credits, data.note, data.phase, data.createdAt)
    const row = db.prepare('SELECT * FROM ai_usage WHERE id = ?').get(data.id) as Row
    return toUsage(row)
  },

  listByTask(db: Db, taskId: string): AiUsage[] {
    const rows = db.prepare('SELECT * FROM ai_usage WHERE task_id = ? ORDER BY created_at, rowid').all(taskId) as Row[]
    return rows.map(toUsage)
  },

  listAll(db: Db): AiUsage[] {
    const rows = db.prepare('SELECT * FROM ai_usage ORDER BY created_at, rowid').all() as Row[]
    return rows.map(toUsage)
  },
}

export interface CreateActivityData {
  id: string
  taskId: string
  actorId: string
  type: ActivityType
  fromStatus: TaskStatus | null
  toStatus: TaskStatus | null
  message: string
  createdAt: string
}

export const activityRepo = {
  create(db: Db, data: CreateActivityData): void {
    db.prepare(
      'INSERT INTO activity (id, task_id, actor_id, type, from_status, to_status, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(data.id, data.taskId, data.actorId, data.type, data.fromStatus, data.toStatus, data.message, data.createdAt)
  },

  listByTask(db: Db, taskId: string): Activity[] {
    const rows = db.prepare('SELECT * FROM activity WHERE task_id = ? ORDER BY created_at, rowid').all(taskId) as Row[]
    return rows.map(toActivity)
  },

  count(db: Db): number {
    const row = db.prepare('SELECT COUNT(*) AS count FROM activity').get() as Row
    return Number(row.count)
  },
}