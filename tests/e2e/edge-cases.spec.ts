import { expect, test, type Page } from '@playwright/test'
import { deadlineLocal, loginAs, logout } from './helpers'

/**
 * Дополнительный контур: нестандартные действия пользователя.
 * Здесь проверяются не только «счастливые» сценарии, но и ошибки ввода,
 * обход UI через API, повторные действия, XSS и границы RBAC.
 */

async function fillTaskForm(
  page: Page,
  options: { offer: string; description?: string; deadline?: string; references?: string; quantity?: string },
) {
  await page.getByTestId('offer').fill(options.offer)
  await page.getByTestId('geo').fill('DE, AT')
  await page.getByTestId('creative-type').selectOption('ugc_video')
  await page.getByTestId('quantity').fill(options.quantity ?? '2')
  await page
    .getByTestId('description')
    .fill(options.description ?? 'EDGE: проверка нестандартного сценария формы создания задачи.')
  await page.getByTestId('references').fill(options.references ?? '')
  await page.getByTestId('priority').selectOption('high')
  await page.getByTestId('deadline').fill(options.deadline ?? deadlineLocal(48))
}

async function createTask(
  page: Page,
  offer: string,
  options: { description?: string; deadline?: string; references?: string } = {},
): Promise<string> {
  await page.getByTestId('nav-new-task').click()
  await expect(page).toHaveURL(/\/tasks\/new/)
  await fillTaskForm(page, { offer, ...options })
  await page.getByTestId('submit-task').click()
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/)
  await expect(page.getByTestId('task-status')).toHaveText('Новая')
  return page.url()
}

function taskId(url: string): string {
  return new URL(url).pathname.split('/').pop()!
}

async function takeTask(page: Page, url: string) {
  await page.goto(url)
  await page.getByTestId('action-take').click()
  await expect(page.getByTestId('task-status')).toHaveText('В работе')
}

async function submitTask(page: Page, url: string, deliverableUrl = 'https://example.com/edge-result') {
  await page.getByTestId('deliverable-url').fill(deliverableUrl)
  await page.getByTestId('deliverable-note').fill('EDGE: результат проверки')
  await page.getByTestId('action-submit').click()
  await expect(page.getByTestId('task-status')).toHaveText('На проверке')
}

test.describe('Вход и доступ', () => {
  test('неверный пароль и пустые поля не пускают в систему', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email').fill('buyer@creativeops.demo')
    await page.getByTestId('login-password').fill('wrong-password')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('login-error')).toContainText('Неверный email или пароль')
    await expect(page).toHaveURL(/\/login/)

    await page.getByTestId('login-email').fill('')
    await page.getByTestId('login-password').fill('')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('login-error')).toContainText('Проверьте заполнение полей')
    await expect(page).toHaveURL(/\/login/)
  })

  test('авторизованный пользователь не видит логин, а после выхода снова получает защиту', async ({ page }) => {
    await loginAs(page, 'buyer')
    await page.goto('/login')
    await expect(page).toHaveURL(/\/board/)

    await logout(page)
    await page.goto('/board')
    await expect(page).toHaveURL(/\/login/)
  })

  test('защищённые страницы и чужие роли: редирект и forbidden', async ({ page }) => {
    for (const path of ['/board', '/tasks/new', '/analytics', '/tasks/00000000-0000-0000-0000-000000000000']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    }

    await loginAs(page, 'buyer')
    await page.goto('/analytics')
    await expect(page.getByText('Доступ только для руководителя')).toBeVisible()
    await expect(page.getByTestId('nav-analytics')).toHaveCount(0)

    await logout(page)
    await loginAs(page, 'manager')
    await page.goto('/tasks/new')
    await expect(page.getByTestId('forbidden-page')).toBeVisible()
    await expect(page.getByText('Недостаточно прав')).toBeVisible()
    await expect(page.getByTestId('nav-new-task')).toHaveCount(0)

    await logout(page)
    await loginAs(page, 'creative')
    await page.goto('/tasks/new')
    await expect(page.getByTestId('forbidden-page')).toBeVisible()
    await page.goto('/analytics')
    await expect(page.getByText('Доступ только для руководителя')).toBeVisible()
  })
})

test.describe('Kanban: фильтры, поиск и навигация', () => {
  test('специальные символы и HTML в поиске не ломают доску', async ({ page }) => {
    const dialogs: string[] = []
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message())
      await dialog.dismiss()
    })

    await loginAs(page, 'buyer')
    const search = page.getByTestId('board-search')

    for (const query of ['%', '_', "' OR 1=1 --", '<script>alert(1)</script>', '<img src=x onerror=alert(1)>']) {
      await search.fill(query)
      await expect(page.getByTestId('kanban')).toBeVisible()
      await expect(page.getByTestId('task-card')).toHaveCount(0)
      await expect(page.getByTestId('column-new')).toBeVisible()
    }

    expect(dialogs).toEqual([])
    await search.fill('')
    expect(await page.getByTestId('task-card').count()).toBeGreaterThanOrEqual(16)
  })

  test('комбинированные фильтры и сброс возвращают полную доску', async ({ page }) => {
    await loginAs(page, 'buyer')

    await page.getByTestId('filter-priority').selectOption('urgent')
    await page.getByTestId('filter-status-overdue').click()

    const cards = page.getByTestId('task-card')
    expect(await cards.count()).toBeGreaterThan(0)
    for (const card of await cards.all()) {
      await expect(card).toContainText('Срочный')
      await expect(card).toContainText('просрочено')
    }

    await page.getByRole('button', { name: 'Сбросить' }).click()
    await expect(page.getByTestId('filter-priority')).toHaveValue('all')
    expect(await cards.count()).toBeGreaterThanOrEqual(16)
  })

  test('фильтр «без исполнителя», переход в карточку и назад', async ({ page }) => {
    await loginAs(page, 'buyer')

    await page.getByTestId('filter-assignee').selectOption('unassigned')
    const cards = page.getByTestId('task-card')
    expect(await cards.count()).toBeGreaterThan(0)
    for (const card of await cards.all()) {
      await expect(card).toContainText('Свободна')
    }

    await page.getByRole('button', { name: 'Сбросить' }).click()
    await page.getByTestId('board-search').fill('Crypto Casino')
    await expect(page.getByTestId('task-card')).toHaveCount(1)
    await page.getByTestId('task-card').click()
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/)

    await page.getByTestId('task-code').locator('xpath=preceding-sibling::a[1]').click()
    await expect(page).toHaveURL(/\/board/)

    await page.goBack()
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/)
    await page.goForward()
    await expect(page).toHaveURL(/\/board/)
  })

  test('несуществующая задача отдаёт 404, а не 500', async ({ page }) => {
    await loginAs(page, 'buyer')
    const response = await page.goto('/tasks/00000000-0000-0000-0000-000000000000')
    expect(response?.status()).toBe(404)
  })
})

test.describe('Создание ТЗ: границы и экранирование', () => {
  test('дедлайн в прошлом отклоняется и задача не создаётся', async ({ page }) => {
    const offer = `EDGE Past Deadline ${Date.now()}`
    await loginAs(page, 'buyer')
    await page.getByTestId('nav-new-task').click()

    await fillTaskForm(page, { offer, deadline: deadlineLocal(-2) })
    await page.getByTestId('submit-task').click()

    await expect(page.getByTestId('form-error')).toContainText('Дедлайн должен быть в будущем')
    await expect(page.getByText('Выберите дату и время позже текущего момента')).toBeVisible()
    await expect(page).toHaveURL(/\/tasks\/new/)
  })

  test('невалидные референсы (ftp и javascript) отклоняются', async ({ page }) => {
    await loginAs(page, 'buyer')
    await page.getByTestId('nav-new-task').click()

    await fillTaskForm(page, {
      offer: `EDGE Bad Refs ${Date.now()}`,
      references: 'https://example.com/ok\nftp://example.com/file\njavascript:alert(1)',
    })
    await page.getByTestId('submit-task').click()

    await expect(page.getByTestId('form-error')).toContainText('Проверьте заполнение полей')
    await expect(page.getByText('Ссылка должна быть корректным URL')).toBeVisible()
    await expect(page).toHaveURL(/\/tasks\/new/)
  })

  test('HTML и script в тексте задачи экранируются и не выполняются', async ({ page }) => {
    const dialogs: string[] = []
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message())
      await dialog.dismiss()
    })

    const offer = `<b>EDGE XSS</b> ${Date.now()}`
    await loginAs(page, 'buyer')
    await createTask(page, offer, {
      description: 'Проверка экранирования <img src=x onerror=alert(1)> и <script>alert(2)</script> в описании.',
    })

    await expect(page.locator('h1')).toContainText(offer)
    await expect(page.locator('h1 b')).toHaveCount(0)
    await expect(page.locator('img[src="x"]')).toHaveCount(0)
    await expect(page.locator('body')).toContainText('<img src=x onerror=alert(1)>')
    expect(dialogs).toEqual([])
  })

  test('кнопка «Отмена» возвращает на доску без создания задачи', async ({ page }) => {
    await loginAs(page, 'buyer')
    await page.getByTestId('nav-new-task').click()
    await page.getByRole('link', { name: 'Отмена' }).click()
    await expect(page).toHaveURL(/\/board/)
  })
})

test.describe('Действия: ошибки ввода и повторные действия', () => {
  test('сдача без ссылки и со ссылкой javascript: отклоняется, статус не меняется', async ({ page }) => {
    const offer = `EDGE Submit ${Date.now()}`
    await loginAs(page, 'buyer')
    const url = await createTask(page, offer)
    await logout(page)

    await loginAs(page, 'creative')
    await takeTask(page, url)

    await page.getByTestId('action-submit').click()
    await expect(page.getByTestId('action-error')).toContainText('Нужна корректная ссылка на результат')
    await expect(page.getByTestId('task-status')).toHaveText('В работе')

    await page.getByTestId('deliverable-url').fill('javascript:alert(1)')
    await page.getByTestId('action-submit').click()
    await expect(page.getByTestId('action-error')).toContainText('Нужна корректная ссылка на результат')
    await expect(page.getByTestId('task-status')).toHaveText('В работе')

    await submitTask(page, url)
    await expect(page.getByTestId('history')).toContainText('Сдана на проверку')
  })

  test('правки с коротким комментарием отклоняются, корректный комментарий переводит в «Правки»', async ({ page }) => {
    const offer = `EDGE Revision ${Date.now()}`
    await loginAs(page, 'buyer')
    const url = await createTask(page, offer)
    await logout(page)

    await loginAs(page, 'creative')
    await takeTask(page, url)
    await submitTask(page, url)
    await logout(page)

    await loginAs(page, 'buyer')
    await page.goto(url)
    await page.getByTestId('action-revision').click()
    await expect(page.getByTestId('action-error')).toContainText('минимум 5 символов')
    await expect(page.getByTestId('task-status')).toHaveText('На проверке')

    await page.getByTestId('revision-comment').fill('1234')
    await page.getByTestId('action-revision').click()
    await expect(page.getByTestId('action-error')).toContainText('минимум 5 символов')
    await expect(page.getByTestId('task-status')).toHaveText('На проверке')

    await page.getByTestId('revision-comment').fill('Поправить субтитры и заменить фон')
    await page.getByTestId('action-revision').click()
    await expect(page.getByTestId('task-status')).toHaveText('Правки')
    await expect(page.getByTestId('revision-note')).toContainText('Поправить субтитры и заменить фон')
  })

  test('чужую задачу на правках нельзя взять ни кнопкой, ни через API', async ({ page }) => {
    await loginAs(page, 'creative')
    await page.getByTestId('board-search').fill('Sports Betting App')
    await expect(page.getByTestId('task-card')).toHaveCount(1)
    await page.getByTestId('task-card').click()

    await expect(page.getByTestId('task-status')).toHaveText('Правки')
    await expect(page.locator('body')).toContainText('Софья Лебедева')
    await expect(page.getByTestId('action-take')).toHaveCount(0)
    await expect(page.getByTestId('action-submit')).toHaveCount(0)
    await expect(page.getByText('Сейчас действий для вашей роли нет')).toBeVisible()

    const id = taskId(page.url())
    const denied = await page.request.post(`/api/tasks/${id}/actions`, { data: { action: 'take' } })
    expect(denied.status()).toBe(409)
    expect((await denied.json()).error.code).toBe('ASSIGNED_TO_OTHER')
  })

  test('завершённая задача: действий нет, повторная приёмка и AI-расходы отклоняются', async ({ page }) => {
    const offer = `EDGE Done ${Date.now()}`
    await loginAs(page, 'buyer')
    const url = await createTask(page, offer)
    await logout(page)

    await loginAs(page, 'creative')
    await takeTask(page, url)
    await submitTask(page, url)
    await logout(page)

    await loginAs(page, 'buyer')
    await page.goto(url)
    await page.getByTestId('action-approve').click()
    await expect(page.getByTestId('task-status')).toHaveText('Готово')
    await expect(page.getByTestId('duration-value')).not.toHaveText('—')

    const activityBefore = await page.getByTestId('activity-item').count()
    const repeat = await page.request.post(`/api/tasks/${taskId(url)}/actions`, { data: { action: 'approve' } })
    expect(repeat.status()).toBe(409)
    await page.reload()
    await expect(page.getByTestId('activity-item')).toHaveCount(activityBefore)
    await expect(page.getByTestId('action-approve')).toHaveCount(0)
    await expect(page.getByTestId('action-revision')).toHaveCount(0)

    await logout(page)
    await loginAs(page, 'creative')
    await page.goto(url)
    await expect(page.getByTestId('ai-submit')).toHaveCount(0)
    const aiDenied = await page.request.post(`/api/tasks/${taskId(url)}/ai-usage`, {
      data: { service: 'Midjourney', credits: 1 },
    })
    expect(aiDenied.status()).toBe(409)
  })

  test('AI-расходы: форма появляется после взятия, 0 отклоняется, корректные кредиты сохраняются', async ({ page }) => {
    const offer = `EDGE AI ${Date.now()}`
    await loginAs(page, 'buyer')
    const url = await createTask(page, offer)
    await logout(page)

    await loginAs(page, 'creative')
    await page.goto(url)
    await expect(page.getByTestId('ai-submit')).toHaveCount(0)

    await page.getByTestId('action-take').click()
    await expect(page.getByTestId('ai-submit')).toBeVisible()

    // Обходим нативную HTML-валидацию, чтобы проверить серверную проверку нуля.
    await page.getByTestId('ai-credits').evaluate((element) => {
      const form = (element as HTMLElement).closest('form') as HTMLFormElement
      form.noValidate = true
    })
    await page.getByTestId('ai-credits').fill('0')
    await page.getByTestId('ai-submit').click()
    await expect(page.getByText('Кредиты должны быть больше нуля')).toBeVisible()

    await page.getByTestId('ai-credits').fill('7.5')
    await page.getByTestId('ai-note').fill('EDGE: проверка кредитов')
    await page.getByTestId('ai-submit').click()
    await expect(page.getByTestId('ai-total')).toContainText('7.5')
    await expect(page.getByTestId('ai-usage-row')).toHaveCount(1)
  })

  test('RBAC через API: байер не берёт, креативщик не принимает, неизвестное действие — 422', async ({ page }) => {
    await loginAs(page, 'buyer')
    const created = await page.request.post('/api/tasks', {
      data: {
        offer: `EDGE API RBAC ${Date.now()}`,
        geo: 'DE',
        creativeType: 'static',
        quantity: 1,
        description: 'EDGE: задача для проверки RBAC через API.',
        references: [],
        priority: 'normal',
        deadline: new Date(Date.now() + 86_400_000).toISOString(),
      },
    })
    expect(created.status()).toBe(201)
    const id = (await created.json()).task.id

    const buyerTake = await page.request.post(`/api/tasks/${id}/actions`, { data: { action: 'take' } })
    expect(buyerTake.status()).toBe(403)
    const unknown = await page.request.post(`/api/tasks/${id}/actions`, { data: { action: 'hack' } })
    expect(unknown.status()).toBe(422)

    await logout(page)
    await loginAs(page, 'creative')
    const take = await page.request.post(`/api/tasks/${id}/actions`, { data: { action: 'take' } })
    expect(take.status()).toBe(200)
    const approveAsCreative = await page.request.post(`/api/tasks/${id}/actions`, { data: { action: 'approve' } })
    expect(approveAsCreative.status()).toBe(403)
    const submitWithoutUrl = await page.request.post(`/api/tasks/${id}/actions`, { data: { action: 'submit' } })
    expect(submitWithoutUrl.status()).toBe(422)
    const submitted = await page.request.post(`/api/tasks/${id}/actions`, {
      data: { action: 'submit', deliverableUrl: 'https://example.com/api-rbac' },
    })
    expect(submitted.status()).toBe(200)

    await logout(page)
    await loginAs(page, 'buyer')
    const shortRevision = await page.request.post(`/api/tasks/${id}/actions`, {
      data: { action: 'request_revision', comment: '123' },
    })
    expect(shortRevision.status()).toBe(422)
    const revision = await page.request.post(`/api/tasks/${id}/actions`, {
      data: { action: 'request_revision', comment: 'Поправить текст и кнопку' },
    })
    expect(revision.status()).toBe(200)
  })
})

test.describe('Аналитика: периоды и устойчивость', () => {
  test('переключение 7/30/90/всё время не ломает KPI и не показывает NaN', async ({ page }) => {
    await loginAs(page, 'manager')
    await page.goto('/analytics')

    for (const [value, urlPattern] of [
      ['7', /range=7/],
      ['30', /\/analytics$/],
      ['90', /range=90/],
      ['all', /range=all/],
    ] as const) {
      await page.getByTestId('range-select').selectOption(value)
      await expect(page).toHaveURL(urlPattern)
      await expect(page.getByTestId('kpi-total')).toHaveText(/^\d+$/)
      const body = await page.locator('body').innerText()
      expect(body).not.toContain('NaN')
      expect(body).not.toContain('undefined')
      expect(body).not.toContain('Infinity')
    }

    await page.goto('/analytics?range=not-a-number')
    await expect(page.getByTestId('kpi-total')).toHaveText(/^\d+$/)
    const body = await page.locator('body').innerText()
    expect(body).not.toContain('NaN')
  })
})