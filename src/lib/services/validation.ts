import { z } from 'zod'
import { AI_SERVICES, CREATIVE_TYPES, PRIORITIES, TASK_ACTIONS } from '@/lib/domain/types'
import { errors } from './errors'

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `Укажите ${label}` })
    .trim()
    .min(min, `Минимум ${min} символа`)
    .max(max, `Максимум ${max} символов`)

/** Только http(s): ftp:// и прочие схемы не принимаем как ссылки на результат/референс. */
const httpUrl = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => {
      try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
      } catch {
        return false
      }
    }, message)

export const createTaskSchema = z.object({
  offer: trimmed(2, 80, 'оффер'),
  geo: trimmed(2, 60, 'GEO'),
  creativeType: z.enum(CREATIVE_TYPES, { errorMap: () => ({ message: 'Выберите тип креатива' }) }),
  quantity: z
    .number({ invalid_type_error: 'Количество должно быть числом' })
    .int('Количество — целое число')
    .min(1, 'Минимум 1 единица')
    .max(200, 'Максимум 200 единиц'),
  description: trimmed(10, 4000, 'описание'),
  references: z.array(httpUrl('Ссылка должна быть корректным URL')).max(10, 'Максимум 10 референсов').default([]),
  priority: z.enum(PRIORITIES, { errorMap: () => ({ message: 'Выберите приоритет' }) }),
  deadline: z
    .string({ required_error: 'Укажите дедлайн' })
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Некорректная дата дедлайна'),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>

export const submitWorkSchema = z.object({
  deliverableUrl: httpUrl('Нужна корректная ссылка на результат'),
  deliverableNote: z
    .string()
    .max(2000, 'Максимум 2000 символов')
    .nullish()
    .transform((value) => {
      const text = value?.trim()
      return text ? text : null
    }),
})

export type SubmitWorkInput = z.infer<typeof submitWorkSchema>

export const revisionSchema = z.object({
  comment: z
    .string({ required_error: 'Опишите правки' })
    .trim()
    .min(5, 'Опишите, что исправить (минимум 5 символов)')
    .max(500, 'Максимум 500 символов'),
})

export const aiUsageSchema = z.object({
  service: z.enum(AI_SERVICES, { errorMap: () => ({ message: 'Выберите AI-сервис из списка' }) }),
  credits: z
    .number({ invalid_type_error: 'Кредиты должны быть числом' })
    .finite('Некорректное значение')
    .positive('Кредиты должны быть больше нуля')
    .max(100_000, 'Слишком большое значение'),
  note: z
    .string()
    .max(200, 'Максимум 200 символов')
    .nullish()
    .transform((value) => {
      const text = value?.trim()
      return text ? text : null
    }),
})

export type AiUsageInput = z.infer<typeof aiUsageSchema>

export const loginSchema = z.object({
  email: z.string().trim().email('Некорректный email'),
  password: z.string().min(6, 'Минимум 6 символов').max(100, 'Слишком длинный пароль'),
})

export const actionSchema = z.object({
  action: z.enum(TASK_ACTIONS, { errorMap: () => ({ message: 'Неизвестное действие' }) }),
  comment: z.string().max(500, 'Максимум 500 символов').optional(),
  deliverableUrl: z.string().optional(),
  deliverableNote: z.string().max(2000).nullish(),
})

export type ActionInput = z.infer<typeof actionSchema>

export const taskFiltersSchema = z.object({
  status: z.enum(['new', 'in_progress', 'review', 'revision', 'done']).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: z.string().optional(),
  q: z.string().max(120).optional(),
  overdue: z.boolean().optional(),
  scope: z.enum(['all', 'created', 'assigned']).optional(),
})

/** Валидация + единый формат ошибки 422 с привязкой к полям. */
export function parseInput<Schema extends z.ZodTypeAny>(schema: Schema, input: unknown): z.infer<Schema> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? 'form'),
      message: issue.message,
    }))
    throw errors.validation('Проверьте заполнение полей', details)
  }
  return result.data
}