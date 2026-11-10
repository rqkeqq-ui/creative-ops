# Полный список тестов

Документ генерируется из фактического прогона, а не поддерживается вручную:

```bash
npm run test:inventory   # перезапишет этот файл
```

## Сводка

| Контур | Файлов | Тестов | Статус |
|---|---:|---:|---|
| Vitest: unit + integration + API | 11 | 125 | ✅ все прошли |
| Playwright: E2E в браузере | 4 | 28 | ✅ все прошли |
| **Итого** | **15** | **153** | |

Playwright запускается против production-сборки на `http://127.0.0.1:3100` с отдельной БД `data/e2e.db`.
Vitest использует временные файлы SQLite, поэтому демо-данные не затрагиваются.

## 1. Vitest: unit + integration + API

### `tests/activity.test.ts` — 4

| # | Группа | Тест |
|---:|---|---|
| 1 | История действий (аудит) | пишет по записи на каждое действие, включая комментарии и сдачу результата |
| 2 | История действий (аудит) | не добавляет записей при запрещённых действиях |
| 3 | История действий (аудит) | история не удаляется и не переписывается при последующих действиях |
| 4 | История действий (аудит) | сохраняет историю доступной всем ролям через карточку задачи |

### `tests/ai-usage.test.ts` — 6

| # | Группа | Тест |
|---:|---|---|
| 1 | AI-расходы: учёт кредитов по задачам | фиксирует сервис, кредиты, автора и фазу initial до правок |
| 2 | AI-расходы: учёт кредитов по задачам | помечает расходы фазой revision после отправки на правки |
| 3 | AI-расходы: учёт кредитов по задачам | суммирует кредиты в карточке задачи и отдаёт имена исполнителей |
| 4 | AI-расходы: учёт кредитов по задачам | не принимает некорректные данные |
| 5 | AI-расходы: учёт кредитов по задачам | запрещает дописывать расходы в завершённую задачу |
| 6 | AI-расходы: учёт кредитов по задачам | запрещает добавлять расходы до взятия задачи в работу |

### `tests/analytics.test.ts` — 9

| # | Группа | Тест |
|---:|---|---|
| 1 | analytics: totals | counts tasks per kanban column |
| 2 | analytics: totals | counts unfinished and late deliveries as overdue |
| 3 | analytics: timing | averages completion time over done tasks only |
| 4 | analytics: workload | builds a row for every non-manager employee |
| 5 | analytics: workload | computes creative load, completions, credits and overdue |
| 6 | analytics: AI spend | aggregates credits by service, employee and phase |
| 7 | analytics: AI spend | mixes priorities for the breakdown chart |
| 8 | analytics: range filter | keeps only tasks created within the range (and their AI usage) |
| 9 | analytics: range filter | produces stable zero-state instead of NaN |

### `tests/analytics.test.ts` — 5

| # | Группа | Тест |
|---:|---|---|
| 1 | аналитика руководителя (интеграция с БД) | внутренне согласована: суммы разрезов совпадают с итогами |
| 2 | аналитика руководителя (интеграция с БД) | строит загрузку по каждому исполнителю с кредитами |
| 3 | аналитика руководителя (интеграция с БД) | фильтрует по периоду и не ломает итоги |
| 4 | аналитика руководителя (интеграция с БД) | считает просрочки по дате, а не по статусу |
| 5 | аналитика руководителя (интеграция с БД) | закрыта для байеров и креативщиков |

### `tests/api.test.ts` — 20

| # | Группа | Тест |
|---:|---|---|
| 1 | GET /api/health | отвечает без авторизации |
| 2 | POST /api/auth/login | валидирует тело запроса |
| 3 | POST /api/auth/login | отклоняет неверный пароль |
| 4 | POST /api/auth/login | выдаёт httpOnly-сессию при верных данных |
| 5 | сессия | GET /api/auth/me без cookie → 401 |
| 6 | сессия | GET /api/auth/me с cookie → пользователь |
| 7 | GET /api/tasks: фильтры | отклоняет неизвестный статус как 422, а не 500 |
| 8 | GET /api/tasks: фильтры | отклоняет неизвестный приоритет и слишком длинный поиск |
| 9 | GET /api/tasks: фильтры | принимает корректные фильтры и отдаёт только подходящие задачи |
| 10 | POST /api/tasks | требует авторизации |
| 11 | POST /api/tasks | запрещает создание креативщику (403) |
| 12 | POST /api/tasks | возвращает 422 с деталями по полям |
| 13 | POST /api/tasks | создаёт задачу (201) и отдаёт её в списке и в карточке |
| 14 | POST /api/tasks | отдаёт 404 на несуществующую задачу |
| 15 | POST /api/tasks | проходит сценарий действий через API с проверкой прав |
| 16 | POST /api/tasks/:id/ai-usage | разрешает исполнителю и запрещает остальным |
| 17 | GET /api/analytics | закрыта для байера и открыта руководителю |
| 18 | GET /api/analytics | требует авторизации |
| 19 | GET /api/meta | отдаёт справочники без хешей паролей |
| 20 | POST /api/auth/logout | уничтожает сессию |

### `tests/lifecycle.test.ts` — 7

| # | Группа | Тест |
|---:|---|---|
| 1 | task creation | creates a task with code, new status, empty timestamps and audit record |
| 2 | task creation | rejects invalid input and deadlines in the past |
| 3 | task creation | does not create an audit record when validation fails |
| 4 | full lifecycle | moves through take → submit → revision → take → submit → approve and freezes timings |
| 5 | full lifecycle | keeps a complete, ordered audit trail of status changes |
| 6 | task listing and filters | supports status, assignee, search, overdue and ownership filters |
| 7 | task listing and filters | returns 404 for a missing task |

### `tests/rbac.test.ts` — 10

| # | Группа | Тест |
|---:|---|---|
| 1 | RBAC: создание задач | позволяет байеру и запрещает остальным ролям |
| 2 | RBAC: работа с задачей | запрещает байеру и руководителю брать задачу в работу |
| 3 | RBAC: работа с задачей | запрещает сдавать и «перехватывать» чужую задачу |
| 4 | RBAC: работа с задачей | не даёт другому креативщику подхватить задачу на правках |
| 5 | RBAC: работа с задачей | принимает работу только владелец задачи или руководитель |
| 6 | RBAC: работа с задачей | не даёт отправлять на правки без комментария |
| 7 | RBAC: работа с задачей | требует ссылку на результат при сдаче |
| 8 | RBAC: AI-расходы | разрешает логировать кредиты только исполнителю задачи |
| 9 | RBAC: аналитика | доступна только руководителю |
| 10 | RBAC: неизвестная задача | возвращает NOT_FOUND вместо утечки данных |

### `tests/seed.test.ts` — 6

| # | Группа | Тест |
|---:|---|---|
| 1 | демо-данные | создаёт 6 пользователей со всеми тремя ролями |
| 2 | демо-данные | создаёт задачи во всех статусах Kanban, часть — с просрочкой |
| 3 | демо-данные | наполняет историю и AI-расходы |
| 4 | демо-данные | регистрирует всех демо-пользователей с паролем demo1234 |
| 5 | демо-данные | не дублирует данные при повторном сидировании |
| 6 | демо-данные | даёт руководителю осмысленную аналитику |

### `tests/time.test.ts` — 13

| # | Группа | Тест |
|---:|---|---|
| 1 | durationMs | measures completed work from the first start |
| 2 | durationMs | measures unfinished work against the provided now |
| 3 | durationMs | returns null when work has not started yet |
| 4 | durationMs | returns null for a done task without timestamps (data problem, not negative time) |
| 5 | timeToStartMs | measures time between creation and first pickup |
| 6 | timeToStartMs | is null before pickup |
| 7 | overdue rules | flags unfinished tasks past the deadline |
| 8 | overdue rules | flags finished tasks delivered after the deadline |
| 9 | overdue rules | does not flag finished work delivered on time |
| 10 | averageDurationMs | averages only completed tasks |
| 11 | averageDurationMs | returns null when nothing is completed |
| 12 | formatDuration | formats minutes, hours and days for humans |
| 13 | formatDuration | renders an em dash for unknown durations |

### `tests/validation.test.ts` — 23

| # | Группа | Тест |
|---:|---|---|
| 1 | createTaskSchema | accepts a complete valid payload and trims text |
| 2 | createTaskSchema | allows an empty references list |
| 3 | createTaskSchema | rejects missing offer |
| 4 | createTaskSchema | rejects single-char offer |
| 5 | createTaskSchema | rejects missing geo |
| 6 | createTaskSchema | rejects zero quantity |
| 7 | createTaskSchema | rejects negative quantity |
| 8 | createTaskSchema | rejects fractional quantity |
| 9 | createTaskSchema | rejects quantity above limit |
| 10 | createTaskSchema | rejects too short description |
| 11 | createTaskSchema | rejects unknown priority |
| 12 | createTaskSchema | rejects unknown creative type |
| 13 | createTaskSchema | rejects unparsable deadline |
| 14 | createTaskSchema | rejects too many references |
| 15 | createTaskSchema | rejects invalid reference url |
| 16 | createTaskSchema | reports field-level errors for the form |
| 17 | submitWorkSchema | requires a valid deliverable link |
| 18 | submitWorkSchema | trims the optional comment |
| 19 | revisionSchema | requires a substantive comment |
| 20 | aiUsageSchema | accepts known services with positive credits |
| 21 | aiUsageSchema | rejects zero/negative/excessive credits |
| 22 | aiUsageSchema | rejects unknown AI services |
| 23 | loginSchema | validates email and password length |

### `tests/workflow.test.ts` — 22

| # | Группа | Тест |
|---:|---|---|
| 1 | workflow: metadata | defines exactly the four kanban actions |
| 2 | workflow: metadata | guards unknown action names |
| 3 | workflow: take | allows a creative to take a new unassigned task |
| 4 | workflow: take | forbids buyer and manager from taking work |
| 5 | workflow: take | only allows take from new or revision |
| 6 | workflow: take | lets the assignee resume their own revision |
| 7 | workflow: take | blocks another creative from taking over someone else’s revision |
| 8 | workflow: take | allows taking an unassigned revision |
| 9 | workflow: submit | allows the assignee to submit work for review |
| 10 | workflow: submit | forbids submitting a task assigned to another creative |
| 11 | workflow: submit | forbids submitting an unassigned or not started task |
| 12 | workflow: submit | forbids buyer and manager from submitting |
| 13 | workflow: approve | lets the owning buyer accept the work |
| 14 | workflow: approve | lets the manager accept work as a supervisor |
| 15 | workflow: approve | blocks a different buyer from approving someone else’s task |
| 16 | workflow: approve | blocks creatives from approving anything |
| 17 | workflow: approve | only approves tasks sitting in review |
| 18 | workflow: request_revision | requires a meaningful comment |
| 19 | workflow: request_revision | accepts a comment and moves work back to revisions |
| 20 | workflow: request_revision | blocks non-owning users |
| 21 | workflow: request_revision | only works from review |
| 22 | workflow: allowedActions (UI hints) | lists actions available to each role |

## 2. Playwright: E2E-сценарии в браузере

### `tests/e2e/analytics.spec.ts` — 4

| # | Группа | Сценарий |
|---:|---|---|
| 1 | Аналитика руководителя | показывает KPI, загрузку, AI-расходы и просрочки |
| 2 | Аналитика руководителя | руководитель может принять задачу на проверке с доски |
| 3 | Аналитика руководителя | айди задачи: прямой переход на форму создания для креативщика закрыт |
| 4 | Аналитика руководителя | неавторизованный пользователь перенаправляется на логин |

### `tests/e2e/board.spec.ts` — 3

| # | Группа | Сценарий |
|---:|---|---|
| 1 | Kanban-доска | байер видит пять колонок и демо-задачи |
| 2 | Kanban-доска | руководитель видит аналитику, креативщик — свои действия |
| 3 | Kanban-доска | фильтры доски работают |

### `tests/e2e/edge-cases.spec.ts` — 18

| # | Группа | Сценарий |
|---:|---|---|
| 1 | Вход и доступ | неверный пароль и пустые поля не пускают в систему |
| 2 | Вход и доступ | авторизованный пользователь не видит логин, а после выхода снова получает защиту |
| 3 | Вход и доступ | защищённые страницы и чужие роли: редирект и forbidden |
| 4 | Kanban: фильтры, поиск и навигация | специальные символы и HTML в поиске не ломают доску |
| 5 | Kanban: фильтры, поиск и навигация | комбинированные фильтры и сброс возвращают полную доску |
| 6 | Kanban: фильтры, поиск и навигация | фильтр «без исполнителя», переход в карточку и назад |
| 7 | Kanban: фильтры, поиск и навигация | несуществующая задача отдаёт 404, а не 500 |
| 8 | Создание ТЗ: границы и экранирование | дедлайн в прошлом отклоняется и задача не создаётся |
| 9 | Создание ТЗ: границы и экранирование | невалидные референсы (ftp и javascript) отклоняются |
| 10 | Создание ТЗ: границы и экранирование | HTML и script в тексте задачи экранируются и не выполняются |
| 11 | Создание ТЗ: границы и экранирование | кнопка «Отмена» возвращает на доску без создания задачи |
| 12 | Действия: ошибки ввода и повторные действия | сдача без ссылки и со ссылкой javascript: отклоняется, статус не меняется |
| 13 | Действия: ошибки ввода и повторные действия | правки с коротким комментарием отклоняются, корректный комментарий переводит в «Правки» |
| 14 | Действия: ошибки ввода и повторные действия | чужую задачу на правках нельзя взять ни кнопкой, ни через API |
| 15 | Действия: ошибки ввода и повторные действия | завершённая задача: действий нет, повторная приёмка и AI-расходы отклоняются |
| 16 | Действия: ошибки ввода и повторные действия | AI-расходы: форма появляется после взятия, 0 отклоняется, корректные кредиты сохраняются |
| 17 | Действия: ошибки ввода и повторные действия | RBAC через API: байер не берёт, креативщик не принимает, неизвестное действие — 422 |
| 18 | Аналитика: периоды и устойчивость | переключение 7/30/90/всё время не ломает KPI и не показывает NaN |

### `tests/e2e/lifecycle.spec.ts` — 3

| # | Группа | Сценарий |
|---:|---|---|
| 1 | — | сквозной сценарий: создание → взятие → сдача → правки → повторная сдача → приёмка |
| 2 | — | валидация формы ТЗ показывает ошибки и не создаёт задачу |
| 3 | — | AI-расходы: креативщик добавляет кредиты, они видны в карточке |

## 3. Что покрывают нестандартные сценарии

| Проверка | Где |
|---|---|
| Неверный пароль, пустые поля, повторный вход, выход | `edge-cases.spec.ts` → «Вход и доступ» |
| Редирект с защищённых страниц и forbidden для чужих ролей | `edge-cases.spec.ts` → «Вход и доступ» |
| SQL/HTML-инъекции и спецсимволы в поиске | `edge-cases.spec.ts` → «Kanban» |
| Комбинированные фильтры, сброс, фильтр без исполнителя | `edge-cases.spec.ts` → «Kanban» |
| Несуществующая задача → 404 | `edge-cases.spec.ts` → «Kanban» |
| Дедлайн в прошлом, невалидные и опасные URL референсов | `edge-cases.spec.ts` → «Создание ТЗ» |
| XSS через оффер и описание | `edge-cases.spec.ts` → «Создание ТЗ» |
| Сдача без ссылки и с `javascript:` | `edge-cases.spec.ts` → «Действия» |
| Правки с коротким комментарием | `edge-cases.spec.ts` → «Действия» |
| Чужая задача на правках: нет кнопок и 409 через API | `edge-cases.spec.ts` → «Действия» |
| Повторная приёмка, AI-расходы на завершённой задаче | `edge-cases.spec.ts` → «Действия» |
| AI-расходы до взятия и кредиты = 0 | `edge-cases.spec.ts` → «Действия» |
| Обход RBAC через прямые API-запросы | `edge-cases.spec.ts` → «Действия» |
| Периоды аналитики и отсутствие NaN/Infinity | `edge-cases.spec.ts` → «Аналитика» |
| Невалидные query-фильтры API → 422 | `api.test.ts` → «GET /api/tasks: фильтры» |

## 4. Найденные и исправленные баги

| Баг | Причина | Исправление | Регрессионный тест |
|---|---|---|---|
| `GET /api/tasks` с невалидным `status`/`priority`/длинным `q` отвечал **500** | В route вызывался сырой `zod.parse`, его `ZodError` не превращался в `AppError` | Перешли на `parseInput` + страховка `ZodError → 422` в `handle()` | `api.test.ts` → «GET /api/tasks: фильтры» |
| UI показывал общее «Проверьте заполнение полей» вместо причины | `TaskActions` и `AiUsageForm` читали только `error.message`, игнорируя `error.details` | Показываем первую деталь валидации, общее сообщение — как fallback | `edge-cases.spec.ts` → «сдача без ссылки…», «AI-расходы…» |
| На карточке задачи статус назывался «Новые» вместо «Новая» | Один словарь подписей использовался и для колонки, и для карточки | Добавлены отдельные `STATUS_LABELS_SINGULAR` | `lifecycle.spec.ts` → сквозной сценарий |

Проверено и подтверждено как корректное поведение (не баги): повторная приёмка → `409`, AI-расходы на завершённой задаче → `409`, чужой исполнитель → `409`, неизвестное действие → `422`, пустая/опасная ссылка → `422`.
