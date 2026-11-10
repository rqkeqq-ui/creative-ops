'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TaskAction, TaskStatus } from '@/lib/domain/types'
import { Icon } from './Icon'

interface Props {
  taskId: string
  actions: TaskAction[]
  status: TaskStatus
}

export function TaskActions({ taskId, actions, status }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  // Синхронный замок: двойной клик не должен отправлять действие дважды.
  const inFlight = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [deliverableUrl, setDeliverableUrl] = useState('')
  const [deliverableNote, setDeliverableNote] = useState('')
  const [comment, setComment] = useState('')

  const canTake = actions.includes('take')
  const canSubmit = actions.includes('submit')
  const canApprove = actions.includes('approve')
  const canRevise = actions.includes('request_revision')

  async function run(action: TaskAction, payload: Record<string, unknown> = {}) {
    if (inFlight.current) return
    inFlight.current = true
    setPending(action)
    setError(null)
    try {
      const response = await fetch(`/api/tasks/${taskId}/actions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      })
      const data = (await response.json()) as {
        error?: { message: string; details?: { field: string; message: string }[] }
      }
      if (!response.ok) {
        setError(data.error?.details?.[0]?.message ?? data.error?.message ?? 'Не удалось выполнить действие')
        return
      }
      if (action === 'submit') {
        setDeliverableUrl('')
        setDeliverableNote('')
      }
      if (action === 'request_revision') setComment('')
      router.refresh()
    } catch {
      setError('Сервис недоступен, попробуйте ещё раз')
    } finally {
      inFlight.current = false
      setPending(null)
    }
  }

  if (!canTake && !canSubmit && !canApprove && !canRevise) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--line)] p-4 text-[11.5px] text-[var(--muted-2)]">
        {status === 'done'
          ? 'Задача завершена — действий не требуется.'
          : 'Сейчас действий для вашей роли нет. Дождитесь следующего шага.'}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {canTake ? (
        <button type="button" data-testid="action-take" className="btn btn-primary" disabled={pending !== null} onClick={() => void run('take')}>
          <Icon name="arrow-right" size={15} />
          {pending === 'take' ? 'Берём…' : status === 'revision' ? 'Взять на правки' : 'Взять в работу'}
        </button>
      ) : null}

      {canSubmit ? (
        <div className="grid gap-2.5 rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-3">
          <p className="text-[11.5px] font-medium">Прикрепить результат</p>
          <input
            data-testid="deliverable-url"
            className="input"
            placeholder="Ссылка на файлы (Google Drive, Figma…)"
            value={deliverableUrl}
            onChange={(event) => setDeliverableUrl(event.target.value)}
          />
          <input
            data-testid="deliverable-note"
            className="input"
            placeholder="Комментарий: что внутри, версия"
            value={deliverableNote}
            onChange={(event) => setDeliverableNote(event.target.value)}
          />
          <button
            type="button"
            data-testid="action-submit"
            className="btn btn-primary"
            disabled={pending !== null}
            onClick={() => void run('submit', { deliverableUrl, deliverableNote })}
          >
            <Icon name="check" size={15} />
            {pending === 'submit' ? 'Отправляем…' : 'Сдать на проверку'}
          </button>
        </div>
      ) : null}

      {canApprove ? (
        <button type="button" data-testid="action-approve" className="btn btn-primary" disabled={pending !== null} onClick={() => void run('approve')}>
          <Icon name="check" size={15} />
          {pending === 'approve' ? 'Принимаем…' : 'Принять работу'}
        </button>
      ) : null}

      {canRevise ? (
        <div className="grid gap-2.5 rounded-xl border border-[rgba(251,146,60,.28)] bg-[rgba(251,146,60,.06)] p-3">
          <p className="text-[11.5px] font-medium text-[#fdba74]">Вернуть на правки</p>
          <textarea
            data-testid="revision-comment"
            className="textarea !min-h-[72px]"
            placeholder="Что именно исправить? Минимум 5 символов"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <button
            type="button"
            data-testid="action-revision"
            className="btn btn-warn"
            disabled={pending !== null}
            onClick={() => void run('request_revision', { comment })}
          >
            <Icon name="refresh" size={15} />
            {pending === 'request_revision' ? 'Отправляем…' : 'Отправить на правки'}
          </button>
        </div>
      ) : null}

      {error ? (
        <p data-testid="action-error" className="rounded-lg border border-[rgba(248,113,113,.3)] bg-[rgba(248,113,113,.08)] px-3 py-2 text-[11.5px] text-[#fca5a5]">
          {error}
        </p>
      ) : null}
    </div>
  )
}