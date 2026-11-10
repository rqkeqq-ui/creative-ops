import { expect, test, type Page } from '@playwright/test'
import { deadlineLocal, loginAs, logout } from './helpers'

/**
 * Взаимодействие «как пользователь»: двойные клики, Enter, обновление страницы,
 * история браузера, подделанная cookie и неверные HTTP-методы.
 */

async function fillTaskForm(page: Page, offer: string) {
  await page.getByTestId('offer').fill(offer)
  await page.getByTestId('geo').fill('DE')
  await page.getByTestId('creative-type').selectOption('static')
  await page.getByTestId('quantity').fill('1')
  await page.getByTestId('description').fill('INTERACTION: проверка нестандартного поведения интерфейса.')
  await page.getByTestId('priority').selectOption('normal')
  await page.getByTestId('deadline').fill(deadlineLocal(48))
}

/** Два синхронных submit — имитация двойного клика/двойного Enter до ре-рендера. */
async function doubleSubmit(page: Page, testId: string) {
  await page.getByTestId(testId).evaluate((element) => {
    const form = (element as HTMLElement).closest('form') as HTMLFormElement
    form.requestSubmit()
    form.requestSubmit()
  })
}

async function taskIdFrom(page: Page): Promise<string> {
  return new URL(page.url()).pathname.split('/').pop()!
}

test.describe('Двойные клики не дублируют данные', () => {
  test('двойной submit формы ТЗ создаёт ровно одну задачу', async ({ page }) => {
    const offer = `DOUBLE TASK ${Date.now()}`
    await loginAs(page, 'buyer')
    await page.getByTestId('nav-new-task').click()
    await fillTaskForm(page, offer)

    await doubleSubmit(page, 'submit-task')
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/)

    await page.waitForTimeout(800)
    const response = await page.request.get(`/api/tasks?q=${encodeURIComponent(offer)}`)
    expect(response.status()).toBe(200)
    const body = (await response.json()) as { tasks: Array<{ id: string }> }
    expect(body.tasks).toHaveLength(1)
  })

  test('двойной submit AI-расходов записывает кредиты один раз', async ({ page }) => {
    const offer = `DOUBLE AI ${Date.now()}`
    await loginAs(page, 'buyer')
    await page.getByTestId('nav-new-task').click()
    await fillTaskForm(page, offer)
    await page.getByTestId('submit-task').click()
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/)
    const url = page.url()
    await logout(page)

    await loginAs(page, 'creative')
    await page.goto(url)
    await page.getByTestId('action-take').click()
    await expect(page.getByTestId('ai-submit')).toBeVisible()

    await page.getByTestId('ai-credits').fill('10')
    await page.getByTestId('ai-note').fill('DOUBLE: должен быть один расход')
    await doubleSubmit(page, 'ai-submit')

    await expect(page.getByTestId('ai-usage-row')).toHaveCount(1)
    await expect(page.getByTestId('ai-total')).toContainText('10')
    await expect(page.getByTestId('ai-total')).not.toContainText('20')
  })

  test('двойной клик «Взять в работу» оставляет одно действие в истории', async ({ page }) => {
    const offer = `DOUBLE TAKE ${Date.now()}`
    await loginAs(page, 'buyer')
    await page.getByTestId('nav-new-task').click()
    await fillTaskForm(page, offer)
    await page.getByTestId('submit-task').click()
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/)
    const url = page.url()
    await logout(page)

    await loginAs(page, 'creative')
    await page.goto(url)
    const button = page.getByTestId('action-take')
    await button.evaluate((element) => {
      ;(element as HTMLElement).click()
      ;(element as HTMLElement).click()
    })
    await expect(page.getByTestId('task-status')).toHaveText('В работе')

    await page.reload()
    const takes = page.getByTestId('activity-item').filter({ hasText: 'Взята в работу' })
    await expect(takes).toHaveCount(1)

    const id = new URL(url).pathname.split('/').pop()!
    const api = await page.request.get(`/api/tasks/${id}`)
    const body = (await api.json()) as { task: { activity: Array<{ type: string }> } }
    expect(body.task.activity.filter((entry) => entry.type === 'taken')).toHaveLength(1)
  })
})

test.describe('Клавиатура, история и обновление', () => {
  test('вход по Enter в поле пароля отправляет форму', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email').fill('buyer@creativeops.demo')
    await page.getByTestId('login-password').fill('demo1234')
    await page.getByTestId('login-password').press('Enter')
    await expect(page).toHaveURL(/\/board/)
    await expect(page.getByTestId('kanban')).toBeVisible()
  })

  test('обновление карточки сохраняет статус и не дублирует историю', async ({ page }) => {
    const offer = `REFRESH ${Date.now()}`
    await loginAs(page, 'buyer')
    await page.getByTestId('nav-new-task').click()
    await fillTaskForm(page, offer)
    await page.getByTestId('submit-task').click()
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/)
    const url = page.url()

    const before = await page.getByTestId('activity-item').count()
    await page.reload()
    await page.reload()
    await expect(page.getByTestId('task-status')).toHaveText('Новая')
    await expect(page.getByTestId('activity-item')).toHaveCount(before)
  })

  test('кнопка «назад» возвращает на доску, «вперёд» — в карточку', async ({ page }) => {
    await loginAs(page, 'buyer')
    await page.getByTestId('task-card').first().click()
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/)
    const taskUrl = page.url()

    await page.goBack()
    await expect(page).toHaveURL(/\/board/)
    await expect(page.getByTestId('kanban')).toBeVisible()

    await page.goForward()
    await expect(page).toHaveURL(taskUrl)
    await expect(page.getByTestId('task-status')).toBeVisible()
  })

  test('быстрый ввод и очистка поиска не ломают доску', async ({ page }) => {
    await loginAs(page, 'buyer')
    const search = page.getByTestId('board-search')
    for (const value of ['a', 'ab', '<script>', '', 'Sports']) {
      await search.fill(value)
    }
    await expect(page.getByTestId('kanban')).toBeVisible()
    await search.fill('')
    await expect(page.getByTestId('task-card').first()).toBeVisible()
  })
})

test.describe('Нестандартные запросы из браузера', () => {
  test('неверные HTTP-методы отклоняются 405, а не 500', async ({ page }) => {
    await loginAs(page, 'buyer')
    const id = await page.request.get('/api/tasks').then(async (r) => ((await r.json()) as { tasks: Array<{ id: string }> }).tasks[0].id)

    const responses = [
      await page.request.put('/api/tasks'),
      await page.request.delete(`/api/tasks/${id}`),
      await page.request.patch(`/api/tasks/${id}/actions`, { data: { action: 'take' } }),
    ]
    for (const response of responses) {
      expect([404, 405]).toContain(response.status())
      expect(response.status()).toBeLessThan(500)
    }
  })

  test('подделанная cookie сессии перенаправляет на логин', async ({ page, context }) => {
    await context.clearCookies()
    await context.addCookies([{ name: 'co_session', value: 'deadbeefdeadbeef', domain: '127.0.0.1', path: '/' }])
    await page.goto('/board')
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/api/tasks')
    await expect(page.locator('body')).toContainText('UNAUTHORIZED')
  })

  test('Unicode и emoji сохраняются без искажений', async ({ page }) => {
    const offer = `ЮНИКОД 🚀 ünïcode ${Date.now()}`
    await loginAs(page, 'buyer')
    await page.getByTestId('nav-new-task').click()
    await fillTaskForm(page, offer)
    await page.getByTestId('submit-task').click()
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/)
    await expect(page.locator('body')).toContainText('ЮНИКОД 🚀 ünïcode')

    await page.reload()
    await expect(page.locator('body')).toContainText('ЮНИКОД 🚀 ünïcode')
  })
})