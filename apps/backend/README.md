# Backend

Current stack:
- NestJS (`src/main.ts`)
- Prisma + PostgreSQL (`prisma/schema.prisma`)

Implemented scope (Stage 4):
- Auth service for Telegram and PWA one-time login
- Refresh token flow
- RBAC permission matrix (`super_admin`, `section_admin`, `coach`, `parent`)
- Parent context service (active child + active section)
- Invite onboarding service for Telegram/PWA single-link flow
- Telegram webhook handling for `/start invite_<token>`

## Run (PostgreSQL mode)

1. Set envs from `apps/backend/.env.example`.
2. Generate Prisma client:
- `npm run prisma:generate -w @vneclassno/backend`
3. Apply migrations:
- `npm run prisma:migrate -w @vneclassno/backend`
4. Seed demo data:
- `npm run prisma:seed -w @vneclassno/backend`
5. Start API:
- `npm run dev -w @vneclassno/backend`

## Run (Test mode without DB)

1. Start API in in-memory mode:
- `npm run dev:test -w @vneclassno/backend`
2. Check:
- `curl -sS http://localhost:3000/health`

## Implemented Endpoints

- `GET /health`
- `POST /auth/telegram`
- `POST /auth/pwa/login`
- `POST /auth/refresh`
- `GET /me/context`
- `POST /context/select`
- `POST /invites`
- `GET /invites/{token}`
- `POST /invites/{token}/accept`
- `POST /join-requests/{requestId}/decision`
- `POST /telegram/webhook`

## Telegram setup

1. Set envs:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_MINIAPP_URL`
2. Configure webhook in BotFather/Telegram API to:
- `https://<your-backend-domain>/telegram/webhook`
3. Bot deep-link format:
- `https://t.me/<bot_username>?startapp=invite_<token>`

## Tests

- Run backend tests:
- `npm run test -w @vneclassno/backend`

The test suite validates invite onboarding flows for both Telegram and PWA channels.
