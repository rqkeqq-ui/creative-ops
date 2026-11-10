import { expect, test } from '@playwright/test'
import { loginAs, logout } from './helpers'

test.describe('Kanban-доска', () => {
  test('байер видит пять колонок и демо-задачи', async ({ page }) => {
    await loginAs(page, 'buyer')

    for (const status of ['new', 'in_progress', 'review', 'revision', 'done']) {
      await expect(page.getByTestId(`column-${status}`)).toBeVisible()
    }
    await expect(page.getByTestId('task-card').first()).toBeVisible()
    await expect(page.getByTestId('current-user')).toContainText('Илья')
    await expect(page.getByTestId('nav-new-task')).toBeVisible()
    await expect(page.getByTestId('nav-analytics')).toHaveCount(0)

    await logout(page)
    await expect(page.getByTestId('login-submit')).toBeVisible()
  })

  test('руководитель видит аналитику, креативщик — свои действия', async ({ page }) => {
    await loginAs(page, 'manager')
    await expect(page.getByTestId('nav-analytics')).toBeVisible()
    await expect(page.getByTestId('nav-new-task')).toHaveCount(0)
    await logout(page)

    await loginAs(page, 'creative')
    await expect(page.getByTestId('nav-analytics')).toHaveCount(0)
    await expect(page.getByTestId('nav-new-task')).toHaveCount(0)
    await page.goto('/analytics')
    await expect(page.getByText('Доступ только для руководителя')).toBeVisible()
  })

  test('фильтры доски работают', async ({ page }) => {
    await loginAs(page, 'buyer')

    await page.getByTestId('board-search').fill('Crypto Casino')
    await expect(page.getByTestId('task-card')).toHaveCount(1)
    await expect(page.getByTestId('task-card').first()).toContainText('Crypto Casino')

    await page.getByTestId('board-search').fill('')
    await page.getByTestId('filter-priority').selectOption('urgent')
    const urgentCards = page.getByTestId('task-card')
    expect(await urgentCards.count()).toBeGreaterThan(0)
    for (const card of await urgentCards.all()) {
      await expect(card).toContainText('Срочный')
    }

    await page.getByTestId('filter-status-overdue').click()
    await expect(page.getByTestId('task-card').first()).toBeVisible()
  })
})
