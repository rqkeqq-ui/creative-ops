import { expect, test } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('Аналитика руководителя', () => {
  test('показывает KPI, загрузку, AI-расходы и просрочки', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.getByTestId('nav-analytics').click()
    await expect(page).toHaveURL(/\/analytics/)

    await expect(page.getByTestId('kpi-total')).not.toHaveText('0')
    await expect(page.getByTestId('kpi-overdue')).not.toHaveText('0')
    await expect(page.getByTestId('kpi-avg-time')).not.toHaveText('—')
    await expect(page.getByTestId('kpi-credits')).not.toHaveText('0')

    await expect(page.getByTestId('ai-by-service')).toBeVisible()
    const serviceRows = page.getByTestId('ai-service-row')
    expect(await serviceRows.count()).toBeGreaterThanOrEqual(3)

    const teamRows = page.getByTestId('team-row')
    expect(await teamRows.count()).toBeGreaterThanOrEqual(5)

    await expect(page.getByTestId('overdue-list')).toBeVisible()
    await expect(page.getByTestId('overdue-item').first()).toBeVisible()

    await page.getByTestId('range-select').selectOption('7')
    await expect(page.getByTestId('kpi-total')).toBeVisible()
    await expect(page.getByTestId('team-row').first()).toBeVisible()
  })

  test('руководитель может принять задачу на проверке с доски', async ({ page }) => {
    await loginAs(page, 'manager')
    const reviewCard = page.getByTestId('column-review').getByTestId('task-card').first()
    await reviewCard.click()
    await expect(page.getByTestId('task-status')).toHaveText('На проверке')
    await expect(page.getByTestId('action-approve')).toBeVisible()
    await expect(page.getByTestId('action-revision')).toBeVisible()
    await expect(page.getByTestId('action-take')).toHaveCount(0)
  })

  test('айди задачи: прямой переход на форму создания для креативщика закрыт', async ({ page }) => {
    await loginAs(page, 'creative')
    await page.goto('/tasks/new')
    await expect(page.getByTestId('forbidden-page')).toBeVisible()
    await expect(page.getByText('Недостаточно прав')).toBeVisible()
  })

  test('неавторизованный пользователь перенаправляется на логин', async ({ page }) => {
    await page.goto('/board')
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/analytics')
    await expect(page).toHaveURL(/\/login/)
  })
})