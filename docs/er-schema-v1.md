# ER Schema v1

## 1. Таблицы пользователей и доступа

### `users`
- `id` (uuid, pk)
- `phone` (text, unique, nullable)
- `telegram_id` (bigint, unique, nullable)
- `first_name` (text)
- `last_name` (text, nullable)
- `status` (enum: `active`, `blocked`)
- `created_at`, `updated_at`

### `roles`
- `id` (uuid, pk)
- `code` (enum: `super_admin`, `section_admin`, `coach`, `parent`)

### `user_roles`
- `id` (uuid, pk)
- `user_id` (fk -> users.id)
- `role_id` (fk -> roles.id)
- `section_id` (fk -> sections.id, nullable for `super_admin`)
- unique index: (`user_id`, `role_id`, `section_id`)

## 2. Секции, группы, дети

### `sections`
- `id` (uuid, pk)
- `name` (text)
- `status` (enum: `active`, `archived`)
- `settings_json` (jsonb) // правила списаний, оплаты, уведомлений
- `created_at`, `updated_at`

### `groups`
- `id` (uuid, pk)
- `section_id` (fk -> sections.id)
- `name` (text)
- `sport_or_subject` (text, nullable)
- `status` (enum: `active`, `archived`)
- `created_at`, `updated_at`

### `children`
- `id` (uuid, pk)
- `first_name` (text)
- `last_name` (text)
- `birth_date` (date, nullable)
- `status` (enum: `active`, `inactive`)
- `created_at`, `updated_at`

### `parent_children`
- `id` (uuid, pk)
- `parent_user_id` (fk -> users.id)
- `child_id` (fk -> children.id)
- `relationship` (text, nullable)
- unique index: (`parent_user_id`, `child_id`)

### `group_memberships`
- `id` (uuid, pk)
- `group_id` (fk -> groups.id)
- `child_id` (fk -> children.id)
- `joined_at` (date)
- `left_at` (date, nullable)
- unique index: (`group_id`, `child_id`, `joined_at`)

### `coach_groups`
- `id` (uuid, pk)
- `coach_user_id` (fk -> users.id)
- `group_id` (fk -> groups.id)
- `is_primary` (boolean, default false)
- unique index: (`coach_user_id`, `group_id`)

## 3. Расписание и посещаемость

### `sessions`
- `id` (uuid, pk)
- `section_id` (fk -> sections.id)
- `group_id` (fk -> groups.id)
- `coach_user_id` (fk -> users.id)
- `type` (enum: `training`, `game`, `event`, `trial`, `extra`)
- `starts_at` (timestamptz)
- `ends_at` (timestamptz)
- `status` (enum: `scheduled`, `started`, `finished`, `cancelled`)
- `location` (text, nullable)
- `notes` (text, nullable)
- indexes: (`group_id`, `starts_at`), (`coach_user_id`, `starts_at`)

### `attendance`
- `id` (uuid, pk)
- `session_id` (fk -> sessions.id)
- `child_id` (fk -> children.id)
- `status` (enum: `expected`, `present`, `late`, `absent`)
- `marked_by_user_id` (fk -> users.id, nullable)
- `marked_at` (timestamptz, nullable)
- `source` (enum: `coach`, `system`)
- unique index: (`session_id`, `child_id`)

## 4. Отсутствия и решения

### `absence_requests`
- `id` (uuid, pk)
- `session_id` (fk -> sessions.id)
- `child_id` (fk -> children.id)
- `requested_by_user_id` (fk -> users.id)
- `reason` (text, nullable)
- `status` (enum: `pending`, `approved`, `rejected`)
- `decision_by_user_id` (fk -> users.id, nullable)
- `decision_at` (timestamptz, nullable)
- `decision_comment` (text, nullable)
- unique index: (`session_id`, `child_id`)

## 5. Абонементы и списания

### `subscriptions`
- `id` (uuid, pk)
- `child_id` (fk -> children.id)
- `section_id` (fk -> sections.id)
- `type` (enum: `by_sessions`, `by_time`)
- `total_units` (integer) // занятия или минуты
- `remaining_units` (integer)
- `valid_from` (date)
- `valid_to` (date)
- `status` (enum: `active`, `expired`, `frozen`, `closed`)
- indexes: (`child_id`, `section_id`, `status`)

### `subscription_ledger`
- `id` (uuid, pk)
- `subscription_id` (fk -> subscriptions.id)
- `session_id` (fk -> sessions.id, nullable)
- `delta_units` (integer) // отрицательное = списание, положительное = возврат/продление
- `reason` (enum: `session_spend`, `absence_approved_refund`, `manual_adjustment`, `expire_adjustment`)
- `created_by_user_id` (fk -> users.id, nullable)
- `created_at` (timestamptz)
- index: (`subscription_id`, `created_at`)

## 6. Платежи

### `payments`
- `id` (uuid, pk)
- `child_id` (fk -> children.id)
- `section_id` (fk -> sections.id)
- `created_by_user_id` (fk -> users.id)
- `method` (enum: `auto_link`, `auto_qr`, `manual_transfer`)
- `amount` (numeric(12,2))
- `currency` (char(3), default 'RUB')
- `status` (enum: `created`, `pending_confirmation`, `paid`, `rejected`, `cancelled`)
- `provider_payment_id` (text, nullable)
- `provider_payload` (jsonb, nullable)
- `proof_file_id` (fk -> files.id, nullable)
- `confirmed_by_user_id` (fk -> users.id, nullable)
- `confirmed_at` (timestamptz, nullable)
- `created_at`, `updated_at`
- indexes: (`section_id`, `status`, `created_at`), (`child_id`, `created_at`)

### `files`
- `id` (uuid, pk)
- `storage_key` (text)
- `mime_type` (text)
- `size_bytes` (bigint)
- `uploaded_by_user_id` (fk -> users.id)
- `created_at` (timestamptz)

## 7. Уведомления и доставка

### `notifications`
- `id` (uuid, pk)
- `section_id` (fk -> sections.id)
- `type` (enum: `session_reminder`, `schedule_change`, `event_announce`, `payment_update`, `absence_decision`)
- `title` (text)
- `body` (text)
- `payload` (jsonb, nullable)
- `created_by_user_id` (fk -> users.id)
- `scheduled_at` (timestamptz, nullable)
- `created_at` (timestamptz)

### `notification_recipients`
- `id` (uuid, pk)
- `notification_id` (fk -> notifications.id)
- `user_id` (fk -> users.id)
- unique index: (`notification_id`, `user_id`)

### `notification_deliveries`
- `id` (uuid, pk)
- `notification_id` (fk -> notifications.id)
- `user_id` (fk -> users.id)
- `channel` (enum: `telegram`, `pwa_push`, `in_app`)
- `status` (enum: `queued`, `sent`, `failed`)
- `error_message` (text, nullable)
- `attempts` (int, default 0)
- `last_attempt_at` (timestamptz, nullable)
- indexes: (`status`, `last_attempt_at`), (`notification_id`, `user_id`, `channel`)

## 8. Аудит

### `audit_log`
- `id` (uuid, pk)
- `actor_user_id` (fk -> users.id, nullable)
- `action` (text) // например `attendance.bulk_update`, `payment.manual_confirm`
- `entity_type` (text)
- `entity_id` (uuid)
- `before_json` (jsonb, nullable)
- `after_json` (jsonb, nullable)
- `created_at` (timestamptz)
- index: (`created_at`), (`entity_type`, `entity_id`)

## 9. Ключевые связи
- `users` M:N `roles` через `user_roles`.
- `users(parent)` M:N `children` через `parent_children`.
- `children` M:N `groups` через `group_memberships`.
- `users(coach)` M:N `groups` через `coach_groups`.
- `sessions` 1:N `attendance`.
- `sessions` 1:N `absence_requests` (на одного ребенка максимум один активный реквест на сессию).
- `children` 1:N `subscriptions`.
- `subscriptions` 1:N `subscription_ledger`.
- `children` 1:N `payments`.
- `notifications` 1:N `notification_deliveries`.
