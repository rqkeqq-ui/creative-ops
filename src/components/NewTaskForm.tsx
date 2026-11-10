'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CREATIVE_TYPES, PRIORITY_LABELS, GEO_SUGGESTIONS } from '@/lib/domain/catalog'
import type { Priority } from '@/lib/domain/types'
import { Icon } from '@/components/Icon'

interface FieldErrors {
  [field: string]: string | undefined
}

function defaultDeadline(): string {
  const date = new Date(Date.now() + 48 * 3_600_000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function NewTaskForm() {
  const router = useRouter()
  const [offer, setOffer] = useState('')
  const [geo, setGeo] = useState('')
  const [creativeType, setCreativeType] = useState<string>('ugc_video')
  const [quantity, setQuantity] = useState('3')
  const [description, setDescription] = useState('')
  const [references, setReferences] = useState('')
  const [priority, setPriority] = useState<Priority>('normal')
  const [deadline, setDeadline] = useState(defaultDeadline())
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit() {
    setPending(true)
    setFormError(null)
    setErrors({})

    const payload = {
      offer,
      geo,
      creativeType,
      quantity: Number(quantity),
      description,
      references: references
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean),
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : '',
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await response.json()) as {
        task?: { id: string }
        error?: { message: string; details?: { field: string; message: string }[] }
      }

      if (!response.ok) {
        setFormError(data.error?.message ?? 'Не удалось создать задачу')
        if (data.error?.details) {
          setErrors(Object.fromEntries(data.error.details.map((item) => [item.field, item.message])))
        }
        return
      }

      router.push(`/tasks/${data.task!.id}`)
      router.refresh()
    } catch {
      setFormError('Сервис недоступен, попробуйте ещё раз')
    } finally {
      setPending(false)
    }
  }

  const fieldError = (field: string) =>
    errors[field] ? <p className="mt-1.5 text-[11px] text-[#f6a1a1]">{errors[field]}</p> : null

  return (
    <form
      className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="panel p-5">
        <h2 className="section-title">Бриф</h2>
        <p className="mt-1 text-[11.5px] text-[var(--muted-2)]">Что нужно сделать креативщику: оффер, площадка и требования.</p>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="label" htmlFor="offer">
              Оффер *
            </label>
            <input
              id="offer"
              data-testid="offer"
              className="input"
              placeholder="Например: P2P Wallet — EU Launch"
              value={offer}
              onChange={(event) => setOffer(event.target.value)}
            />
            {fieldError('offer')}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="geo">
                GEO *
              </label>
              <input
                id="geo"
                data-testid="geo"
                className="input"
                list="geo-suggestions"
                placeholder="DE, AT, CH"
                value={geo}
                onChange={(event) => setGeo(event.target.value)}
              />
              <datalist id="geo-suggestions">
                {GEO_SUGGESTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              {fieldError('geo')}
            </div>
            <div>
              <label className="label" htmlFor="quantity">
                Количество единиц *
              </label>
              <input
                id="quantity"
                data-testid="quantity"
                className="input"
                type="number"
                min={1}
                max={200}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
              {fieldError('quantity')}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="description">
              Описание задачи *
            </label>
            <textarea
              id="description"
              data-testid="description"
              className="textarea"
              placeholder="Формат, хронометраж, стиль, обязательные элементы, язык озвучки…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            {fieldError('description')}
          </div>

          <div>
            <label className="label" htmlFor="references">
              Референсы — по одной ссылке в строке
            </label>
            <textarea
              id="references"
              data-testid="references"
              className="textarea !min-h-[76px]"
              placeholder="https://www.tiktok.com/@brand/video/123…"
              value={references}
              onChange={(event) => setReferences(event.target.value)}
            />
            {fieldError('references')}
            <p className="mt-1.5 text-[11px] text-[var(--muted-2)]">Ссылки помогают попасть в стиль с первого раза.</p>
          </div>
        </div>
      </div>

      <div className="panel p-5 lg:sticky lg:top-6">
        <h2 className="section-title">Параметры производства</h2>
        <div className="mt-5 grid gap-4">
          <div>
            <label className="label" htmlFor="creative-type">
              Тип креатива *
            </label>
            <select
              id="creative-type"
              data-testid="creative-type"
              className="select"
              value={creativeType}
              onChange={(event) => setCreativeType(event.target.value)}
            >
              {CREATIVE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="priority">
              Приоритет *
            </label>
            <select
              id="priority"
              data-testid="priority"
              className="select"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              {(Object.keys(PRIORITY_LABELS) as Priority[]).map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="deadline">
              Дедлайн *
            </label>
            <input
              id="deadline"
              data-testid="deadline"
              className="input"
              type="datetime-local"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
            {fieldError('deadline')}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <p className="flex items-center gap-2 text-[12px] font-medium">
              <Icon name="clock" size={14} />
              Что произойдёт дальше
            </p>
            <ul className="mt-2 grid gap-1.5 text-[11px] text-[var(--muted-2)]">
              <li>1. Задача появится в колонке «Новые» и станет доступна креативщикам.</li>
              <li>2. Креативщик возьмёт её в работу — время старта зафиксируется автоматически.</li>
              <li>3. После сдачи вы примете работу или отправите на правки.</li>
            </ul>
          </div>

          {formError ? (
            <p data-testid="form-error" className="rounded-lg border border-[#f26d6d40] bg-[#f26d6d14] px-3 py-2 text-[12px] text-[#f6a1a1]">
              {formError}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button type="submit" data-testid="submit-task" className="btn btn-primary flex-1" disabled={pending}>
              {pending ? 'Публикуем…' : 'Опубликовать задачу'}
            </button>
            <Link href="/board" className="btn btn-dark">
              Отмена
            </Link>
          </div>
        </div>
      </div>
    </form>
  )
}