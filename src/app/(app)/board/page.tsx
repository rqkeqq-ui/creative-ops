import Link from 'next/link'
import { requireUser } from '@/lib/auth/session'
import { appCtx } from '@/lib/api/http'
import { listTasks } from '@/lib/services/tasks'
import { usersRepo } from '@/lib/db/repositories'
import { KanbanBoard } from '@/components/KanbanBoard'
import { PageHeading } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { tasksWord } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function BoardPage() {
  const user = await requireUser()
  const ctx = appCtx()
  const tasks = listTasks(ctx, user)
  const creatives = usersRepo
    .list(ctx.db)
    .filter((person) => person.role === 'creative')
    .map((person) => ({ id: person.id, name: person.name, color: person.color }))

  const overdue = tasks.filter((task) => task.metrics.isOverdue).length

  return (
    <>
      <PageHeading
        title="Доска задач"
        subtitle={`${tasks.length} ${tasksWord(tasks.length)} в работе отдела${
          overdue > 0 ? ` · ${overdue} просрочено` : ' · просрочек нет'
        }`}
        actions={
          user.role === 'buyer' ? (
            <Link href="/tasks/new" className="btn btn-primary">
              <Icon name="plus" size={16} />
              Новая задача
            </Link>
          ) : (
            <span className="chip">
              <Icon name="user" size={12} />
              {user.role === 'creative' ? 'Берите задачи из колонки «Новые»' : 'Режим наблюдения и приёмки'}
            </span>
          )
        }
      />
      <KanbanBoard tasks={tasks} creatives={creatives} canCreate={user.role === 'buyer'} nowIso={new Date().toISOString()} />
    </>
  )
}