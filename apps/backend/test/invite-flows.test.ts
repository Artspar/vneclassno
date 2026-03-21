import { strict as assert } from 'node:assert';
import test from 'node:test';
import { AuthService } from '../src/auth/auth-service.js';
import { TokenService } from '../src/auth/token-service.js';
import { ParentContextService } from '../src/context/parent-context-service.js';
import { InviteService } from '../src/invites/invite-service.js';
import { OtpService } from '../src/otp/otp-service.js';
import { RbacService } from '../src/rbac/rbac-service.js';
import { InMemoryIdentityStore } from '../src/repositories/in-memory-identity-store.js';
import { TelegramBotService } from '../src/telegram/telegram-bot.service.js';

async function setup() {
  const store = new InMemoryIdentityStore();
  await store.seedDemoData();

  const tokenService = new TokenService('test_access_secret', 'test_refresh_secret');
  const auth = new AuthService(tokenService, store, new OtpService());
  const rbac = new RbacService(store);
  const telegramBot = new TelegramBotService();
  const invites = new InviteService(store, rbac, telegramBot);
  const parentContext = new ParentContextService(store);

  return { store, auth, invites, parentContext };
}

test('Telegram flow: section admin creates invite, parent accepts with existing child', async () => {
  const { auth, invites, parentContext } = await setup();

  const sectionAdmin = await auth.loginTelegram({ initData: 'id=1002' });
  const invite = await invites.createInvite({
    actorUserId: sectionAdmin.user.id,
    sectionId: 'section-b',
  });

  const parent = await auth.loginPwa({
    phone: '+79990000001',
    otpCode: '1234',
  });

  const context = await parentContext.getContext(parent.user.id);
  assert.ok(context.availableChildren.length > 0);

  const accepted = await invites.acceptInvite({
    actorUserId: parent.user.id,
    token: invite.token,
    childId: context.availableChildren[0].id,
  });

  assert.equal(invite.status, 'active');
  assert.equal(accepted.status, 'auto_approved');
  assert.ok(typeof invite.pwaInviteUrl === 'string' && invite.pwaInviteUrl.includes('/invite/'));
});

test('PWA flow: parent without children accepts invite by creating a new child', async () => {
  const { auth, invites, parentContext } = await setup();

  const sectionAdmin = await auth.loginTelegram({ initData: 'id=1002' });
  const invite = await invites.createInvite({
    actorUserId: sectionAdmin.user.id,
    sectionId: 'section-b',
  });

  const newParent = await auth.loginPwa({
    phone: '+79990000055',
    otpCode: '1234',
  });

  const before = await parentContext.getContext(newParent.user.id);
  assert.equal(before.availableChildren.length, 0);

  const accepted = await invites.acceptInvite({
    actorUserId: newParent.user.id,
    token: invite.token,
    newChild: {
      firstName: 'Nikita',
      lastName: 'Smirnov',
      birthDate: '2018-05-20',
    },
  });

  const after = await parentContext.getContext(newParent.user.id);
  assert.equal(accepted.status, 'auto_approved');
  assert.equal(after.availableChildren.length, 1);
  assert.equal(after.availableChildren[0].firstName, 'Nikita');
});
