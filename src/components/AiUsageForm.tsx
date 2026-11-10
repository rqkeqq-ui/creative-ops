'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AI_SERVICES } from '@/lib/domain/types'
import { Icon } from './Icon'

export function AiUsageForm({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [service, setService] = useState<string>('Midjourney')
  const [credits, setCredits] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Синхронный замок против двойного submit: state применяется лишь после ре-рендера.
  const inFlight = useRef(false)

  async function submit() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/tasks/${taskId}/ai-usage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ service, credits: Number(credits), note }),
      })
      const data = (await response.json()) as {
        error?: { message: string; details?: { field: string; message: string }[] }
      }
      if (!response.ok) {
        setError(data.error?.details?.[0]?.message ?? data.error?.message ?? 'Не удалось сохранить расход')
        return
      }
      setCredits('')
      setNote('')
      router.refresh()
    } catch {
      setError('Сервис недоступен, попробуйте ещё раз')
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <form
      className="mt-3 grid gap-2 rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-3"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <select data-testid="ai-service" className="select !h-[34px] !py-0" value={service} onChange={(event) => setService(event.target.value)}>
          {AI_SERVICES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          data-testid="ai-credits"
          className="input !h-[34px] !py-0"
          type="number"
          min="0.25"
          step="0.25"
          placeholder="Кредиты"
          value={credits}
          onChange={(event) => setCredits(event.target.value)}
        />
      </div>
      <input
        data-testid="ai-note"
        className="input !h-[34px] !py-0"
        placeholder="На что потратили (необязательно)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      {error ? <p className="text-[11px] text-[#f6a1a1]">{error}</p> : null}
      <button type="submit" data-testid="ai-submit" className="btn btn-dark btn-sm" disabled={pending}>
        <Icon name="plus" size={13} />
        {pending ? 'Сохраняем…' : 'Добавить расход'}
      </button>
    </form>
  )
}