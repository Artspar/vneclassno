import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AuthService } from './auth/auth-service.js';
import { InviteService } from './invites/invite-service.js';
import type { IdentityStore } from './repositories/identity-store.js';
import { IDENTITY_STORE } from './tokens.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const authService = app.get(AuthService);
  const inviteService = app.get(InviteService);
  const store = app.get<IdentityStore>(IDENTITY_STORE);

  const coachLogin = await authService.loginTelegram({ initData: 'id=1002' });
  const invite = await inviteService.createInvite({
    actorUserId: coachLogin.user.id,
    sectionId: 'section-b',
  });

  const parentLogin = await authService.loginPwa({ phone: '+79990000001', otpCode: '1234' });
  const children = await store.listChildrenForParent(parentLogin.user.id);
  const childId = children[0]?.id;
  if (!childId) {
    throw new Error('No child linked to parent in seed data');
  }

  const joinRequest = await inviteService.acceptInvite({
    actorUserId: parentLogin.user.id,
    token: invite.token,
    childId,
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        inviteStatus: invite.status,
        joinRequestStatus: joinRequest.status,
      },
      null,
      2,
    ),
  );

  await app.close();
}

try {
  await main();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
}
