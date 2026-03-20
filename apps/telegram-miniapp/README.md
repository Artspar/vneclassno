# Telegram Mini App

Stack:
- React + Vite
- Telegram WebApp JS SDK

## Run

1. Set env in `.env.example` format.
2. Run: `npm run dev -w @vneclassno/telegram-miniapp`
3. Open: `http://localhost:3002/?token=<invite_token>`

## Implemented

- Telegram login via `/auth/telegram` using `initData` (or fallback `id=<telegram_user_id>` in dev).
- Invite resolve: `/invites/{token}`.
- Existing child selection and invite accept.
- New child creation and invite accept.
- Start token extraction from `?token=`, `tgWebAppStartParam`, and Telegram `start_param`.
