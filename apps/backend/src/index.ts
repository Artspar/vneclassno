import { AuthService } from './auth/auth-service.js';
import { TokenService } from './auth/token-service.js';
import { ParentContextService } from './context/parent-context-service.js';
import { InviteService } from './invites/invite-service.js';
import { OtpService } from './otp/otp-service.js';
import { InMemoryIdentityStore } from './repositories/in-memory-identity-store.js';
import { RbacService } from './rbac/rbac-service.js';
import { TelegramBotService } from './telegram/telegram-bot.service.js';

const accessSecret = process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret';
const refreshSecret = process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret';

export const identityStore = new InMemoryIdentityStore();
await identityStore.seedDemoData();

export const tokenService = new TokenService(accessSecret, refreshSecret);
export const otpService = new OtpService();

export const authService = new AuthService(tokenService, identityStore, otpService);
export const parentContextService = new ParentContextService(identityStore);
export const rbacService = new RbacService(identityStore);
export const telegramBotService = new TelegramBotService();
export const inviteService = new InviteService(identityStore, rbacService, telegramBotService);
