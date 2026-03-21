import { Module } from '@nestjs/common';
import { AuthService } from './auth/auth-service.js';
import { AttendanceService } from './attendance/attendance-service.js';
import { TokenService } from './auth/token-service.js';
import { ParentContextService } from './context/parent-context-service.js';
import { AttendanceController } from './http/attendance.controller.js';
import { AuthController } from './http/auth.controller.js';
import { ContextController } from './http/context.controller.js';
import { HealthController } from './http/health.controller.js';
import { InvitesController } from './http/invites.controller.js';
import { LinkingController } from './http/linking.controller.js';
import { NotificationsController } from './http/notifications.controller.js';
import { PaymentsController } from './http/payments.controller.js';
import { PreferencesController } from './http/preferences.controller.js';
import { TelegramController } from './http/telegram.controller.js';
import { InviteService } from './invites/invite-service.js';
import { AccountLinkService } from './linking/account-link-service.js';
import { NotificationService } from './notifications/notification-service.js';
import { OtpService } from './otp/otp-service.js';
import { PaymentService } from './payments/payment-service.js';
import { UserPreferencesService } from './preferences/user-preferences-service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { type IdentityStore } from './repositories/identity-store.js';
import { InMemoryIdentityStore } from './repositories/in-memory-identity-store.js';
import { PrismaIdentityStore } from './repositories/prisma-identity-store.js';
import { RbacService } from './rbac/rbac-service.js';
import { TelegramBotService } from './telegram/telegram-bot.service.js';
import { IDENTITY_STORE } from './tokens.js';

@Module({
  controllers: [
    AuthController,
    AttendanceController,
    ContextController,
    HealthController,
    InvitesController,
    LinkingController,
    NotificationsController,
    PaymentsController,
    PreferencesController,
    TelegramController,
  ],
  providers: [
    PrismaService,
    PrismaIdentityStore,
    TelegramBotService,
    OtpService,
    {
      provide: IDENTITY_STORE,
      inject: [PrismaIdentityStore],
      useFactory: async (prismaStore: PrismaIdentityStore): Promise<IdentityStore> => {
        if ((process.env.APP_STORE ?? 'prisma') === 'inmemory') {
          const inMemoryStore = new InMemoryIdentityStore();
          await inMemoryStore.seedDemoData();
          return inMemoryStore;
        }

        return prismaStore;
      },
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
      inject: [TokenService, IDENTITY_STORE, OtpService],
      useFactory: (tokenService: TokenService, store: IdentityStore, otpService: OtpService) =>
        new AuthService(tokenService, store, otpService),
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
    {
      provide: AttendanceService,
      inject: [IDENTITY_STORE],
      useFactory: (store: IdentityStore) => new AttendanceService(store),
    },
    {
      provide: UserPreferencesService,
      inject: [IDENTITY_STORE],
      useFactory: (store: IdentityStore) => new UserPreferencesService(store),
    },
    {
      provide: AccountLinkService,
      inject: [IDENTITY_STORE, OtpService],
      useFactory: (store: IdentityStore, otpService: OtpService) => new AccountLinkService(store, otpService),
    },
    {
      provide: NotificationService,
      inject: [IDENTITY_STORE, RbacService, TelegramBotService],
      useFactory: (store: IdentityStore, rbac: RbacService, telegramBotService: TelegramBotService) =>
        new NotificationService(store, rbac, telegramBotService),
    },
    {
      provide: PaymentService,
      inject: [IDENTITY_STORE, AttendanceService],
      useFactory: (store: IdentityStore, attendanceService: AttendanceService) => new PaymentService(store, attendanceService),
    },
  ],
})
export class AppModule {}
