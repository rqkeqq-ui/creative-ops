import Link from 'next/link'
import { requireUser } from '@/lib/auth/session'
import { Forbidden, PageHeading } from '@/components/ui'
import { NewTaskForm } from '@/components/NewTaskForm'
import { Icon } from '@/components/Icon'

export const dynamic = 'force-dynamic'

export default async function NewTaskPage() {
  const user = await requireUser()

  if (user.role !== 'buyer') {
    return <Forbidden title="Недостаточно прав" hint="Создавать ТЗ может только медиабайер. Креативщики берут готовые задачи с доски, руководитель видит аналитику." />
  }

  return (
    <>
      <PageHeading
        title="Новое ТЗ"
        subtitle="Опишите задачу так, чтобы креативщик не задавал уточняющих вопросов"
        actions={
          <Link href="/board" className="btn btn-dark btn-sm">
            <Icon name="board" size={14} />
            К доске
          </Link>
        }
      />
      <NewTaskForm />
    </>
  )
}