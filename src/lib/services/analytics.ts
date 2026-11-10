import { aiUsageRepo, tasksRepo, usersRepo } from '@/lib/db/repositories'
import { buildAnalytics, type AnalyticsReport } from '@/lib/domain/analytics'
import type { User } from '@/lib/domain/types'
import { canViewAnalytics } from '@/lib/domain/workflow'
import { errors } from './errors'
import { type Ctx } from './context'

export interface AnalyticsOptions {
  rangeDays?: number | null
}

export function getAnalyticsReport(ctx: Ctx, actor: User, options: AnalyticsOptions = {}): AnalyticsReport {
  if (!canViewAnalytics(actor.role)) {
    throw errors.forbidden('Аналитика доступна только руководителю')
  }

  return buildAnalytics({
    tasks: tasksRepo.list(ctx.db),
    users: usersRepo.list(ctx.db),
    usage: aiUsageRepo.listAll(ctx.db),
    now: ctx.now(),
    rangeDays: options.rangeDays ?? null,
  })
}

export function parseRange(value: string | null | undefined): number | null {
  if (!value || value === 'all') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}