import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
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
        background: `${color}20`,
        color,
        border: `1px solid ${color}4d`,
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
      className="pill"
      style={{ color, background: `${color}16`, borderColor: `${color}3d`, fontSize: size === 'sm' ? 10 : 10.5 }}
    >
      <span style={{ background: color }} className="h-1.5 w-1.5 rounded-full" />
      {STATUS_LABELS_SINGULAR[status]}
    </span>
  )
}

const PRIORITY_PILL: Record<Priority, string> = {
  urgent: 'pill pill-urgent',
  high: 'pill pill-high',
  normal: 'pill pill-medium',
  low: 'pill pill-low',
}

export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span className={PRIORITY_PILL[priority]} title={`Приоритет: ${PRIORITY_LABELS[priority]}`}>
      {priority === 'urgent' ? <Icon name="flame" size={11} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_ACCENT[priority] }} />}
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

export function TypeChip({ type }: { type: CreativeType }) {
  return <span className="pill pill-type">{CREATIVE_TYPE_LABELS[type]}</span>
}

export function GeoChip({ geo }: { geo: string }) {
  return (
    <span className="pill pill-geo">
      <Icon name="target" size={10} />
      {geo}
    </span>
  )
}

export function RoleChip({ role }: { role: Role }) {
  return <span className="chip">{ROLE_LABELS[role]}</span>
}

export function DeadlineChip({ deadline, status, now }: { deadline: string; status: TaskStatus; now: Date }) {
  const overdue = status !== 'done' && isOverdue({ status, deadline, completedAt: null }, now)
  return (
    <span className="chip" style={overdue ? { color: '#fca5a5', background: 'rgba(248,113,113,.1)', borderColor: 'rgba(248,113,113,.3)' } : undefined}>
      <Icon name="calendar" size={11} />
      {formatDeadline(deadline)}
      {overdue ? ' · просрочено' : ''}
    </span>
  )
}

export function CreditsChip({ value }: { value: number }) {
  if (value <= 0) return null
  return (
    <span className="pill pill-ai">
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
        <div className="mb-2 flex items-center gap-2">
          <span className="h-1 w-6 rounded-full bg-[var(--accent)]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-2)]">Creative operations</span>
        </div>
        <h1 className="text-[25px] font-semibold tracking-[-0.035em]">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-[12.5px] text-[var(--muted)]">{subtitle}</p> : null}
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
              <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-3)] text-[var(--muted)]">
                <Icon name={icon} size={14} />
              </span>
            ) : null}
            <div>
              <h2 className="section-title">{title}</h2>
              {hint ? <p className="mt-0.5 text-[11px] text-[var(--muted-2)]">{hint}</p> : null}
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
  accent = 'var(--accent)',
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
    <div className="kpi-card fade-in" style={{ '--kpi-accent': accent } as CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-2)]">{label}</span>
        <span
          className="grid h-9 w-9 place-items-center rounded-lg border"
          style={{ color: accent, background: `color-mix(in srgb, ${accent} 12%, transparent)`, borderColor: `color-mix(in srgb, ${accent} 26%, transparent)` }}
        >
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div className="metric-value mt-4" style={{ color: 'var(--text)' }} data-testid={testId}>
        {value}
      </div>
      {hint ? <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted-2)]">{hint}</p> : null}
    </div>
  )
}

export function EmptyState({ title, hint, icon = 'inbox' }: { title: string; hint?: string; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] px-6 py-10 text-center">
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
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(248,113,113,.3)] bg-[rgba(248,113,113,.1)] text-[#fca5a5]">
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
