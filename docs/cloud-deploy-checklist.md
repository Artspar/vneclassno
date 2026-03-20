# Cloud Deploy Checklist

## 1. Railway backend
- Create service with root `apps/backend`
- Import vars from `railway.env`
- Set real values for:
  - `TELEGRAM_BOT_TOKEN`
  - `PWA_BASE_URL`

## 2. Railway DB init
Run in Railway shell:

```bash
npm install
npm run prisma:generate -w @vneclassno/backend
npm run prisma:migrate -w @vneclassno/backend
npm run prisma:seed -w @vneclassno/backend
```

## 3. Vercel apps
- PWA project root: `apps/pwa`, env from `vercel.pwa.env`
- Mini app project root: `apps/telegram-miniapp`, env from `vercel.telegram-miniapp.env`

Replace `REPLACE_WITH_BACKEND_URL` with Railway public URL:
`https://<service>.up.railway.app`

## 4. Telegram webhook
After backend is public, run:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "content-type: application/json" \
  -d '{"url":"https://<BACKEND_URL>/telegram/webhook"}'
```

Verify:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

## 5. Quick test
1. Create invite via `POST /invites` as section admin.
2. Open:
- PWA: `https://<PWA_URL>/invite/<token>`
- Telegram: `https://t.me/vneclassno_bot?startapp=invite_<token>`
