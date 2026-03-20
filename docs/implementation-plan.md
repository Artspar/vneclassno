# План реализации (Roadmap)

## Этап 1. Product Freeze (2-3 дня)
- Утвердить `docs/product-spec-v1.md`.
- Зафиксировать бизнес-правила списаний при `approved/rejected` отсутствии.
- Зафиксировать payment providers для `auto_link` и `auto_qr`.

**Результат:** неизменяемые правила MVP.

## Этап 2. Data + API Design (3-4 дня)
- Утвердить `docs/er-schema-v1.md`.
- Утвердить `docs/openapi-v1.yaml`.
- Добавить матрицу ролей (RBAC) для каждого endpoint.

**Результат:** контракты готовы для параллельной backend/frontend разработки.

## Этап 3. Monorepo Bootstrap (2 дня)
- Создать структуру:
  - `apps/backend`
  - `apps/pwa`
  - `apps/telegram-miniapp`
  - `packages/shared-types`
  - `packages/ui` (опционально)
- Настроить линтеры, форматирование, CI, env templates.

**Результат:** единая кодовая база для трех приложений.

## Этап 4. Auth + RBAC + Parent Context (4-5 дней)
- Telegram auth (init data).
- PWA one-time auth + refresh token.
- Роли: `super_admin`, `section_admin`, `coach`, `parent`.
- Контекст родителя: активный ребенок/секция.
- Invite onboarding: единая ссылка `/invite/{token}` для Telegram и PWA.
- Join request flow: выбор существующего ребенка или создание нового при входе по invite.

**Результат:** безопасный вход и корректная видимость данных.

## Этап 5. Schedule + Sessions + Fast Attendance (5-7 дней)
- CRUD занятий.
- Экран быстрого учета посещаемости.
- Bulk update посещаемости.
- Релтайм статус для родителя (`expected`, `in_class`, `absent`, `finished`).

**Результат:** главный операционный сценарий тренера.

## Этап 6. Absence Decision Engine (3-4 дня)
- Создание заявок на отсутствие.
- Решение тренера: `approved/rejected`.
- Автоприменение правил списания/продления.

**Результат:** прозрачная и проверяемая логика пропусков.

## Этап 7. Subscriptions + Ledger (3-4 дня)
- Абонементы `by_sessions` и `by_time`.
- Журнал движений (`subscription_ledger`).
- Отображение остатка и истории для тренера/родителя.

**Результат:** корректный учет абонементов.

## Этап 8. Payments (6-8 дней)
- `auto_link` (СБП ссылка).
- `auto_qr` (СБП QR).
- `manual_transfer` (скрин + подтверждение тренером).
- Webhook обработка и автозачет.

**Результат:** закрытый контур оплаты с автоматическим учетом.

## Этап 9. Notifications + Delivery Reliability (4-5 дней)
- Шаблоны уведомлений.
- Одновременная доставка в Telegram и PWA.
- Ретраи, dead-letter стратегия, delivery log.

**Результат:** единая коммуникация без расхождений между каналами.

## Этап 10. Role-based UI Tabs (4-6 дней)
- Реализовать таббар для тренера/админа и для родителя.
- Встроить контекстный селектор ребенка/секции в parent UX.
- Проверить mobile UX на iOS/Android.

**Результат:** рабочий продуктовый UX MVP.

## Этап 11. QA + Hardening (5-7 дней)
- Unit/integration/e2e.
- Нагрузочное тестирование посещаемости и уведомлений.
- Security checks (auth, permissions, webhook signature).

**Результат:** релиз-кандидат.

## Этап 12. Pilot + Iterate (1-2 недели)
- Пилот на 1-2 секциях.
- Метрики:
  - время отметки посещаемости;
  - доля успешной доставки уведомлений;
  - конверсия в оплату по `auto_link/auto_qr`;
  - доля ручных подтверждений.
- Итерации по обратной связи.

**Результат:** production-ready MVP и backlog фазы 2.

## Ближайшие шаги (с этого момента)
1. Утвердить 3 документа в `docs/`.
2. Выбрать stack backend/PWA/telegram.
3. Создать monorepo и начать Этап 3.
