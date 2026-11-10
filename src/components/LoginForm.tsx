'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './Icon'

const DEMO_ACCOUNTS = [
  { role: 'manager', email: 'lead@creativeops.demo', name: 'Анна Воронцова', title: 'Руководитель', color: '#B07CFF' },
  { role: 'buyer', email: 'buyer@creativeops.demo', name: 'Илья Соколов', title: 'Медиабайер', color: '#5B8DEF' },
  { role: 'creative', email: 'creative@creativeops.demo', name: 'Даниил Орлов', title: 'Креативщик', color: '#3ECF8E' },
] as const

const OTHER_ACCOUNTS = [
  { email: 'buyer2@creativeops.demo', name: 'Марина Ким', title: 'Медиабайер' },
  { email: 'creative2@creativeops.demo', name: 'Софья Лебедева', title: 'Креативщик' },
  { email: 'creative3@creativeops.demo', name: 'Тимур Ахметов', title: 'Креативщик' },
]

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('buyer@creativeops.demo')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  // Синхронный замок против двойного входа/двойного клика по демо-аккаунту.
  const inFlight = useRef(false)

  async function signIn(nextEmail: string, nextPassword: string, key: string) {
    if (inFlight.current) return
    inFlight.current = true
    setPending(key)
    setError(null)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: nextEmail, password: nextPassword }),
      })
      const payload = (await response.json()) as { error?: { message: string } }
      if (!response.ok) {
        setError(payload.error?.message ?? 'Не удалось войти')
        return
      }
      router.replace('/board')
      router.refresh()
    } catch {
      setError('Сервис недоступен, попробуйте ещё раз')
    } finally {
      inFlight.current = false
      setPending(null)
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="panel p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#c6f24e] text-[#0a0d05]">
            <Icon name="spark" size={18} />
          </span>
          <div>
            <h1 className="text-[17px] font-semibold tracking-[-0.02em]">Вход в CreativeOps</h1>
            <p className="text-[11.5px] text-[var(--muted-2)]">Демо-стенд с тестовыми пользователями</p>
          </div>
        </div>

        <p className="label mt-6">Быстрый вход под ролью</p>
        <div className="grid gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.role}
              type="button"
              data-testid={`demo-${account.role}`}
              disabled={pending !== null}
              onClick={() => signIn(account.email, 'demo1234', account.role)}
              className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5 text-left transition hover:border-[var(--line-strong)] hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-60"
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold"
                style={{ background: `${account.color}22`, color: account.color, border: `1px solid ${account.color}44` }}
              >
                {account.name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">{account.title}</span>
                <span className="block truncate text-[11px] text-[var(--muted-2)]">{account.email}</span>
              </span>
              <span className="text-[var(--muted)]">
                <Icon name={pending === account.role ? 'refresh' : 'arrow-right'} size={15} />
              </span>
            </button>
          ))}
        </div>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--line)]" />
          <span className="text-[10.5px] uppercase tracking-[0.09em] text-[var(--muted-2)]">или по паролю</span>
          <span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void signIn(email, password, 'form')
          }}
        >
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              data-testid="login-email"
              className="input"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              data-testid="login-password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? (
            <p data-testid="login-error" className="rounded-lg border border-[#f26d6d40] bg-[#f26d6d14] px-3 py-2 text-[12px] text-[#f6a1a1]">
              {error}
            </p>
          ) : null}
          <button type="submit" data-testid="login-submit" className="btn btn-primary mt-1" disabled={pending !== null}>
            {pending === 'form' ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </div>

      <div className="panel-soft mt-4 px-4 py-3 text-[11.5px] text-[var(--muted-2)]">
        <p className="font-medium text-[var(--muted)]">Остальные демо-аккаунты — пароль demo1234</p>
        <ul className="mt-2 grid gap-1">
          {OTHER_ACCOUNTS.map((account) => (
            <li key={account.email} className="flex items-center justify-between gap-3">
              <span>{account.name}</span>
              <span className="font-mono text-[10.5px]">{account.email}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}