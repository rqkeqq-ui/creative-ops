import { expect, type Page } from '@playwright/test'

export type DemoRole = 'manager' | 'buyer' | 'creative'

/** Вход через кнопку демо-аккаунта на странице логина. */
export async function loginAs(page: Page, role: DemoRole): Promise<void> {
  await page.goto('/login')
  await page.getByTestId(`demo-${role}`).click()
  await expect(page).toHaveURL(/\/board/)
  await expect(page.getByTestId('kanban')).toBeVisible()
}

export async function logout(page: Page): Promise<void> {
  await page.getByTestId('logout').click()
  await expect(page).toHaveURL(/\/login/)
}

/** Значение для input[type=datetime-local]. */
export function deadlineLocal(hoursAhead = 48): string {
  const date = new Date(Date.now() + hoursAhead * 3_600_000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
