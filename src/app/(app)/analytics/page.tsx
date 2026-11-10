import { requireUser } from '@/lib/auth/session'
import { appCtx } from '@/lib/api/http'
import { getAnalyticsReport, parseRange } from '@/lib/services/analytics'
import { Forbidden, KpiCard, PageHeading, Panel } from '@/components/ui'
import { RangeSelect } from '@/components/RangeSelect'
import { Icon } from '@/components/Icon'
import { STATUS_ACCENT, STATUS_LABELS, PRIORITY_LABELS, PRIORITY_ACCENT, AI_SERVICE_COLORS } from '@/lib/domain/catalog'
import { TASK_STATUSES } from '@/lib/domain/types'
import { formatDate, formatDuration } from '@/lib/domain/time'
import { formatCredits, formatNumber, plural } from '@/lib/format'
import { Avatar } from '@/components/ui'

export const dynamic = 'force-dynamic'

const RANGE_LABEL: Record<string, string> = {
  '7': 'за последние 7 дней',
  '30': 'за последние 30 дней',
  '90': 'за последние 90 дней',
  all: 'за всё время',
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser()
  if (user.role !== 'manager') {
    return (
      <Forbidden
        title="Доступ только для руководителя"
        hint="Аналитика загрузки, сроков и AI-расходов доступна роли «Руководитель». Войдите под аккаунтом lead@creativeops.demo."
      />
    )
  }

  const params = await searchParams
  const rangeParam = params.range ?? '30'
  const rangeDays = parseRange(rangeParam)
  const report = getAnalyticsReport(appCtx(), user, { rangeDays })
  const maxService = Math.max(1, ...report.ai.byService.map((row) => row.credits))
  const maxTeamLoad = Math.max(1, ...report.team.map((row) => row.active + row.completed))

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeading
        title="Аналитика отдела"
        subtitle={`Задачи, загрузка, сроки и AI-расходы ${RANGE_LABEL[rangeParam] ?? ''}`}
        actions={<RangeSelect value={rangeParam} />}
      />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Всего задач"
          value={String(report.totals.all)}
          hint={`${report.totals.active} активных · ${report.totals.completed} завершено`}
          icon="layers"
          testId="kpi-total"
        />
        <KpiCard
          label="Просрочено"
          value={String(report.totals.overdue)}
          hint={report.totals.overdue > 0 ? 'требуют внимания руководителя' : 'все в срок'}
          icon="alert"
          accent={report.totals.overdue > 0 ? 'var(--red)' : 'var(--green)'}
          testId="kpi-overdue"
        />
        <KpiCard
          label="Среднее выполнение"
          value={formatDuration(report.timing.avgCompletionMs)}
          hint={`медиана ${formatDuration(report.timing.medianCompletionMs)}`}
          icon="clock"
          testId="kpi-avg-time"
        />
        <KpiCard
          label="AI-кредиты"
          value={formatNumber(report.ai.totalCredits)}
          hint={`${report.ai.entries} ${plural(report.ai.entries, 'списание', 'списания', 'списаний')}`}
          icon="coins"
          accent="var(--lime)"
          testId="kpi-credits"
        />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Panel title="Распределение по статусам" hint={`Воронка производства · ${report.totals.all} задач`} icon="board">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
            {TASK_STATUSES.map((status) => {
              const count = report.totals.byStatus[status]
              const share = report.totals.all === 0 ? 0 : (count / report.totals.all) * 100
              return share > 0 ? (
                <span key={status} style={{ width: `${share}%`, background: STATUS_ACCENT[status] }} title={`${STATUS_LABELS[status]}: ${count}`} />
              ) : null
            })}
          </div>
          <div className="mt-4 grid gap-2.5">
            {TASK_STATUSES.map((status) => {
              const count = report.totals.byStatus[status]
              const share = report.totals.all === 0 ? 0 : Math.round((count / report.totals.all) * 100)
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_ACCENT[status] }} />
                  <span className="w-[110px] text-[11.5px] text-[var(--muted)]">{STATUS_LABELS[status]}</span>
                  <div className="bar-track flex-1">
                    <div className="bar-fill" style={{ width: `${share}%`, background: STATUS_ACCENT[status] }} />
                  </div>
                  <span className="w-10 text-right text-[11.5px] font-semibold">{count}</span>
                  <span className="w-9 text-right text-[10.5px] text-[var(--muted-2)]">{share}%</span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3 text-center">
            <div>
              <p className="text-[15px] font-semibold">{report.timing.onTimeRate === null ? '—' : `${Math.round(report.timing.onTimeRate * 100)}%`}</p>
              <p className="text-[10px] text-[var(--muted-2)]">в срок</p>
            </div>
            <div>
              <p className="text-[15px] font-semibold">{Math.round(report.totals.completionRate * 100)}%</p>
              <p className="text-[10px] text-[var(--muted-2)]">завершено</p>
            </div>
            <div>
              <p className="text-[15px] font-semibold">{report.timing.avgRevisions.toFixed(2)}</p>
              <p className="text-[10px] text-[var(--muted-2)]">правок / задачу</p>
            </div>
          </div>
        </Panel>

        <Panel title="AI-расходы по сервисам" hint={`${formatNumber(report.ai.totalCredits)} кредитов всего`} icon="coins" testId="ai-by-service">
          {report.ai.byService.length === 0 ? (
            <p className="text-[12px] text-[var(--muted-2)]">Расходов за период нет.</p>
          ) : (
            <div className="grid gap-3">
              {report.ai.byService.map((row) => (
                <div key={row.service} data-testid="ai-service-row">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-[12px] font-medium">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: AI_SERVICE_COLORS[row.service] ?? 'var(--violet)' }}
                      />
                      {row.service}
                    </span>
                    <span className="text-[12px] font-semibold tabular-nums">{formatCredits(row.credits)} кр.</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="bar-track flex-1">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${Math.max(3, (row.credits / maxService) * 100)}%`,
                          background: AI_SERVICE_COLORS[row.service] ?? 'var(--violet)',
                        }}
                      />
                    </div>
                    <span className="w-[92px] text-right text-[10px] text-[var(--muted-2)]">
                      {row.entries} · {row.tasks} задач
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3">
            <div className="rounded-lg bg-[rgba(255,255,255,0.03)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.07em] text-[var(--muted-2)]">Основные</p>
              <p className="mt-0.5 text-[14px] font-semibold">{formatCredits(report.ai.byPhase.initial)} кр.</p>
            </div>
            <div className="rounded-lg bg-[rgba(242,166,90,0.07)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.07em] text-[var(--muted-2)]">На правках</p>
              <p className="mt-0.5 text-[14px] font-semibold text-[#f6c28b]">{formatCredits(report.ai.byPhase.revision)} кр.</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Panel title="Загрузка сотрудников" hint="Активные задачи, завершения, просрочки и расходы AI" icon="user">
          <div className="overflow-x-auto">
            <table className="data-table" data-testid="team-table">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th className="text-right">Активно</th>
                  <th className="text-right">В работе</th>
                  <th className="text-right">На проверке</th>
                  <th className="text-right">Готово</th>
                  <th className="text-right">Просрочено</th>
                  <th className="text-right">Ср. время</th>
                  <th className="text-right">AI</th>
                </tr>
              </thead>
              <tbody>
                {report.team.map((row) => (
                  <tr key={row.id} data-testid="team-row">
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={row.name} color={row.color} size={26} />
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium">{row.name}</p>
                          <p className="text-[10px] text-[var(--muted-2)]">
                            {row.role === 'creative' ? 'креативщик' : 'медиабайер'} · {row.active + row.completed} задач
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="num text-right">{row.active}</td>
                    <td className="num text-right">{row.inProgress}</td>
                    <td className="num text-right">{row.inReview}</td>
                    <td className="num text-right text-[#7ee2b8]">{row.completed}</td>
                    <td className="num text-right" style={{ color: row.overdue > 0 ? '#f26d6d' : 'var(--muted-2)' }}>
                      {row.overdue}
                    </td>
                    <td className="num text-right">{formatDuration(row.avgCompletionMs)}</td>
                    <td className="num text-right text-[#c6f24e]">{formatCredits(row.credits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-[var(--line)] pt-3">
            {report.team
              .filter((row) => row.role === 'creative')
              .map((row) => (
                <div key={row.id} className="min-w-0 flex-1" title={`${row.name}: ${row.active} активных / ${row.completed} готово`}>
                  <div className="mb-1 flex items-center justify-between text-[10px] text-[var(--muted-2)]">
                    <span className="truncate">{row.name.split(' ')[0]}</span>
                    <span>{row.active}</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.round(((row.active + row.completed) / maxTeamLoad) * 100)}%`,
                        background: row.color,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel title="Просроченные задачи" hint="Дедлайн прошёл, работа не завершена" icon="alert" testId="overdue-list">
            {report.overdueTasks.length === 0 ? (
              <p className="text-[12px] text-[var(--muted-2)]">Просрочек нет — отдел в графике.</p>
            ) : (
              <div className="grid gap-2">
                {report.overdueTasks.map((item) => (
                  <a
                    key={item.id}
                    href={`/tasks/${item.id}`}
                    data-testid="overdue-item"
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#f26d6d26] bg-[#f26d6d0a] px-3 py-2.5 transition hover:border-[#f26d6d55]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium">{item.offer}</p>
                      <p className="mt-0.5 text-[10.5px] text-[var(--muted-2)]">
                        {item.code} · {item.assigneeName ?? 'без исполнителя'} · до {formatDate(item.deadline)}
                      </p>
                    </div>
                    <span className="chip shrink-0" style={{ color: '#f26d6d', background: '#f26d6d14', borderColor: '#f26d6d33' }}>
                      +{item.daysLate < 1 ? `${Math.round(item.daysLate * 24)}ч` : `${Math.round(item.daysLate)}д`}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Приоритеты и люди" hint="Где сосредоточен объём" icon="target">
            <div className="grid gap-2.5">
              {report.priorityMix.map((row) => {
                const share = report.totals.all === 0 ? 0 : Math.round((row.count / report.totals.all) * 100)
                return (
                  <div key={row.priority} className="flex items-center gap-2.5">
                    <span className="w-[86px] text-[11px] text-[var(--muted)]">{PRIORITY_LABELS[row.priority]}</span>
                    <div className="bar-track flex-1">
                      <div className="bar-fill" style={{ width: `${share}%`, background: PRIORITY_ACCENT[row.priority] }} />
                    </div>
                    <span className="w-6 text-right text-[11px] font-semibold">{row.count}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <p className="label">Топ по AI-кредитам</p>
              <div className="grid gap-1.5">
                {report.ai.byUser.slice(0, 3).map((row) => (
                  <div key={row.userId} className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="truncate text-[var(--muted)]">{row.name}</span>
                    <span className="font-semibold text-[#c6f24e]">{formatCredits(row.credits)} кр.</span>
                  </div>
                ))}
                {report.ai.byUser.length === 0 ? <p className="text-[11.5px] text-[var(--muted-2)]">Нет данных</p> : null}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <p className="mt-5 flex items-center gap-1.5 text-[10.5px] text-[var(--muted-2)]">
        <Icon name="clock" size={12} />
        Отчёт сформирован {formatDate(report.generatedAt)} · среднее время старта {formatDuration(report.timing.avgTimeToStartMs)}
      </p>
    </div>
  )
}