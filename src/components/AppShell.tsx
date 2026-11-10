'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import type { User } from '@/lib/domain/types'
import { ROLE_LABELS } from '@/lib/domain/catalog'
import { Icon, type IconName } from './Icon'
import { Avatar } from './ui'

interface NavItem {
  href: string
  label: string
  icon: IconName
  testId: string
  visible: boolean
}

export function AppShell({ user, children }: { user: User; children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)

  const items: NavItem[] = [
    { href: '/board', label: 'Доска задач', icon: 'board', testId: 'nav-board', visible: true },
    { href: '/tasks/new', label: 'Новая задача', icon: 'plus', testId: 'nav-new-task', visible: user.role === 'buyer' },
    { href: '/analytics', label: 'Аналитика', icon: 'chart', testId: 'nav-analytics', visible: user.role === 'manager' },
  ]

  async function signOut() {
    setLeaving(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="app-grid relative z-10 grid min-h-screen grid-cols-[236px_1fr]">
      <aside className="sidebar sticky top-0 flex h-screen flex-col border-r border-[var(--line)] bg-[rgba(10,12,17,0.72)] px-4 py-5 backdrop-blur-xl">
        <Link href="/board" className="sidebar-brand mb-7 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#c6f24e] text-[#0a0d05]">
            <Icon name="spark" size={18} />
          </span>
          <span>
            <span className="block text-[14px] font-semibold tracking-[-0.02em]">CreativeOps</span>
            <span className="block text-[10.5px] text-[var(--muted-2)]">креативный отдел</span>
          </span>
        </Link>

        <nav className="sidebar-nav flex flex-col gap-1">
          {items
            .filter((item) => item.visible)
            .map((item) => {
              const active = item.href === '/board' ? pathname.startsWith('/board') || pathname.startsWith('/tasks') : pathname.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href} data-testid={item.testId} className={`nav-link ${active ? 'active' : ''}`}>
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </Link>
              )
            })}
        </nav>

        <div className="mt-auto pt-6 lg:pt-0">
          <div className="panel-soft mb-3 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-2)]">Демо-стенд</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
              Данные наполнены примерами: 6 пользователей, 16 задач, расходы AI и история статусов.
            </p>
          </div>
        </div>

        <div className="sidebar-foot flex flex-col gap-2">
          <div className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] px-3 py-2.5" data-testid="current-user">
            <Avatar name={user.name} color={user.color} size={30} />
            <div className="user-meta min-w-0">
              <p className="truncate text-[12.5px] font-medium">{user.name}</p>
              <p className="truncate text-[10.5px] text-[var(--muted-2)]">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
          <button type="button" data-testid="logout" onClick={() => void signOut()} className="btn btn-ghost btn-sm justify-start" disabled={leaving}>
            <Icon name="logout" size={15} />
            {leaving ? 'Выходим…' : 'Выйти'}
          </button>
        </div>
      </aside>

      <div className="page-pad min-w-0 px-7 py-6">{children}</div>
    </div>
  )
}