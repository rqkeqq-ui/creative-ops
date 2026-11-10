import { randomUUID } from 'node:crypto'
import type { Db } from '@/lib/db/client'
import { activityRepo, aiUsageRepo, tasksRepo, usersRepo } from '@/lib/db/repositories'
import type { ActivityType, AiUsagePhase, CreativeType, Priority, Role, TaskStatus } from '@/lib/domain/types'
import { hashPassword } from '@/lib/auth/password'

export const DEMO_PASSWORD = 'demo1234'

export interface DemoUser {
  email: string
  name: string
  role: Role
  color: string
}

export const DEMO_USERS: DemoUser[] = [
  { email: 'lead@creativeops.demo', name: 'Анна Воронцова', role: 'manager', color: '#B07CFF' },
  { email: 'buyer@creativeops.demo', name: 'Илья Соколов', role: 'buyer', color: '#5B8DEF' },
  { email: 'buyer2@creativeops.demo', name: 'Марина Ким', role: 'buyer', color: '#4CC9F0' },
  { email: 'creative@creativeops.demo', name: 'Даниил Орлов', role: 'creative', color: '#3ECF8E' },
  { email: 'creative2@creativeops.demo', name: 'Софья Лебедева', role: 'creative', color: '#F2A65A' },
  { email: 'creative3@creativeops.demo', name: 'Тимур Ахметов', role: 'creative', color: '#F26D6D' },
]

interface SeedAiUsage {
  service: string
  credits: number
  phase: AiUsagePhase
  atH: number
  note?: string
}

interface SeedTask {
  offer: string
  geo: string
  creativeType: CreativeType
  quantity: number
  priority: Priority
  buyer: string
  assignee?: string
  status: TaskStatus
  createdH: number
  deadlineH: number
  startedH?: number
  submittedH?: number
  revisionRequestedH?: number
  retakeH?: number
  resubmittedH?: number
  completedH?: number
  revisionNote?: string
  deliverableUrl?: string
  deliverableNote?: string
  credits?: SeedAiUsage[]
}

const HOUR = 3_600_000

const DEMO_TASKS: SeedTask[] = [
  {
    offer: 'P2P Wallet — EU Launch',
    geo: 'DE, AT, CH',
    creativeType: 'ugc_video',
    quantity: 4,
    priority: 'high',
    buyer: 'buyer@creativeops.demo',
    status: 'new',
    createdH: -0.5,
    deadlineH: 48,
  },
  {
    offer: 'Crypto Card 2.0',
    geo: 'PL, CZ',
    creativeType: 'static',
    quantity: 6,
    priority: 'normal',
    buyer: 'buyer2@creativeops.demo',
    status: 'new',
    createdH: -5,
    deadlineH: 72,
  },
  {
    offer: 'Trading App Launch',
    geo: 'ES, PT',
    creativeType: 'motion',
    quantity: 2,
    priority: 'urgent',
    buyer: 'buyer@creativeops.demo',
    status: 'new',
    createdH: -2,
    deadlineH: 8,
  },
  {
    offer: 'Forex Signals VIP',
    geo: 'IT',
    creativeType: 'ugc_video',
    quantity: 3,
    priority: 'high',
    buyer: 'buyer@creativeops.demo',
    assignee: 'creative@creativeops.demo',
    status: 'in_progress',
    createdH: -48,
    startedH: -36,
    deadlineH: 24,
    credits: [
      { service: 'Midjourney', credits: 18, phase: 'initial', atH: -30, note: 'Раскадровка и стиль' },
      { service: 'Runway', credits: 24, phase: 'initial', atH: -28, note: 'Генерация 12 клипов' },
    ],
  },
  {
    offer: 'NFT Marketplace Teaser',
    geo: 'US',
    creativeType: 'motion',
    quantity: 1,
    priority: 'normal',
    buyer: 'buyer2@creativeops.demo',
    assignee: 'creative2@creativeops.demo',
    status: 'in_progress',
    createdH: -24,
    startedH: -4,
    deadlineH: 48,
    credits: [{ service: 'Kling', credits: 30, phase: 'initial', atH: -3, note: 'Черновая анимация' }],
  },
  {
    offer: 'Mobile Banking App',
    geo: 'DE',
    creativeType: 'static',
    quantity: 8,
    priority: 'normal',
    buyer: 'buyer@creativeops.demo',
    assignee: 'creative@creativeops.demo',
    status: 'review',
    createdH: -96,
    startedH: -72,
    submittedH: -2,
    deadlineH: 24,
    deliverableUrl: 'https://drive.google.com/demo/mobile-banking',
    deliverableNote: '8 адаптаций под 4 формата',
    credits: [
      { service: 'Midjourney', credits: 22, phase: 'initial', atH: -60 },
      { service: 'ChatGPT', credits: 3, phase: 'initial', atH: -50, note: 'Тексты для баннеров' },
    ],
  },
  {
    offer: 'Crypto Casino Bonuses',
    geo: 'BR',
    creativeType: 'ugc_video',
    quantity: 2,
    priority: 'high',
    buyer: 'buyer2@creativeops.demo',
    assignee: 'creative3@creativeops.demo',
    status: 'review',
    createdH: -72,
    startedH: -60,
    submittedH: -6,
    deadlineH: 12,
    deliverableUrl: 'https://drive.google.com/demo/casino-bonuses',
    deliverableNote: '2 видео, PT-BR озвучка',
    credits: [{ service: 'Runway', credits: 40, phase: 'initial', atH: -20 }],
  },
  {
    offer: 'Sports Betting App',
    geo: 'NG, KE',
    creativeType: 'ugc_video',
    quantity: 4,
    priority: 'urgent',
    buyer: 'buyer@creativeops.demo',
    assignee: 'creative2@creativeops.demo',
    status: 'revision',
    createdH: -120,
    startedH: -108,
    submittedH: -48,
    revisionRequestedH: -36,
    deadlineH: -6,
    revisionNote: 'Заменить актёров на локальных, добавить динамичные вставки',
    deliverableUrl: 'https://drive.google.com/demo/sports-betting-v1',
    credits: [
      { service: 'Midjourney', credits: 15, phase: 'initial', atH: -100 },
      { service: 'Runway', credits: 35, phase: 'initial', atH: -50 },
    ],
  },
  {
    offer: 'Crypto Exchange UX',
    geo: 'TR',
    creativeType: 'static',
    quantity: 10,
    priority: 'normal',
    buyer: 'buyer2@creativeops.demo',
    assignee: 'creative@creativeops.demo',
    status: 'revision',
    createdH: -144,
    startedH: -120,
    submittedH: -72,
    revisionRequestedH: -48,
    deadlineH: -2,
    revisionNote: 'Пересобрать сетку под турецкую локализацию, поправить CTA',
    deliverableUrl: 'https://drive.google.com/demo/exchange-ux-v1',
    credits: [
      { service: 'Midjourney', credits: 30, phase: 'initial', atH: -100 },
      { service: 'Midjourney', credits: 10, phase: 'revision', atH: -46, note: 'Перегенерация локализации' },
    ],
  },
  {
    offer: 'Card Cashback Campaign',
    geo: 'DE, FR',
    creativeType: 'ugc_video',
    quantity: 5,
    priority: 'high',
    buyer: 'buyer@creativeops.demo',
    assignee: 'creative@creativeops.demo',
    status: 'done',
    createdH: -216,
    startedH: -192,
    submittedH: -156,
    completedH: -144,
    deadlineH: -120,
    deliverableUrl: 'https://drive.google.com/demo/cashback',
    credits: [
      { service: 'Midjourney', credits: 25, phase: 'initial', atH: -200 },
      { service: 'ElevenLabs', credits: 6, phase: 'initial', atH: -160, note: 'Озвучка DE/FR' },
    ],
  },
  {
    offer: 'Referral Program',
    geo: 'UK',
    creativeType: 'static',
    quantity: 12,
    priority: 'low',
    buyer: 'buyer2@creativeops.demo',
    assignee: 'creative2@creativeops.demo',
    status: 'done',
    createdH: -288,
    startedH: -264,
    submittedH: -228,
    revisionRequestedH: -216,
    retakeH: -210,
    resubmittedH: -204,
    completedH: -192,
    deadlineH: -168,
    revisionNote: 'Усилить оффер «+50 USDT» и поправить кнопку',
    deliverableUrl: 'https://drive.google.com/demo/referral-v2',
    credits: [
      { service: 'ChatGPT', credits: 4, phase: 'initial', atH: -270 },
      { service: 'Midjourney', credits: 8, phase: 'initial', atH: -230 },
      { service: 'Midjourney', credits: 5, phase: 'revision', atH: -212 },
    ],
  },
  {
    offer: 'P2P Launch Teaser',
    geo: 'ES',
    creativeType: 'motion',
    quantity: 1,
    priority: 'normal',
    buyer: 'buyer@creativeops.demo',
    assignee: 'creative3@creativeops.demo',
    status: 'done',
    createdH: -168,
    startedH: -144,
    submittedH: -96,
    completedH: -84,
    deadlineH: -90,
    deliverableUrl: 'https://drive.google.com/demo/p2p-teaser',
    credits: [
      { service: 'Runway', credits: 18, phase: 'initial', atH: -120 },
      { service: 'Sora', credits: 12, phase: 'initial', atH: -100 },
    ],
  },
  {
    offer: 'Wallet Onboarding',
    geo: 'PL',
    creativeType: 'ugc_video',
    quantity: 3,
    priority: 'normal',
    buyer: 'buyer2@creativeops.demo',
    assignee: 'creative@creativeops.demo',
    status: 'done',
    createdH: -360,
    startedH: -336,
    submittedH: -288,
    completedH: -264,
    deadlineH: -240,
    deliverableUrl: 'https://drive.google.com/demo/wallet-onboarding',
    credits: [
      { service: 'Midjourney', credits: 12, phase: 'initial', atH: -330 },
      { service: 'ElevenLabs', credits: 3, phase: 'initial', atH: -290 },
    ],
  },
  {
    offer: 'Trading Contest',
    geo: 'IT, ES',
    creativeType: 'banner',
    quantity: 20,
    priority: 'low',
    buyer: 'buyer@creativeops.demo',
    assignee: 'creative2@creativeops.demo',
    status: 'done',
    createdH: -432,
    startedH: -408,
    submittedH: -336,
    completedH: -312,
    deadlineH: -288,
    deliverableUrl: 'https://drive.google.com/demo/trading-contest',
    credits: [{ service: 'Midjourney', credits: 6, phase: 'initial', atH: -400 }],
  },
  {
    offer: 'Crypto Taxes Explainer',
    geo: 'US',
    creativeType: 'copy',
    quantity: 1,
    priority: 'normal',
    buyer: 'buyer2@creativeops.demo',
    status: 'new',
    createdH: -3,
    deadlineH: 96,
  },
  {
    offer: 'Affiliate Hub Landing',
    geo: 'BR',
    creativeType: 'static',
    quantity: 9,
    priority: 'high',
    buyer: 'buyer@creativeops.demo',
    assignee: 'creative3@creativeops.demo',
    status: 'done',
    createdH: -120,
    startedH: -110,
    submittedH: -96,
    revisionRequestedH: -80,
    retakeH: -76,
    resubmittedH: -60,
    completedH: -36,
    deadlineH: -40,
    revisionNote: 'Поправить порядок блоков и цвет CTA',
    deliverableUrl: 'https://drive.google.com/demo/affiliate-hub-v2',
    credits: [{ service: 'Midjourney', credits: 9, phase: 'revision', atH: -70 }],
  },
]

function iso(now: Date, hours: number): string {
  return new Date(now.getTime() + hours * HOUR).toISOString()
}

function seedTasks(db: Db, now: Date): void {
  const userByEmail = new Map(usersRepo.list(db).map((user) => [user.email, user]))

  for (const spec of DEMO_TASKS) {
    const buyer = userByEmail.get(spec.buyer)
    if (!buyer) throw new Error(`Seed buyer not found: ${spec.buyer}`)
    const assignee = spec.assignee ? userByEmail.get(spec.assignee) : null
    if (spec.assignee && !assignee) throw new Error(`Seed creative not found: ${spec.assignee}`)

    const id = randomUUID()
    const createdAt = iso(now, spec.createdH)
    const revisions = spec.revisionRequestedH === undefined ? 0 : 1

    const task = tasksRepo.create(db, {
      id,
      buyerId: buyer.id,
      offer: spec.offer,
      geo: spec.geo,
      creativeType: spec.creativeType,
      quantity: spec.quantity,
      description: `${spec.offer}: ${spec.quantity} ${spec.creativeType === 'copy' ? 'текст' : 'креатив(ов)'} под GEO ${spec.geo}. Демо-задача для проверки Kanban, времени и аналитики.`,
      references: ['https://example.com/reference-board'],
      priority: spec.priority,
      deadline: iso(now, spec.deadlineH),
      status: spec.status,
      createdAt,
      updatedAt: iso(now, spec.completedH ?? spec.submittedH ?? spec.startedH ?? spec.createdH),
    })

    tasksRepo.update(db, id, {
      assigneeId: assignee?.id ?? null,
      revisionCount: revisions,
      revisionNote: spec.revisionNote ?? null,
      firstStartedAt: spec.startedH !== undefined ? iso(now, spec.startedH) : null,
      firstSubmittedAt: spec.submittedH !== undefined ? iso(now, spec.submittedH) : null,
      submittedAt:
        spec.resubmittedH !== undefined ? iso(now, spec.resubmittedH) : spec.submittedH !== undefined ? iso(now, spec.submittedH) : null,
      completedAt: spec.completedH !== undefined ? iso(now, spec.completedH) : null,
      deliverableUrl: spec.deliverableUrl ?? null,
      deliverableNote: spec.deliverableNote ?? null,
    })

    const steps: { type: ActivityType; atH: number; message: string; from: TaskStatus | null; to: TaskStatus }[] = [
      {
        type: 'created',
        atH: spec.createdH,
        message: `Задача создана: ${spec.offer} (${spec.geo})`,
        from: null,
        to: 'new',
      },
    ]

    if (spec.startedH !== undefined) {
      steps.push({
        type: 'taken',
        atH: spec.startedH,
        message: `Взята в работу: ${assignee?.name ?? 'исполнитель'}`,
        from: 'new',
        to: 'in_progress',
      })
    }
    if (spec.submittedH !== undefined) {
      steps.push({
        type: 'submitted',
        atH: spec.submittedH,
        message: `Сдана на проверку${spec.deliverableNote ? `: ${spec.deliverableNote}` : ''} · ${spec.deliverableUrl ?? ''}`,
        from: 'in_progress',
        to: 'review',
      })
    }
    if (spec.revisionRequestedH !== undefined) {
      steps.push({
        type: 'revision_requested',
        atH: spec.revisionRequestedH,
        message: `Отправлена на правки: ${spec.revisionNote ?? ''}`,
        from: 'review',
        to: 'revision',
      })
    }
    if (spec.retakeH !== undefined) {
      steps.push({
        type: 'taken',
        atH: spec.retakeH,
        message: `Взята в работу: ${assignee?.name ?? 'исполнитель'}`,
        from: 'revision',
        to: 'in_progress',
      })
    }
    if (spec.resubmittedH !== undefined) {
      steps.push({
        type: 'submitted',
        atH: spec.resubmittedH,
        message: `Сдана на проверку: ${spec.deliverableNote ?? 'финальная версия'}`,
        from: 'in_progress',
        to: 'review',
      })
    }
    if (spec.completedH !== undefined) {
      steps.push({
        type: 'approved',
        atH: spec.completedH,
        message: `Принята: работу одобрил ${buyer.name}`,
        from: 'review',
        to: 'done',
      })
    }

    for (const step of steps) {
      activityRepo.create(db, {
        id: randomUUID(),
        taskId: id,
        actorId: step.type === 'created' || step.type === 'approved' || step.type === 'revision_requested' ? buyer.id : assignee!.id,
        type: step.type,
        fromStatus: step.from,
        toStatus: step.to,
        message: step.message,
        createdAt: iso(now, step.atH),
      })
    }

    for (const credit of spec.credits ?? []) {
      aiUsageRepo.create(db, {
        id: randomUUID(),
        taskId: id,
        userId: assignee!.id,
        service: credit.service,
        credits: credit.credits,
        note: credit.note ?? null,
        phase: credit.phase,
        createdAt: iso(now, credit.atH),
      })
    }
  }
}

export interface SeedOptions {
  /** false — создать только пользователей (используется тестами сервисов). */
  tasks?: boolean
}

export function seedDatabase(db: Db, now: Date = new Date(), options: SeedOptions = {}): void {
  if (usersRepo.count(db) > 0) return

  db.exec('BEGIN IMMEDIATE')
  try {
    for (const demo of DEMO_USERS) {
      usersRepo.create(db, {
        id: randomUUID(),
        email: demo.email,
        name: demo.name,
        role: demo.role,
        color: demo.color,
        passwordHash: hashPassword(DEMO_PASSWORD),
        createdAt: now.toISOString(),
      })
    }
    if (options.tasks !== false) {
      seedTasks(db, now)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** Вызывается лениво из getDb(): наполняет пустую БД демо-данными. */
export function ensureDemoData(db: Db): void {
  if (usersRepo.count(db) === 0) {
    seedDatabase(db, new Date())
  }
}