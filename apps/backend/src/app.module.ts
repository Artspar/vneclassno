import { Module } from '@nestjs/common';
import { AuthService } from './auth/auth-service.js';
import { TokenService } from './auth/token-service.js';
import { ParentContextService } from './context/parent-context-service.js';
import { AuthController } from './http/auth.controller.js';
import { ContextController } from './http/context.controller.js';
import { InvitesController } from './http/invites.controller.js';
import { TelegramController } from './http/telegram.controller.js';
import { InviteService } from './invites/invite-service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { type IdentityStore } from './repositories/identity-store.js';
import { PrismaIdentityStore } from './repositories/prisma-identity-store.js';
import { RbacService } from './rbac/rbac-service.js';
import { TelegramBotService } from './telegram/telegram-bot.service.js';
import { IDENTITY_STORE } from './tokens.js';

@Module({
  controllers: [AuthController, ContextController, InvitesController, TelegramController],
  providers: [
    PrismaService,
    PrismaIdentityStore,
    TelegramBotService,
    {
      provide: IDENTITY_STORE,
      useExisting: PrismaIdentityStore,
    },
    {
      provide: TokenService,
      useFactory: () => {
        const accessSecret = process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret';
        const refreshSecret = process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret';
        return new TokenService(accessSecret, refreshSecret);
      },
    },
    {
      provide: RbacService,
      inject: [IDENTITY_STORE],
      useFactory: (store: IdentityStore) => new RbacService(store),
    },
    {
      provide: AuthService,
      inject: [TokenService, IDENTITY_STORE],
      useFactory: (tokenService: TokenService, store: IdentityStore) => new AuthService(tokenService, store),
    },
    {
      provide: ParentContextService,
      inject: [IDENTITY_STORE],
      useFactory: (store: IdentityStore) => new ParentContextService(store),
    },
    {
      provide: InviteService,
      inject: [IDENTITY_STORE, RbacService, TelegramBotService],
      useFactory: (store: IdentityStore, rbac: RbacService, telegramBotService: TelegramBotService) =>
        new InviteService(store, rbac, telegramBotService),
    },
  ],
})
export class AppModule {}
