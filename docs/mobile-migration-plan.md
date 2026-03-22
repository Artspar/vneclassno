# Mobile Migration Plan (React Native + Admin Web)

## 1. Цель перехода

Перейти с `PWA + Telegram Mini App` на кроссплатформенный мобильный клиент (`iOS/Android`) с сохранением текущего backend, при этом выделить отдельный продвинутый веб-кабинет для:
- тренера,
- администратора секции,
- супер-админа.

## 2. Целевая архитектура

- `apps/backend` (NestJS, PostgreSQL/Prisma) — основной API, роли, платежи, уведомления, участие, доступы.
- `apps/mobile` (Expo/React Native) — родитель + тренерские mobile flows.
- `apps/admin-web` (следующий этап, Next.js) — расширенный кабинет админов и аналитика.
- `packages/*` — общие типы/клиент API/доменная логика.

## 3. План перехода по этапам

### Этап A. Foundation (1 неделя)
- Поднять `apps/mobile` (Expo + Router + TS).
- Ввести app shell: tabs, auth guard, role/context store.
- Подключить базовый API клиент к текущему backend.
- Определить mobile env contract (`API`, `push`, `build profile`).

**Критерий готовности:** приложение запускается на iOS/Android, получает контекст пользователя и отображает табы.

### Этап B. Core Flows (1-2 недели)
- Auth/login + secure token storage.
- Контекст ребенка/секции (устойчивый между вкладками).
- Home/Calendar/Attendance/Payments/Profile.
- Участие в занятии и подтверждение отсутствия.

**Критерий готовности:** родитель и тренер проходят ежедневный сценарий без веба.

### Этап C. Realtime + Notifications (1 неделя)
- Push (Expo Notifications / FCM/APNs).
- In-app inbox + read/unread + deep links.
- Telegram оставить как канал доставки, не как клиент.

**Критерий готовности:** событие от тренера приходит push + отражается в inbox и статусы читаемости консистентны.

### Этап D. Payments (1 неделя)
- `auto_link`, `auto_qr`, `manual_transfer` в мобильных экранах.
- Проверка бизнес-ограничений (можно платить заранее/после дедлайна).
- Подтверждение ручного перевода и статусы для тренера.

**Критерий готовности:** полный платежный контур от родителя до тренера в mobile.

### Этап E. Admin Web (параллельно/после mobile beta)
- Новый `apps/admin-web` с таблицами, фильтрами, отчетами, массовыми действиями.
- Матрица прав `super_admin | section_admin | coach`.
- Аудит логов и аналитика.

## 4. Риски и как закрываем

- Риск: регрессии по ролям и доступам.
  - Решение: контрактные тесты backend + role matrix checks.
- Риск: лаги чатов/ленты.
  - Решение: FlashList, optimistic updates, профилирование JS/UI thread.
- Риск: рассинхрон read/unread.
  - Решение: сервер как source of truth, идемпотентные `markRead`.

## 5. Что уже сделано

- Зафиксированы backend тесты для:
  - сохранения контекста пользователя,
  - read/unread уведомлений,
  - manager behavior для `markRead`.

## 6. Стартовые задачи (в работе)

1. Создан каркас `apps/mobile`.
2. Подключен базовый app shell (tabs + providers).
3. Подготовлен API client и env для интеграции с текущим backend.
