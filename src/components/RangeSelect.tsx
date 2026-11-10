'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const OPTIONS = [
  { value: '7', label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
  { value: 'all', label: 'Всё время' },
]

export function RangeSelect({ value }: { value: string }) {
  const router = useRouter()
  const [current, setCurrent] = useState(value)
  const [pending, startTransition] = useTransition()

  return (
    <select
      className="select !h-[36px] !w-[140px]"
      data-testid="range-select"
      aria-label="Период аналитики"
      value={current}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value
        setCurrent(next)
        startTransition(() => {
          router.push(next === '30' ? '/analytics' : `/analytics?range=${next}`)
        })
      }}
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}