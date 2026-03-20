# PWA

Stack:
- Next.js App Router

## Run

1. Set envs from `.env.example`.
2. Run: `npm run dev -w @vneclassno/pwa`
3. Open: `http://localhost:3001/invite/<token>`

## Implemented

- `GET /invite/[token]` page with invite onboarding flow.
- PWA login (`/auth/pwa/login`).
- Existing child selection and invite accept.
- New child creation and invite accept.
- Optional Telegram redirect when opened in Telegram context and `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is set.
