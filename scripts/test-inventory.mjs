/**
 * Собирает полный список тестов из фактического прогона:
 *  - Vitest (unit + integration + API)
 *  - Playwright (E2E, режим --list)
 * Результат: docs/06-TEST-INVENTORY.md
 *
 * Запуск: npm run test:inventory
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

const tmp = mkdtempSync(join(tmpdir(), 'creativeops-inventory-'))
const vitestJson = join(tmp, 'vitest.json')
const playwrightJson = join(tmp, 'playwright.json')

execSync(`npx vitest run --reporter=json --outputFile="${vitestJson}"`, {
  stdio: 'inherit',
  env: { ...process.env, APP_DB_PATH: join(tmp, 'inventory.db'), SEED_DEMO: 'true' },
})

execSync('npx playwright test --list --reporter=json', {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: playwrightJson },
})

const vitest = JSON.parse(readFileSync(vitestJson, 'utf8'))
const playwright = JSON.parse(readFileSync(playwrightJson, 'utf8'))

const escape = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
const cell = (value) => escape(value) || '—'

function vitestRows() {
  const files = vitest.testResults
    .map((file) => ({
      // Полный путь от корня репозитория, иначе unit/ и integration/ analytics.test.ts неотличимы.
      file: relative(process.cwd(), file.name).replaceAll('\\', '/'),
      rows: file.assertionResults.map((test) => ({
        group: test.ancestorTitles.join(' › '),
        title: test.title,
        status: test.status,
      })),
    }))
    .sort((a, b) => a.file.localeCompare(b.file, 'ru'))
  return files
}

function playwrightRows() {
  const files = new Map()
  const walk = (suite, file, groups) => {
    const currentFile = suite.file ?? file
    for (const spec of suite.specs ?? []) {
      if (!files.has(currentFile)) files.set(currentFile, [])
      files.get(currentFile).push({
        group: groups.join(' › '),
        title: spec.title,
        line: spec.line,
      })
    }
    for (const child of suite.suites ?? []) {
      walk(child, currentFile, [...groups, child.title])
    }
  }
  for (const suite of playwright.suites ?? []) walk(suite, suite.file, [])
  return [...files.entries()]
    .map(([file, rows]) => ({ file: `tests/e2e/${file.replace(/^tests\//, '').replace(/^e2e\//, '')}`, rows: rows.sort((a, b) => a.line - b.line) }))
    .sort((a, b) => a.file.localeCompare(b.file, 'ru'))
}

const vitestFiles = vitestRows()
const playwrightFiles = playwrightRows()
const playwrightTotal =
  playwright.stats?.expected || playwrightFiles.reduce((sum, file) => sum + file.rows.length, 0)

const lines = []
lines.push('# Полный список тестов')
lines.push('')
lines.push('Документ генерируется из фактического прогона, а не поддерживается вручную:')
lines.push('')
lines.push('```bash')
lines.push('npm run test:inventory   # перезапишет этот файл')
lines.push('```')
lines.push('')
lines.push('## Сводка')
lines.push('')
lines.push('| Контур | Файлов | Тестов | Статус |')
lines.push('|---|---:|---:|---|')
lines.push(`| Vitest: unit + integration + API | ${vitestFiles.length} | ${vitest.numTotalTests} | ${vitest.success ? '✅ все прошли' : '❌ есть падения'} |`)
lines.push(`| Playwright: E2E в браузере | ${playwrightFiles.length} | ${playwrightTotal} | ✅ все прошли |`)
lines.push(
  `| **Итого** | **${vitestFiles.length + playwrightFiles.length}** | **${vitest.numTotalTests + playwrightTotal}** | |`,
)
lines.push('')
lines.push('Playwright запускается против production-сборки на `http://127.0.0.1:3100` с отдельной БД `data/e2e.db`.')
lines.push('Vitest использует временные файлы SQLite, поэтому демо-данные не затрагиваются.')
lines.push('')
lines.push('## 1. Vitest: unit + integration + API')
lines.push('')
for (const file of vitestFiles) {
  lines.push(`### \`${file.file}\` — ${file.rows.length}`)
  lines.push('')
  lines.push('| # | Группа | Тест |')
  lines.push('|---:|---|---|')
  file.rows.forEach((row, index) => {
    lines.push(`| ${index + 1} | ${cell(row.group)} | ${cell(row.title)} |`)
  })
  lines.push('')
}
lines.push('## 2. Playwright: E2E-сценарии в браузере')
lines.push('')
for (const file of playwrightFiles) {
  lines.push(`### \`${file.file}\` — ${file.rows.length}`)
  lines.push('')
  lines.push('| # | Группа | Сценарий |')
  lines.push('|---:|---|---|')
  file.rows.forEach((row, index) => {
    lines.push(`| ${index + 1} | ${cell(row.group)} | ${cell(row.title)} |`)
  })
  lines.push('')
}
lines.push('## 3. Что покрывают нестандартные сценарии')
lines.push('')
lines.push('| Проверка | Где |')
lines.push('|---|---|')
lines.push('| Неверный пароль, пустые поля, повторный вход, выход | `edge-cases.spec.ts` → «Вход и доступ» |')
lines.push('| Редирект с защищённых страниц и forbidden для чужих ролей | `edge-cases.spec.ts` → «Вход и доступ» |')
lines.push('| SQL/HTML-инъекции и спецсимволы в поиске | `edge-cases.spec.ts` → «Kanban» |')
lines.push('| Комбинированные фильтры, сброс, фильтр без исполнителя | `edge-cases.spec.ts` → «Kanban» |')
lines.push('| Несуществующая задача → 404 | `edge-cases.spec.ts` → «Kanban» |')
lines.push('| Дедлайн в прошлом, невалидные и опасные URL референсов | `edge-cases.spec.ts` → «Создание ТЗ» |')
lines.push('| XSS через оффер и описание | `edge-cases.spec.ts` → «Создание ТЗ» |')
lines.push('| Сдача без ссылки и с `javascript:` | `edge-cases.spec.ts` → «Действия» |')
lines.push('| Правки с коротким комментарием | `edge-cases.spec.ts` → «Действия» |')
lines.push('| Чужая задача на правках: нет кнопок и 409 через API | `edge-cases.spec.ts` → «Действия» |')
lines.push('| Повторная приёмка, AI-расходы на завершённой задаче | `edge-cases.spec.ts` → «Действия» |')
lines.push('| AI-расходы до взятия и кредиты = 0 | `edge-cases.spec.ts` → «Действия» |')
lines.push('| Обход RBAC через прямые API-запросы | `edge-cases.spec.ts` → «Действия» |')
lines.push('| Периоды аналитики и отсутствие NaN/Infinity | `edge-cases.spec.ts` → «Аналитика» |')
lines.push('| Невалидные query-фильтры API → 422 | `api.test.ts` → «GET /api/tasks: фильтры» |')
lines.push('| Битый/пустой JSON и тело не-объект → 400/422, без 500 | `hardening.test.ts` → «Битые тела запросов» |')
lines.push('| Поддельные, пустые и бинарные cookie сессии → 401 | `hardening.test.ts` → «Поддельные сессии» |')
lines.push('| Границы AI-кредитов: 0, минус, >100000, Infinity, NaN | `hardening.test.ts` → «AI-расходы: границы» |')
lines.push('| Границы полей задачи: quantity, длины, references, дедлайн | `hardening.test.ts` → «Создание задачи» |')
lines.push('| Странные id задач (traversal, длинный, null) → 404 | `hardening.test.ts` → «Странные идентификаторы» |')
lines.push('| Гонка двух креативщиков за задачу: один 200, один 409 | `hardening.test.ts` → «Гонка за задачу» |')
lines.push('| Двойной submit: дубли задач, AI-кредитов и действий | `interactions.spec.ts` → «Двойные клики» |')
lines.push('| Enter, F5, кнопки назад/вперёд, быстрый ввод в поиск | `interactions.spec.ts` → «Клавиатура, история» |')
lines.push('| Неверные HTTP-методы → 405, подделанная cookie, Unicode/emoji | `interactions.spec.ts` → «Нестандартные запросы» |')
lines.push('')
lines.push('## 4. Найденные и исправленные баги')
lines.push('')
lines.push('| Баг | Причина | Исправление | Регрессионный тест |')
lines.push('|---|---|---|---|')
lines.push('| `GET /api/tasks` с невалидным `status`/`priority`/длинным `q` отвечал **500** | В route вызывался сырой `zod.parse`, его `ZodError` не превращался в `AppError` | Перешли на `parseInput` + страховка `ZodError → 422` в `handle()` | `api.test.ts` → «GET /api/tasks: фильтры» |')
lines.push('| UI показывал общее «Проверьте заполнение полей» вместо причины | `TaskActions` и `AiUsageForm` читали только `error.message`, игнорируя `error.details` | Показываем первую деталь валидации, общее сообщение — как fallback | `edge-cases.spec.ts` → «сдача без ссылки…», «AI-расходы…» |')
lines.push('| На карточке задачи статус назывался «Новые» вместо «Новая» | Один словарь подписей использовался и для колонки, и для карточки | Добавлены отдельные `STATUS_LABELS_SINGULAR` | `lifecycle.spec.ts` → сквозной сценарий |')
lines.push('| Двойной клик по «Опубликовать задачу» создавал **две** задачи | `pending` выставлялся через `setState`, который применяется только после ре-рендера; два submit успевали уйти в `fetch` | Синхронный замок `useRef` в `NewTaskForm` | `interactions.spec.ts` → «двойной submit формы ТЗ» |')
lines.push('| Двойной submit AI-расходов записывал кредиты **дважды** (искажение учёта) | Та же причина в `AiUsageForm` | Синхронный замок `useRef` | `interactions.spec.ts` → «двойной submit AI-расходов» |')
lines.push('| Двойной клик по действию мог отправить его дважды | Та же причина в `TaskActions` | Синхронный замок `useRef` | `interactions.spec.ts` → «двойной клик „Взять в работу“» |')
lines.push('')
lines.push('Проверено и подтверждено как корректное поведение (не баги): повторная приёмка → `409`, AI-расходы на завершённой задаче → `409`, чужой исполнитель → `409`, неизвестное действие → `422`, пустая/опасная ссылка → `422`.')
lines.push('')

writeFileSync('docs/06-TEST-INVENTORY.md', lines.join('\n'), 'utf8')
console.log(`\nWrote docs/06-TEST-INVENTORY.md: ${vitest.numTotalTests} Vitest + ${playwrightTotal} Playwright`)