'use client'

import Link, { useLinkStatus } from 'next/link'
import type { ComponentProps } from 'react'

function PendingOverlay() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span className="link-pending" aria-hidden>
      <span className="link-pending-spinner" />
    </span>
  )
}

/**
 * Link с локальным индикатором перехода. Нужен для карточек задач:
 * у /tasks/[id] нет loading.tsx, иначе Next отдаёт 200 вместо 404.
 */
export function PendingLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <PendingOverlay />
    </Link>
  )
}
