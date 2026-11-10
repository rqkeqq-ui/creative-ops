'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Fragment, useState, type ReactNode } from 'react'
import type { Role, User } from '@/lib/domain/types'
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

const ROLE_TABS: { role: Role; label: string }[] = [
  { role: 'buyer', label: 'Buyer' },
  { role: 'creative', label: 'Creator' },
  { role: 'manager', label: 'Manager' },
]

export function AppShell({ user, children }: { user: User; children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)

  const items: NavItem[] = [
    { href: '/board', label: 'Канбан-доска', icon: 'board', testId: 'nav-board', visible: true },
    { href: '/tasks/new', label: 'Новая задача', icon: 'plus', testId: 'nav-new-task', visible: user.role === 'buyer' },
    { href: '/analytics', label: 'Аналитика руководителя', icon: 'chart', testId: 'nav-analytics', visible: user.role === 'manager' },
  ]

  async function signOut() {
    setLeaving(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/board" className="flex shrink-0 items-center gap-2.5" aria-label="CreativeOps — на доску">
            <span className="brand-mark">
              <Icon name="spark" size={17} />
            </span>
            <span className="hidden sm:block">
              <span className="block text-[14px] font-semibold leading-tight tracking-[-0.02em]">CreativeOps</span>
              <span className="block text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-2)]">
                Saints workspace
              </span>
            </span>
          </Link>

          <div className="topbar-nav min-w-0">
            <nav className="nav-tabs" aria-label="Основная навигация">
              {items
                .filter((item) => item.visible)
                .map((item, index) => {
                  // /tasks/new — отдельный раздел; карточка задачи относится к доске.
                  const active =
                    item.href === '/board'
                      ? pathname.startsWith('/board') || (pathname.startsWith('/tasks') && !pathname.startsWith('/tasks/new'))
                      : pathname.startsWith(item.href)
                  return (
                    <Fragment key={item.href}>
                      {index > 0 ? <span className="nav-divider" aria-hidden /> : null}
                      <Link href={item.href} data-testid={item.testId} className={`nav-tab ${active ? 'active' : ''}`}>
                        <Icon name={item.icon} size={15} />
                        {item.label}
                      </Link>
                    </Fragment>
                  )
                })}
            </nav>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <div className="role-switch" data-testid="role-switch" aria-label="Текущая роль в демо-стенде">
              {ROLE_TABS.map((tab) => (
                <span
                  key={tab.role}
                  className={`role-tab ${user.role === tab.role ? 'active' : ''}`}
                  aria-current={user.role === tab.role ? 'true' : undefined}
                  title={user.role === tab.role ? `${ROLE_LABELS[tab.role]} — текущая роль` : `Роль ${ROLE_LABELS[tab.role]} доступна на экране входа`}
                >
                  {tab.label}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2.5" data-testid="current-user">
              <Avatar name={user.name} color={user.color} size={30} />
              <div className="topbar-user-name min-w-0 leading-tight">
                <p className="max-w-[150px] truncate text-[12px] font-medium">{user.name}</p>
                <p className="text-[10px] text-[var(--muted-2)]">{ROLE_LABELS[user.role]}</p>
              </div>
            </div>

            <button
              type="button"
              data-testid="logout"
              onClick={() => void signOut()}
              className="btn btn-ghost btn-sm !w-8 !px-0"
              title="Выйти"
              aria-label="Выйти"
              disabled={leaving}
            >
              <Icon name="logout" size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="page-pad min-w-0 flex-1">{children}</main>
    </div>
  )
}
