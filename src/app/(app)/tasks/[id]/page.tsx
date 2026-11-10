import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { appCtx } from '@/lib/api/http'
import { getMeta, getTaskDetail } from '@/lib/services/tasks'
import { AppError } from '@/lib/services/errors'
import { CREATIVE_TYPE_LABELS, PRIORITY_ACCENT, PRIORITY_LABELS, STATUS_ACCENT, STATUS_LABELS, STATUS_LABELS_SINGULAR } from '@/lib/domain/catalog'
import { formatDate, formatDuration, formatDeadline, relativeDeadline } from '@/lib/domain/time'
import { formatCredits, initials } from '@/lib/format'
import { Avatar, InfoRow, Panel } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { TaskActions } from '@/components/TaskActions'
import { AiUsageForm } from '@/components/AiUsageForm'

export const dynamic = 'force-dynamic'

const ACTIVITY_LABELS: Record<string, string> = {
  created: 'Создание',
  taken: 'Взята в работу',
  submitted: 'Сдача',
  revision_requested: 'Правки',
  approved: 'Приёмка',
}

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const ctx = appCtx()

  let task
  try {
    task = getTaskDetail(ctx, user, id)
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound()
    throw error
  }

  const meta = getMeta(ctx)
  const now = new Date()
  const statusColor = STATUS_ACCENT[task.status]
  const canLogAi =
    user.role === 'creative' &&
    user.id === task.assigneeId &&
    task.status !== 'done' &&
    task.firstStartedAt !== null
  const isOverdue = task.metrics.isOverdue

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="flex items-center gap-2 text-[11.5px] text-[var(--muted-2)]">
        <Link href="/board" className="transition hover:text-[var(--text)]">
          Доска задач
        </Link>
        <span>/</span>
        <span className="font-mono" data-testid="task-code">
          {task.code}
        </span>
      </div>

      <header className="panel mt-3 overflow-hidden">
        <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${statusColor}, transparent)` }} />
        <div className="flex flex-wrap items-start justify-between gap-5 p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="chip"
                style={{ color: statusColor, background: `${statusColor}18`, borderColor: `${statusColor}3d` }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
                <span data-testid="task-status">{STATUS_LABELS_SINGULAR[task.status]}</span>
              </span>
              <span
                className="chip"
                style={{
                  color: PRIORITY_ACCENT[task.priority],
                  background: `${PRIORITY_ACCENT[task.priority]}16`,
                  borderColor: `${PRIORITY_ACCENT[task.priority]}38`,
                }}
              >
                {PRIORITY_LABELS[task.priority]}
              </span>
              {task.revisionCount > 0 ? <span className="chip">раундов правок: {task.revisionCount}</span> : null}
              {isOverdue ? (
                <span className="chip" style={{ color: '#f26d6d', background: '#f26d6d14', borderColor: '#f26d6d3d' }}>
                  <Icon name="alert" size={11} /> просрочено
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-[27px] font-semibold leading-tight tracking-[-0.035em]">{task.offer}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="target" size={13} /> {task.geo}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="layers" size={13} /> {CREATIVE_TYPE_LABELS[task.creativeType]} ×{task.quantity}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="user" size={13} /> байер: {task.buyer.name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="coins" size={13} /> AI: {formatCredits(task.creditsTotal)} кр.
              </span>
            </div>
          </div>

          <div className="w-full max-w-[260px] rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-2)]">Дедлайн</p>
            <p className={`mt-1 text-[16px] font-semibold ${isOverdue ? 'text-[#f26d6d]' : ''}`}>{formatDeadline(task.deadline)}</p>
            <p className="mt-0.5 text-[11px] text-[var(--muted-2)]">{relativeDeadline(task.deadline, now)}</p>
            <div className="mt-3 flex items-center gap-2 border-t border-[var(--line)] pt-2.5">
              {task.assignee ? (
                <>
                  <Avatar name={task.assignee.name} color={task.assignee.color} size={26} />
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-medium">{task.assignee.name}</p>
                    <p className="text-[10px] text-[var(--muted-2)]">исполнитель</p>
                  </div>
                </>
              ) : (
                <p className="text-[11.5px] text-[var(--muted-2)]">Исполнитель ещё не назначен</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {task.revisionNote ? (
        <div
          data-testid="revision-note"
          className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#f2a65a33] bg-[#f2a65a0d] px-4 py-3 text-[12px] text-[#f6c28b]"
        >
          <Icon name="refresh" size={15} />
          <span>
            <strong className="font-semibold">Правки от байера:</strong> {task.revisionNote}
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="grid gap-4">
          <Panel title="Описание задачи" icon="layers">
            <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-[var(--muted)]">{task.description}</p>
            {task.references.length > 0 ? (
              <div className="mt-4 border-t border-[var(--line)] pt-3">
                <p className="label">Референсы</p>
                <ul className="grid gap-1.5">
                  {task.references.map((reference) => (
                    <li key={reference}>
                      <a
                        href={reference}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--blue)] hover:underline"
                      >
                        <Icon name="link" size={12} />
                        {reference}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>

          {task.deliverableUrl ? (
            <Panel title="Результат" icon="check">
              <a
                href={task.deliverableUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[#3ecf8e33] bg-[#3ecf8e0d] px-3 py-2 text-[12px] text-[#7ee2b8] hover:bg-[#3ecf8e18]"
              >
                <Icon name="link" size={14} />
                {task.deliverableUrl}
              </a>
              {task.deliverableNote ? <p className="mt-2 text-[12px] text-[var(--muted)]">{task.deliverableNote}</p> : null}
              <p className="mt-2 text-[10.5px] text-[var(--muted-2)]">Сдано: {formatDate(task.submittedAt)}</p>
            </Panel>
          ) : null}

          <Panel
            title="AI-расходы"
            hint="Сервисы и кредиты, потраченные на задачу, включая правки"
            icon="coins"
            actions={
              <span className="chip" style={{ color: '#c6f24e', background: '#c6f24e10', borderColor: '#c6f24e30' }}>
                <span data-testid="ai-total">{formatCredits(task.creditsTotal)}</span> кр.
              </span>
            }
          >
            {task.aiUsage.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-5 text-center text-[11.5px] text-[var(--muted-2)]">
                Расходы пока не указаны
              </div>
            ) : (
              <div className="grid gap-1.5">
                {task.aiUsage.map((usage) => (
                  <div
                    key={usage.id}
                    data-testid="ai-usage-row"
                    className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#c6f24e12] text-[#c6f24e]">
                      <Icon name="spark" size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium">
                        {usage.service} <span className="text-[var(--muted-2)]">· {formatCredits(usage.credits)} кр.</span>
                      </p>
                      <p className="truncate text-[10.5px] text-[var(--muted-2)]">
                        {usage.userName} · {formatDate(usage.createdAt)}
                        {usage.note ? ` · ${usage.note}` : ''}
                      </p>
                    </div>
                    <span
                      className="chip !text-[9.5px]"
                      style={
                        usage.phase === 'revision'
                          ? { color: '#f2a65a', background: '#f2a65a12', borderColor: '#f2a65a33' }
                          : undefined
                      }
                    >
                      {usage.phase === 'revision' ? 'правки' : 'основная'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {canLogAi ? <AiUsageForm taskId={task.id} /> : null}
          </Panel>

          <Panel title="История задачи" hint="Каждое действие фиксируется автоматически" icon="clock">
            <ol className="relative grid gap-0" data-testid="history">
              {task.activity.map((entry, index) => {
                const last = index === task.activity.length - 1
                return (
                  <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0" data-testid="activity-item">
                    {!last ? <span className="absolute left-[5px] top-3 h-full w-px bg-[var(--line)]" /> : null}
                    <span
                      className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2"
                      style={{
                        borderColor: entry.toStatus ? STATUS_ACCENT[entry.toStatus] : 'var(--muted-2)',
                        background: 'var(--bg)',
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-[12px] font-medium">{entry.actorName}</span>
                        <span className="chip !text-[9.5px]">{ACTIVITY_LABELS[entry.type] ?? entry.type}</span>
                        {entry.fromStatus && entry.toStatus ? (
                          <span className="text-[10.5px] text-[var(--muted-2)]">
                            {STATUS_LABELS[entry.fromStatus]} → {STATUS_LABELS[entry.toStatus]}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--muted)]">{entry.message}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--muted-2)]">{formatDate(entry.createdAt)}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Panel>
        </div>

        <div className="grid gap-4 lg:sticky lg:top-6">
          <Panel title="Действия" icon="arrow-right">
            <TaskActions taskId={task.id} actions={task.allowedActions} status={task.status} />
          </Panel>

          <Panel title="Тайминг" icon="clock">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-2)]">Длительность</p>
                <p className="metric-value mt-1" data-testid="duration-value">
                  {formatDuration(task.metrics.durationMs)}
                </p>
                <p className="mt-1 text-[10.5px] text-[var(--muted-2)]">от первого взятия в работу</p>
              </div>
              <span className="chip">{task.status === 'done' ? 'завершено' : 'в процессе'}</span>
            </div>

            <div className="mt-4">
              <InfoRow label="Создана" value={formatDate(task.createdAt)} />
              <InfoRow label="Взята в работу" value={formatDate(task.firstStartedAt)} />
              <InfoRow label="Ожидание старта" value={formatDuration(task.metrics.timeToStartMs)} />
              <InfoRow label="Первая сдача" value={formatDate(task.firstSubmittedAt)} />
              <InfoRow label="Принята" value={formatDate(task.completedAt)} />
              <InfoRow label="Раундов правок" value={task.revisionCount} />
              <InfoRow label="AI-кредиты" value={`${formatCredits(task.creditsTotal)} кр.`} />
            </div>
          </Panel>

          <Panel title="Участники" icon="user">
            <div className="grid gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={task.buyer.name} color={task.buyer.color} size={30} />
                <div>
                  <p className="text-[12px] font-medium">{task.buyer.name}</p>
                  <p className="text-[10.5px] text-[var(--muted-2)]">медиабайер · постановщик</p>
                </div>
              </div>
              {task.assignee ? (
                <div className="flex items-center gap-2.5">
                  <Avatar name={task.assignee.name} color={task.assignee.color} size={30} />
                  <div>
                    <p className="text-[12px] font-medium">{task.assignee.name}</p>
                    <p className="text-[10.5px] text-[var(--muted-2)]">креативщик · исполнитель</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-[var(--muted-2)]">
                  <span className="grid h-[30px] w-[30px] place-items-center rounded-full border border-dashed border-[var(--line-strong)]">
                    <Icon name="user" size={13} />
                  </span>
                  <p className="text-[11.5px]">Исполнитель не назначен</p>
                </div>
              )}
              <div className="border-t border-[var(--line)] pt-2.5 text-[10.5px] text-[var(--muted-2)]">
                ID: <span className="font-mono">{task.code}</span> · обновлено {formatDate(task.updatedAt)}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}