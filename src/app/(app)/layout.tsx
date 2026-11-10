import type { ReactNode } from 'react'
import { requireUser } from '@/lib/auth/session'
import { AppShell } from '@/components/AppShell'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  return <AppShell user={user}>{children}</AppShell>
}