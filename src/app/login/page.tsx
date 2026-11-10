import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { LoginForm } from '@/components/LoginForm'
import { Icon, type IconName } from '@/components/Icon'

export const dynamic = 'force-dynamic'

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'board',
    title: 'Kanban без переписок',
    text: 'Новые → В работе → На проверке → Правки → Готово. Кто взял задачу и что с ней сейчас — видно сразу.',
  },
  {
    icon: 'clock',
    title: 'Время считается само',
    text: 'Фиксируются создание, взятие, сдача и приёмка. Длительность, ожидание и просрочки — автоматически.',
  },
  {
    icon: 'coins',
    title: 'AI-кредиты под контролем',
    text: 'Креативщик логирует сервисы и кредиты по каждой задаче, включая раунды правок.',
  },
  {
    icon: 'chart',
    title: 'Аналитика для руководителя',
    text: 'Загрузка людей, среднее время, просрочки и расходы AI по сервисам и исполнителям.',
  },
]

export default async function LoginPage() {
  const user = await getSessionUser()
  if (user) redirect('/board')

  return (
    <main className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1180px] grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_auto] lg:px-10">
      <section className="fade-in">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#c6f24e] text-[#0a0d05]">
            <Icon name="spark" size={20} />
          </span>
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em]">CreativeOps</p>
            <p className="text-[11.5px] text-[var(--muted-2)]">Мини-сервис управления креативным отделом</p>
          </div>
        </div>

        <h1 className="mt-10 max-w-[560px] text-[42px] font-semibold leading-[1.06] tracking-[-0.045em]">
          Креативный отдел
          <span className="text-[var(--lime)]"> без хаоса</span> в таблицах и чатах
        </h1>
        <p className="mt-5 max-w-[520px] text-[14px] leading-relaxed text-[var(--muted)]">
          Медиабайер ставит ТЗ, креативщик берёт задачу и сдаёт результат, руководитель видит загрузку, сроки и
          расходы AI. Один сервис вместо переписки в трёх мессенджерах.
        </p>

        <div className="mt-9 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="panel-soft p-4">
              <span className="inline-flex text-[var(--lime)]">
                <Icon name={feature.icon} size={17} />
              </span>
              <p className="mt-2.5 text-[13px] font-semibold">{feature.title}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted-2)]">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex justify-center lg:justify-end">
        <LoginForm />
      </section>
    </main>
  )
}