/**
 * Снимает скриншоты ключевых экранов для документации.
 * Требует запущенный сервер: `npm run start` (или `npm run build && npm run start`).
 * Запуск: `node scripts/screenshots.mjs [baseURL]`
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const baseURL = process.argv[2] ?? 'http://127.0.0.1:3000'
const outDir = resolve('docs/screenshots')
mkdirSync(outDir, { recursive: true })

const viewport = { width: 1600, height: 1000 }

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'ru-RU' })
const page = await context.newPage()

async function login(role) {
  // Сбрасываем прошлую сессию, иначе /login редиректит на /board.
  await context.clearCookies()
  await page.goto(`${baseURL}/login`)
  await page.getByTestId(`demo-${role}`).click()
  await page.waitForURL(/\/board/)
  await page.waitForSelector('[data-testid="kanban"]')
}

async function shot(name) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(outDir, `${name}.png`) })
  console.log(`saved ${name}.png`)
}

// 1. Экран входа
await page.goto(`${baseURL}/login`)
await page.waitForSelector('[data-testid="login-submit"]')
await shot('01-login')

// 2. Kanban — руководитель
await login('manager')
await shot('02-kanban-manager')

// 3. Карточка задачи: действия, время, AI-расходы, история
const card = page.getByTestId('task-card').first()
await card.click()
await page.waitForURL(/\/tasks\/[0-9a-f-]{36}/)
await page.waitForSelector('[data-testid="task-status"]')
await shot('03-task-detail')

// 4. Аналитика руководителя
await page.goto(`${baseURL}/analytics`)
await page.waitForSelector('[data-testid="analytics"]').catch(() => {})
await shot('04-analytics')

// 5. Форма создания ТЗ — байер
await login('buyer')
await page.goto(`${baseURL}/tasks/new`)
await page.waitForSelector('[data-testid="submit-task"]')
await shot('05-new-task')

// 6. Kanban — креативщик (вид с действиями)
await login('creative')
await shot('06-kanban-creative')

await browser.close()
console.log(`\nГотово. Файлы в ${outDir}`)
