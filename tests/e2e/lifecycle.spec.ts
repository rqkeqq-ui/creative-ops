import { expect, test, type Page } from '@playwright/test'
import { deadlineLocal, loginAs, logout } from './helpers'

async function createTask(page: Page, offer: string): Promise<string> {
  await page.getByTestId('nav-new-task').click()
  await expect(page).toHaveURL(/\/tasks\/new/)
  await page.getByTestId('offer').fill(offer)
  await page.getByTestId('geo').fill('DE, AT')
  await page.getByTestId('creative-type').selectOption('ugc_video')
  await page.getByTestId('quantity').fill('3')
  await page
    .getByTestId('description')
    .fill('E2E: три вертикальных UGC-видео с озвучкой. Проверка сквозного сценария сервиса.')
  await page.getByTestId('references').fill('https://example.com/ref-1')
  await page.getByTestId('priority').selectOption('high')
  await page.getByTestId('deadline').fill(deadlineLocal(48))
  await page.getByTestId('submit-task').click()
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/)
  return page.url()
}

test('сквозной сценарий: создание → взятие → сдача → правки → повторная сдача → приёмка', async ({ page }) => {
  const offer = `E2E Wallet Offer ${Date.now()}`

  await loginAs(page, 'buyer')
  const taskUrl = await createTask(page, offer)

  await expect(page.getByTestId('task-status')).toHaveText('Новая')
  await expect(page.getByTestId('task-code')).toContainText('CR-')
  await expect(page.getByTestId('history')).toContainText('Задача создана')
  await expect(page.getByTestId('action-take')).toHaveCount(0)
  await logout(page)

  await loginAs(page, 'creative')
  await page.goto(taskUrl)
  await expect(page.getByTestId('task-status')).toHaveText('Новая')
  await page.getByTestId('action-take').click()
  await expect(page.getByTestId('task-status')).toHaveText('В работе')

  await page.getByTestId('deliverable-url').fill('https://drive.google.com/e2e-result-v1')
  await page.getByTestId('deliverable-note').fill('Первая версия, 3 видео в папке')
  await page.getByTestId('action-submit').click()
  await expect(page.getByTestId('task-status')).toHaveText('На проверке')
  await expect(page.getByTestId('history')).toContainText('Сдана на проверку')
  await logout(page)

  await loginAs(page, 'buyer')
  await page.goto(taskUrl)
  await page.getByTestId('revision-comment').fill('Заменить первые 2 секунды и добавить субтитры')
  await page.getByTestId('action-revision').click()
  await expect(page.getByTestId('task-status')).toHaveText('Правки')
  await expect(page.getByTestId('revision-note')).toContainText('Заменить первые 2 секунды')
  await logout(page)

  await loginAs(page, 'creative')
  await page.goto(taskUrl)
  await page.getByTestId('action-take').click()
  await expect(page.getByTestId('task-status')).toHaveText('В работе')
  await page.getByTestId('deliverable-url').fill('https://drive.google.com/e2e-result-v2')
  await page.getByTestId('action-submit').click()
  await expect(page.getByTestId('task-status')).toHaveText('На проверке')
  await logout(page)

  await loginAs(page, 'buyer')
  await page.goto(taskUrl)
  await page.getByTestId('action-approve').click()
  await expect(page.getByTestId('task-status')).toHaveText('Готово')
  await expect(page.getByTestId('history')).toContainText('Принята')
  await expect(page.getByTestId('duration-value')).not.toHaveText('—')
  await expect(page.getByTestId('activity-item')).toHaveCount(7)

  // Завершённую задачу нельзя взять повторно.
  await logout(page)
  await loginAs(page, 'creative')
  await page.goto(taskUrl)
  await expect(page.getByTestId('action-take')).toHaveCount(0)
})

test('валидация формы ТЗ показывает ошибки и не создаёт задачу', async ({ page }) => {
  await loginAs(page, 'buyer')
  await page.getByTestId('nav-new-task').click()
  await page.getByTestId('submit-task').click()
  await expect(page.getByTestId('form-error')).toBeVisible()
  await expect(page).toHaveURL(/\/tasks\/new/)

  await page.getByTestId('offer').fill('Только оффер без остальных полей')
  await page.getByTestId('submit-task').click()
  await expect(page.getByTestId('form-error')).toBeVisible()
})

test('AI-расходы: креативщик добавляет кредиты, они видны в карточке', async ({ page }) => {
  const offer = `E2E AI Spend ${Date.now()}`
  await loginAs(page, 'buyer')
  const taskUrl = await createTask(page, offer)
  await logout(page)

  await loginAs(page, 'creative')
  await page.goto(taskUrl)
  await page.getByTestId('action-take').click()

  await page.getByTestId('ai-service').selectOption('Midjourney')
  await page.getByTestId('ai-credits').fill('12.5')
  await page.getByTestId('ai-note').fill('32 варианта визуала')
  await page.getByTestId('ai-submit').click()
  await expect(page.getByTestId('ai-total')).toContainText('12.5')
  await expect(page.getByTestId('ai-usage-row')).toHaveCount(1)

  // Байер не видит форму добавления расходов.
  await logout(page)
  await loginAs(page, 'buyer')
  await page.goto(taskUrl)
  await expect(page.getByTestId('ai-submit')).toHaveCount(0)
  await expect(page.getByTestId('ai-total')).toContainText('12.5')
})