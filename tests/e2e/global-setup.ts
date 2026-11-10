import { rmSync } from 'node:fs'
import { join } from 'node:path'

export default function globalSetup() {
  const dataDir = join(process.cwd(), 'data')
  for (const file of ['e2e.db', 'e2e.db-journal', 'e2e.db-wal', 'e2e.db-shm']) {
    rmSync(join(dataDir, file), { force: true })
  }
}