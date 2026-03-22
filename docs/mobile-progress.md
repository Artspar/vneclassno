# Mobile Progress

## Status
- Date: 2026-03-22
- Current phase: Foundation / Step 1

## Done
- [x] Создан `apps/mobile` scaffold (Expo + Router + tabs)
- [x] Подключены `React Query` и `Zustand`
- [x] Добавлен базовый API client
- [x] Реализован login flow (`request OTP` + `login`) в мобильном клиенте
- [x] Реализована загрузка `me/context`
- [x] Реализовано сохранение выбора ребенка/секции через `/me/preferences/context`
- [x] Сессия сохраняется в `SecureStore`

## Next
- [ ] Перенести production UI shell (hero/status/tabs visual parity)
- [ ] Экран `Calendar` с реальным API
- [ ] Экран `Attendance` с подтверждением участия
- [ ] Экран `Notifications` (inbox/read-state)
- [ ] Push registration (Expo Notifications)
