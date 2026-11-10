import Link from 'next/link'
import type { ReactNode } from 'react'
import type { CreativeType, Priority, Role, TaskStatus } from '@/lib/domain/types'
import { CREATIVE_TYPE_LABELS, PRIORITY_ACCENT, PRIORITY_LABELS, ROLE_LABELS, STATUS_ACCENT, STATUS_LABELS_SINGULAR } from '@/lib/domain/catalog'
import { formatDate, formatDeadline, isOverdue } from '@/lib/domain/time'
import { formatCredits, initials } from '@/lib/format'
import { Icon, type IconName } from './Icon'

export function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        fontSize: Math.round(size * 0.38),
      }}
      className="inline-grid shrink-0 place-items-center rounded-full font-bold"
      title={name}
    >
      {initials(name)}
    </span>
  )
}

export function StatusPill({ status, size = 'md' }: { status: TaskStatus; size?: 'sm' | 'md' }) {
  const color = STATUS_ACCENT[status]
  return (
    <span
      className="chip"
      style={{ color, background: `${color}18`, borderColor: `${color}3d`, fontSize: size === 'sm' ? 10 : 11 }}
    >
      <span style={{ background: color }} className="h-1.5 w-1.5 rounded-full" />
      {STATUS_LABELS_SINGULAR[status]}
    </span>
  )
}

export function PriorityChip({ priority }: { priority: Priority }) {
  const color = PRIORITY_ACCENT[priority]
  return (
    <span className="chip" style={{ color, background: `${color}16`, borderColor: `${color}38` }}>
      {priority === 'urgent' && <Icon name="flame" size={11} />}
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

export function TypeChip({ type }: { type: CreativeType }) {
  return <span className="chip">{CREATIVE_TYPE_LABELS[type]}</span>
}

export function RoleChip({ role }: { role: Role }) {
  return <span className="chip">{ROLE_LABELS[role]}</span>
}

export function DeadlineChip({ deadline, status, now }: { deadline: string; status: TaskStatus; now: Date }) {
  const overdue = status !== 'done' && isOverdue({ status, deadline, completedAt: null }, now)
  return (
    <span className="chip" style={overdue ? { color: '#f26d6d', background: '#f26d6d14', borderColor: '#f26d6d3d' } : undefined}>
      <Icon name="calendar" size={11} />
      {formatDeadline(deadline)}
      {overdue ? ' · просрочено' : ''}
    </span>
  )
}

export function CreditsChip({ value }: { value: number }) {
  if (value <= 0) return null
  return (
    <span className="chip" style={{ color: '#c6f24e', background: '#c6f24e12', borderColor: '#c6f24e30' }}>
      <Icon name="coins" size={11} />
      {formatCredits(value)} кр.
    </span>
  )
}

export function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-[13px] text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Panel({
  title,
  hint,
  icon,
  actions,
  children,
  className = '',
  testId,
  padded = true,
}: {
  title?: string
  hint?: string
  icon?: IconName
  actions?: ReactNode
  children: ReactNode
  className?: string
  testId?: string
  padded?: boolean
}) {
  return (
    <section className={`panel fade-in ${className}`} data-testid={testId}>
      {title ? (
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="flex items-start gap-2.5">
            {icon ? (
              <span className="mt-0.5 text-[var(--muted)]">
                <Icon name={icon} size={16} />
              </span>
            ) : null}
            <div>
              <h2 className="section-title">{title}</h2>
              {hint ? <p className="mt-0.5 text-[11.5px] text-[var(--muted-2)]">{hint}</p> : null}
            </div>
          </div>
          {actions}
        </header>
      ) : null}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = 'var(--text)',
  testId,
}: {
  label: string
  value: string
  hint?: string
  icon: IconName
  accent?: string
  testId?: string
}) {
  return (
    <div className="panel fade-in p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--muted)]">{label}</span>
        <span style={{ color: accent }}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div className="metric-value mt-3" style={{ color: accent }} data-testid={testId}>
        {value}
      </div>
      {hint ? <p className="mt-1.5 text-[11.5px] text-[var(--muted-2)]">{hint}</p> : null}
    </div>
  )
}

export function EmptyState({ title, hint, icon = 'inbox' }: { title: string; hint?: string; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line)] px-6 py-10 text-center">
      <span className="text-[var(--muted-2)]">
        <Icon name={icon} size={22} />
      </span>
      <p className="text-[13px] font-medium text-[var(--muted)]">{title}</p>
      {hint ? <p className="max-w-[320px] text-[11.5px] text-[var(--muted-2)]">{hint}</p> : null}
    </div>
  )
}

export function Forbidden({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" data-testid="forbidden-page">
      <div className="panel max-w-[440px] p-8 text-center">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f26d6d14] text-[#f26d6d]">
          <Icon name="shield" size={22} />
        </span>
        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mt-2 text-[13px] text-[var(--muted)]">{hint}</p>
        <Link href="/board" className="btn btn-dark mt-5 inline-flex">
          Вернуться на доску
        </Link>
      </div>
    </div>
  )
}

export function InfoRow({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-2.5 last:border-b-0">
      <span className="text-[11.5px] text-[var(--muted-2)]">{label}</span>
      <span className={`text-right text-[12.5px] font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export function formatTimestamp(iso: string | null): string {
  return formatDate(iso)
}
