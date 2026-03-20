# VneClassno Monorepo

Monorepo with three applications:
- `apps/backend`
- `apps/pwa`
- `apps/telegram-miniapp`

Shared packages:
- `packages/shared-types`
- `packages/ui`

## Quick Start

1. Install Node.js 20+
2. Install dependencies: `npm install`
3. Start infra: `docker compose up -d`
4. Generate Prisma client: `npm run prisma:generate -w @vneclassno/backend`
5. Apply migrations: `npm run prisma:migrate -w @vneclassno/backend`
6. Seed demo data: `npm run prisma:seed -w @vneclassno/backend`
7. Run backend: `npm run dev -w @vneclassno/backend`

## Workspace Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
