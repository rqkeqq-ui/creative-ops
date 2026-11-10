export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'creative', 'manager')),
  color TEXT NOT NULL DEFAULT '#7C5CFF',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT NOT NULL UNIQUE,
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  buyer_id TEXT NOT NULL REFERENCES users(id),
  assignee_id TEXT REFERENCES users(id),
  offer TEXT NOT NULL,
  geo TEXT NOT NULL,
  creative_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  description TEXT NOT NULL,
  refs TEXT NOT NULL DEFAULT '[]',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  deadline TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'review', 'revision', 'done')),
  revision_count INTEGER NOT NULL DEFAULT 0,
  revision_note TEXT,
  deliverable_url TEXT,
  deliverable_note TEXT,
  created_at TEXT NOT NULL,
  first_started_at TEXT,
  first_submitted_at TEXT,
  submitted_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_buyer ON tasks(buyer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);

CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  service TEXT NOT NULL,
  credits REAL NOT NULL,
  note TEXT,
  phase TEXT NOT NULL CHECK (phase IN ('initial', 'revision')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_task ON ai_usage(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_task ON activity(task_id);
`