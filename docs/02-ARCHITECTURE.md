# Архитектура CreativeOps

## 1. Слои

```
src/
  app/                    # Next.js App Router: страницы (RSC) + Route Handlers (API)
    (auth)/login/         # вход
    (app)/board/          # Kanban
    (app)/tasks/new/      # форма ТЗ
    (app)/tasks/[id]/     # карточка задачи: действия, время, AI-расходы, история
    (app)/analytics/      # дашборд руководителя
    api/                  # HTTP API
  components/             # UI (server и client components)
  lib/
    db/                   # драйвер node:sqlite, схема, миграции, репозитории
    domain/               # ЧИСТЫЕ правила: статусы, права, время, агрегаты
    services/             # use-cases: авторизация, задачи, аналитика (RBAC + транзакции)
    api/                  # хелперы ответов/ошибок/guard'ов для Route Handlers
    seed.ts               # демо-данные
tests/
  unit/                   # домен (без БД)
  integration/            # сервисы на временной SQLite
  e2e/                    # Playwright
```

Правило зависимостей: `app → services → {domain, db}`. `domain` — чистые функции без I/O (кроме явно передаваемого `now`), поэтому время и правила детерминированы в тестах.

## 2. Модель данных

```
users(id, email, password_hash, name, role, color, created_at)
sessions(id, user_id, token_hash, created_at, expires_at)
tasks(id, number, code, buyer_id, assignee_id,
      offer, geo, creative_type, quantity, description, references(json),
      priority, deadline,
      status, revision_count, revision_note,
      deliverable_url, deliverable_note,
      created_at, first_started_at, first_submitted_at, submitted_at, completed_at, updated_at)
ai_usage(id, task_id, user_id, service, credits, note, phase, created_at)
activity(id, task_id, actor_id, type, from_status, to_status, message, created_at)
```

Инварианты:
* `code` = `CR-####`, генерируется из автоинкремента (`number`) — человекочитаемый номер карточки.
* Таймстемпы только проставляются (никогда не перезаписываются, кроме `submitted_at` — он означает последнюю сдачу, `first_submitted_at` — первую).
* `activity` — append-only; ни одна операция API не удаляет записи.
* Изменение статуса возможно только через `applyAction()` — единственное место, где пишутся `status`, таймстемпы и `activity`.

## 3. State machine Kanban

| Action | Кто | Из статусов | В статус | Побочные эффекты |
|---|---|---|---|---|
| `take` | креативщик | `new`, `revision` | `in_progress` | `assignee_id = user` (первый раз), `first_started_at` (один раз) |
| `submit` | назначенный креативщик | `in_progress` | `review` | `submitted_at`, `deliverable_url/note` |
| `approve` | байер-владелец, руководитель | `review` | `done` | `completed_at` → финальная длительность |
| `request_revision` | байер-владелец, руководитель | `review` | `revision` | `revision_count++`, `revision_note` (комментарий обязателен) |

Правила, которые обычно забывают и которые здесь покрыты тестами:
1. Правки идут **тому же** креативщику: `take` из `revision` разрешён только текущему исполнителю (или любому, если исполнителя нет).
2. Нельзя сдать задачу в `review`, если исполнитель — не ты.
3. Комментарий к правкам обязателен (≥ 5 символов) — иначе правки не имеют смысла.
4. Просрочка считается и для незавершённых (`deadline < now`), и для завершённых позже дедлайна.
5. Длительность = `completed_at - first_started_at`; «время до старта» = `first_started_at - created_at`; «время на правках» = суммарное время в статусах `review`/`revision` (по `activity`).

## 4. RBAC (в сервисном слое)

| Возможность | buyer | creative | manager |
|---|---|---|---|
| Создать ТЗ | ✅ (на себя) | ❌ 403 | ❌ 403 |
| Видеть задачи | свои + общая доска | доска + свои | все |
| Взять в работу / сдать | ❌ | ✅ | ❌ |
| Принять / на правки | ✅ (свои) | ❌ | ✅ (надзор) |
| Добавить AI-расходы | ❌ | ✅ (по своим задачам) | ❌ |
| Читать аналитику | ❌ 403 | ❌ 403 | ✅ |
| История по задаче | ✅ | ✅ | ✅ |

## 5. API

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/api/auth/login` | вход по email/паролю, ставит httpOnly-cookie |
| POST | `/api/auth/logout` | выход |
| GET | `/api/auth/me` | текущий пользователь |
| GET | `/api/tasks` | список с фильтрами (`status`, `assigneeId`, `q`, `priority`, `overdue`) |
| POST | `/api/tasks` | создать ТЗ (buyer) |
| GET | `/api/tasks/:id` | задача + история + AI-расходы + агрегаты времени |
| POST | `/api/tasks/:id/actions` | `take` / `submit` / `approve` / `request_revision` |
| POST | `/api/tasks/:id/ai-usage` | добавить запись о кредитах |
| GET | `/api/analytics` | KPI, загрузка, просрочки, расходы (manager) |
| GET | `/api/meta` | справочники (услуги, пользователи, GEO, типы креатива) |

Единый формат ошибок: `{ "error": { "code": "FORBIDDEN", "message": "..." } }` + корректный HTTP-код (`400/401/403/404/409/422`).

## 6. Время и деньги

* Все даты — ISO-8601 UTC в БД; в UI — локаль `ru-RU`.
* Кредиты AI — `REAL` (сервисы округляют до 0.25), агрегаты по сервису и по исполнителю.
* Просрочки и «среднее время выполнения» считаются только по завершённым задачам.

## 7. Почему так, а не иначе (коротко)

* **Один деплой** — прототип за 24 часа: экономит часы на инфраструктуру.
* **Без нативных зависимостей** — гарантия, что демо поднимется у проверяющего одной командой.
* **RBAC в сервисах** — «безопасность» не может быть обойдена через API.
* **Append-only история** — аналитика и аудит строятся на фактах, а не на текущем состоянии.
* **Чистый домен** — правила проверяются юнит-тестами без БД и браузера (быстро и стабильно).
