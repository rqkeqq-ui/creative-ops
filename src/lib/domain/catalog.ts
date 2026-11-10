import type { CreativeType, Priority, Role, TaskStatus } from './types'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новые',
  in_progress: 'В работе',
  review: 'На проверке',
  revision: 'Правки',
  done: 'Готово',
}

export const STATUS_LABELS_SINGULAR: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  revision: 'Правки',
  done: 'Готово',
}

export const STATUS_HINTS: Record<TaskStatus, string> = {
  new: 'Ждут исполнителя',
  in_progress: 'В производстве',
  review: 'Ждут приёмки байером',
  revision: 'Возвращены на доработку',
  done: 'Приняты и закрыты',
}

export const STATUS_ACCENT: Record<TaskStatus, string> = {
  new: '#8B93A7',
  in_progress: '#5B8DEF',
  review: '#B07CFF',
  revision: '#F2A65A',
  done: '#3ECF8E',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  urgent: 'Срочный',
}

export const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'normal', 'low']

export const PRIORITY_ACCENT: Record<Priority, string> = {
  low: '#8B93A7',
  normal: '#5B8DEF',
  high: '#F2A65A',
  urgent: '#F26D6D',
}

export const CREATIVE_TYPES: { value: CreativeType; label: string }[] = [
  { value: 'ugc_video', label: 'UGC-видео' },
  { value: 'static', label: 'Статика' },
  { value: 'motion', label: 'Моушн / анимация' },
  { value: 'banner', label: 'Баннеры' },
  { value: 'copy', label: 'Копирайт' },
]

export const CREATIVE_TYPE_LABELS: Record<CreativeType, string> = Object.fromEntries(
  CREATIVE_TYPES.map((item) => [item.value, item.label]),
) as Record<CreativeType, string>

export const ROLE_LABELS: Record<Role, string> = {
  buyer: 'Медиабайер',
  creative: 'Креативщик',
  manager: 'Руководитель',
}

export const GEO_SUGGESTIONS = ['DE', 'AT', 'CH', 'PL', 'CZ', 'ES', 'PT', 'IT', 'FR', 'US', 'CA', 'UK', 'BR', 'TR', 'NG', 'KE']

export const AI_SERVICE_COLORS: Record<string, string> = {
  Midjourney: '#B07CFF',
  Runway: '#3ECF8E',
  Kling: '#5B8DEF',
  Sora: '#F2A65A',
  ChatGPT: '#3ECF8E',
  Claude: '#F2A65A',
  ElevenLabs: '#F26D6D',
  HeyGen: '#8B93A7',
  Flux: '#5B8DEF',
  Other: '#8B93A7',
}