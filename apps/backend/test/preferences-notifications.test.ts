import { strict as assert } from 'node:assert';
import test from 'node:test';
import { AttendanceService } from '../src/attendance/attendance-service.js';
import { AuthService } from '../src/auth/auth-service.js';
import { TokenService } from '../src/auth/token-service.js';
import { NotificationService } from '../src/notifications/notification-service.js';
import { OtpService } from '../src/otp/otp-service.js';
import { UserPreferencesService } from '../src/preferences/user-preferences-service.js';
import { RbacService } from '../src/rbac/rbac-service.js';
import { InMemoryIdentityStore } from '../src/repositories/in-memory-identity-store.js';
import { TelegramBotService } from '../src/telegram/telegram-bot.service.js';

async function setup() {
  const store = new InMemoryIdentityStore();
  await store.seedDemoData();

  const tokenService = new TokenService('test_access_secret', 'test_refresh_secret');
  const auth = new AuthService(tokenService, store, new OtpService());
  const preferences = new UserPreferencesService(store);
  const rbac = new RbacService(store);
  const attendance = new AttendanceService(store);
  const notifications = new NotificationService(store, rbac, new TelegramBotService(), attendance);

  return { store, auth, preferences, notifications };
}

test('Preferences: stores active child and section for parent context', async () => {
  const { auth, preferences, store } = await setup();

  const parent = await auth.loginPwa({
    phone: '+79990000001',
    otpCode: '1234',
  });

  const children = await store.listChildrenForParent(parent.user.id);
  const alex = children.find((child) => child.firstName === 'Alex');
  assert.ok(alex, 'expected Alex in demo parent children');

  const saved = await preferences.setContextSelection(parent.user.id, {
    activeChildId: alex.id,
    activeSectionId: 'section-a',
  });

  assert.equal(saved.activeChildId, alex.id);
  assert.equal(saved.activeSectionId, 'section-a');

  const loaded = await preferences.getContextSelection(parent.user.id);
  assert.equal(loaded.activeChildId, alex.id);
  assert.equal(loaded.activeSectionId, 'section-a');
});

test('Notifications: parent unread becomes read after markRead', async () => {
  const { auth, notifications } = await setup();

  const sectionAdmin = await auth.loginTelegram({ initData: 'id=1002' });
  const parent = await auth.loginPwa({
    phone: '+79990000001',
    otpCode: '1234',
  });

  const created = await notifications.create(sectionAdmin.user.id, {
    sectionId: 'section-b',
    type: 'training',
    title: 'Проверка read/unread',
    message: 'Тестовое уведомление',
    targetMode: 'all',
  });

  const before = await notifications.list(parent.user.id, { sectionId: 'section-b' });
  assert.equal(before.unreadCount, 1);
  assert.equal(before.items[0]?.id, created.id);
  assert.equal(before.items[0]?.isRead, false);

  const marked = await notifications.markRead(parent.user.id, created.id);
  assert.equal(marked.isRead, true);

  const after = await notifications.list(parent.user.id, { sectionId: 'section-b' });
  assert.equal(after.unreadCount, 0);
  assert.equal(after.items[0]?.isRead, true);
});

test('Notifications: manager markRead does not create personal read state', async () => {
  const { auth, notifications, store } = await setup();

  const coach = await auth.loginTelegram({ initData: 'id=1001' });

  const created = await notifications.create(coach.user.id, {
    sectionId: 'section-a',
    type: 'training',
    title: 'Manager read behavior',
    message: 'Coach should not get read marker',
    targetMode: 'all',
  });

  const marked = await notifications.markRead(coach.user.id, created.id);
  assert.equal(marked.isRead, false);

  const readIds = await store.listReadNotificationIds(coach.user.id, [created.id]);
  assert.equal(readIds.length, 0);
});
