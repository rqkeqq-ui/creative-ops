export const ROLES = ['buyer', 'creative', 'manager'] as const
export type Role = (typeof ROLES)[number]

export const TASK_STATUSES = ['new', 'in_progress', 'review', 'revision', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_ACTIONS = ['take', 'submit', 'approve', 'request_revision'] as const
export type TaskAction = (typeof TASK_ACTIONS)[number]

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type Priority = (typeof PRIORITIES)[number]

export const CREATIVE_TYPES = ['ugc_video', 'static', 'motion', 'banner', 'copy'] as const
export type CreativeType = (typeof CREATIVE_TYPES)[number]

export const AI_SERVICES = [
  'Midjourney',
  'Runway',
  'Kling',
  'Sora',
  'ChatGPT',
  'Claude',
  'ElevenLabs',
  'HeyGen',
  'Flux',
  'Other',
] as const
export type AiService = (typeof AI_SERVICES)[number]

export type AiUsagePhase = 'initial' | 'revision'

export type ActivityType = 'created' | 'taken' | 'submitted' | 'revision_requested' | 'approved'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  color: string
  createdAt: string
}

export interface Task {
  id: string
  number: number
  code: string
  buyerId: string
  assigneeId: string | null
  offer: string
  geo: string
  creativeType: CreativeType
  quantity: number
  description: string
  references: string[]
  priority: Priority
  deadline: string
  status: TaskStatus
  revisionCount: number
  revisionNote: string | null
  deliverableUrl: string | null
  deliverableNote: string | null
  createdAt: string
  firstStartedAt: string | null
  firstSubmittedAt: string | null
  submittedAt: string | null
  completedAt: string | null
  updatedAt: string
}

export interface AiUsage {
  id: string
  taskId: string
  userId: string
  service: string
  credits: number
  note: string | null
  phase: AiUsagePhase
  createdAt: string
}

export interface Activity {
  id: string
  taskId: string
  actorId: string
  type: ActivityType
  fromStatus: TaskStatus | null
  toStatus: TaskStatus | null
  message: string
  createdAt: string
}

export interface Session {
  id: string
  userId: string
  tokenHash: string
  createdAt: string
  expiresAt: string
}