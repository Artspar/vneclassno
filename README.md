# VneClassno Monorepo

Monorepo with three applications:
- `apps/backend`
- `apps/pwa`
- `apps/telegram-miniapp`

Shared packages:
- `packages/shared-types`
- `packages/ui`

## Quick Start (Local Full Mode)

1. Install Node.js 20+
2. Install dependencies: `npm install`
3. Start infra: `docker compose up -d`
4. Copy envs:
- `cp .env.example .env`
- `cp apps/backend/.env.example apps/backend/.env`
- `cp apps/pwa/.env.example apps/pwa/.env.local`
- `cp apps/telegram-miniapp/.env.example apps/telegram-miniapp/.env`
5. Generate Prisma client: `npm run prisma:generate -w @vneclassno/backend`
6. Apply migrations: `npm run prisma:migrate -w @vneclassno/backend`
7. Seed demo data: `npm run prisma:seed -w @vneclassno/backend`
8. Run apps in separate terminals:
- `npm run dev -w @vneclassno/backend`
- `npm run dev -w @vneclassno/pwa`
- `npm run dev -w @vneclassno/telegram-miniapp`

## Quick Start (Test Mode Without DB)

This mode starts backend with in-memory data and no PostgreSQL requirement.

1. Install dependencies: `npm install`
2. Copy frontend envs:
- `cp apps/pwa/.env.example apps/pwa/.env.local`
- `cp apps/telegram-miniapp/.env.example apps/telegram-miniapp/.env`
3. Run apps in separate terminals:
- `npm run dev:test -w @vneclassno/backend`
- `npm run dev -w @vneclassno/pwa`
- `npm run dev -w @vneclassno/telegram-miniapp`

## Health Check

- Backend health: `http://localhost:3000/health`

## Workspace Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
