'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Priority, TaskStatus } from '@/lib/domain/types'
import type { TaskListItem } from '@/lib/services/tasks'
import { PRIORITY_LABELS, STATUS_ACCENT, STATUS_HINTS, STATUS_LABELS } from '@/lib/domain/catalog'
import { TASK_STATUSES } from '@/lib/domain/types'
import { formatDeadline } from '@/lib/domain/time'
import { formatCredits, tasksWord } from '@/lib/format'
import { Avatar, CreditsChip, DeadlineChip, EmptyState, GeoChip, PriorityChip, TypeChip } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { PendingLink } from '@/components/PendingLink'

interface Creative {
  id: string
  name: string
  color: string
}

export function KanbanBoard({
  tasks,
  creatives,
  canCreate,
  nowIso,
}: {
  tasks: TaskListItem[]
  creatives: Creative[]
  canCreate: boolean
  nowIso: string
}) {
  const [query, setQuery] = useState('')
  const [assignee, setAssignee] = useState('all')
  const [priority, setPriority] = useState<'all' | Priority>('all')
  const [overdueOnly, setOverdueOnly] = useState(false)

  const now = useMemo(() => new Date(nowIso), [nowIso])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return tasks.filter((task) => {
      if (needle) {
        const haystack = `${task.offer} ${task.code} ${task.geo} ${task.assigneeName ?? ''} ${task.buyerName}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      if (assignee === 'unassigned' && task.assigneeId) return false
      if (assignee !== 'all' && assignee !== 'unassigned' && task.assigneeId !== assignee) return false
      if (priority !== 'all' && task.priority !== priority) return false
      if (overdueOnly && !task.metrics.isOverdue) return false
      return true
    })
  }, [tasks, query, assignee, priority, overdueOnly])

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(TASK_STATUSES.map((status) => [status, [] as TaskListItem[]])) as Record<TaskStatus, TaskListItem[]>
    for (const task of filtered) map[task.status].push(task)
    return map
  }, [filtered])

  const active = tasks.filter((task) => task.status !== 'done').length
  const overdue = tasks.filter((task) => task.metrics.isOverdue).length
  const review = tasks.filter((task) => task.status === 'review').length
  const unassigned = tasks.filter((task) => !task.assigneeId).length

  const filtersApplied = query.trim() !== '' || assignee !== 'all' || priority !== 'all' || overdueOnly

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'В работе', value: active, hint: 'активных задач', icon: 'layers' as const, color: 'var(--blue)' },
          { label: 'Ждут приёмки', value: review, hint: 'на проверке у байеров', icon: 'clock' as const, color: 'var(--violet)' },
          { label: 'Просрочено', value: overdue, hint: 'дедлайн уже прошёл', icon: 'alert' as const, color: overdue > 0 ? 'var(--red)' : 'var(--green)' },
          { label: 'Свободны', value: unassigned, hint: 'можно взять в работу', icon: 'inbox' as const, color: 'var(--muted)' },
        ].map((item) => (
          <div key={item.label} className="stat-card">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border"
              style={{
                background: `color-mix(in srgb, ${item.color} 12%, transparent)`,
                borderColor: `color-mix(in srgb, ${item.color} 24%, transparent)`,
                color: item.color,
              }}
            >
              <Icon name={item.icon} size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[20px] font-semibold leading-none tracking-[-0.03em]" style={{ color: item.color }}>
                {item.value}
              </p>
              <p className="mt-1.5 truncate text-[10.5px] text-[var(--muted-2)]">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="panel mt-4 flex flex-wrap items-center gap-2.5 px-3.5 py-3">
        <div className="relative min-w-[210px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]">
            <Icon name="search" size={15} />
          </span>
          <input
            data-testid="board-search"
            className="input !h-[36px] !pl-9"
            placeholder="Поиск по офферу, GEO, номеру или исполнителю"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select data-testid="filter-assignee" className="select !h-[36px] !w-auto min-w-[170px]" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
          <option value="all">Все исполнители</option>
          <option value="unassigned">Без исполнителя</option>
          {creatives.map((creative) => (
            <option key={creative.id} value={creative.id}>
              {creative.name}
            </option>
          ))}
        </select>
        <select
          data-testid="filter-priority"
          className="select !h-[36px] !w-auto min-w-[140px]"
          value={priority}
          onChange={(event) => setPriority(event.target.value as 'all' | Priority)}
        >
          <option value="all">Любой приоритет</option>
          {(Object.keys(PRIORITY_LABELS) as Priority[]).map((value) => (
            <option key={value} value={value}>
              {PRIORITY_LABELS[value]}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-testid="filter-status-overdue"
          onClick={() => setOverdueOnly((value) => !value)}
          className={`btn btn-sm ${overdueOnly ? 'btn-warn' : 'btn-dark'}`}
        >
          <Icon name="alert" size={13} />
          Просроченные
        </button>
        {filtersApplied ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setQuery('')
              setAssignee('all')
              setPriority('all')
              setOverdueOnly(false)
            }}
          >
            Сбросить
          </button>
        ) : null}
        <span className="ml-auto text-[11px] text-[var(--muted-2)]">
          {filtered.length} {tasksWord(filtered.length)} · обновлено {formatDeadline(nowIso)}
        </span>
      </div>

      <div className="kanban-grid mt-4" data-testid="kanban">
        {TASK_STATUSES.map((status) => {
          const items = byStatus[status]
          const accent = STATUS_ACCENT[status]
          return (
            <section key={status} className="column" data-testid={`column-${status}`}>
              <header className="column-head">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
                  <span className="truncate text-[12px] font-semibold">{STATUS_LABELS[status]}</span>
                  <span className="rounded-full border border-[var(--line)] bg-[var(--surface-3)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                    {items.length}
                  </span>
                </div>
                {status === 'new' && canCreate ? (
                  <Link
                    href="/tasks/new"
                    className="grid h-6 w-6 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface-3)] text-[var(--muted-2)] transition hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
                    title="Создать задачу"
                  >
                    <Icon name="plus" size={14} />
                  </Link>
                ) : null}
              </header>
              <p className="-mt-1 px-0.5 text-[10px] text-[var(--muted-2)]">{STATUS_HINTS[status]}</p>

              <div className="column-cards">
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--line)] px-3 py-6 text-center text-[11px] text-[var(--muted-2)]">
                    Пусто
                  </div>
                ) : (
                  items.map((task) => (
                    <PendingLink
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      prefetch={false}
                      className="task-card"
                      data-testid="task-card"
                      data-code={task.code}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-medium tracking-[0.02em] text-[var(--muted-2)]">{task.code}</span>
                        <PriorityChip priority={task.priority} />
                      </div>
                      <p className="mt-2.5 line-clamp-2 text-[13px] font-medium leading-snug">{task.offer}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <GeoChip geo={task.geo} />
                        <TypeChip type={task.creativeType} />
                        <span className="pill pill-low">×{task.quantity}</span>
                      </div>
                      {task.assigneeName ? (
                        <div className="mt-3 flex items-center gap-2 border-t border-[var(--line)] pt-2.5">
                          <Avatar name={task.assigneeName} color="#a78bfa" size={18} />
                          <span className="truncate text-[11px] text-[var(--muted)]">{task.assigneeName}</span>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-2 border-t border-[var(--line)] pt-2.5 text-[11px] text-[var(--muted-2)]">
                          <span className="grid h-[18px] w-[18px] place-items-center rounded-full border border-dashed border-[var(--line-strong)]">
                            <Icon name="user" size={10} />
                          </span>
                          Свободна
                        </div>
                      )}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <DeadlineChip deadline={task.deadline} status={task.status} now={now} />
                        <CreditsChip value={task.creditsTotal} />
                        {task.revisionCount > 0 ? (
                          <span className="pill pill-high">правки · {task.revisionCount}</span>
                        ) : null}
                      </div>
                    </PendingLink>
                  ))
                )}
              </div>

              {status === 'done' ? (
                <div className="border-t border-[var(--line)] px-0.5 pt-2 text-[10px] text-[var(--muted-2)]">
                  {formatCredits(items.reduce((sum, task) => sum + task.creditsTotal, 0))} AI-кредитов
                </div>
              ) : null}
            </section>
          )
        })}
      </div>

      {tasks.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Задач пока нет" hint="Создайте первое ТЗ — оно появится в колонке «Новые»." />
        </div>
      ) : null}
    </div>
  )
}
