import type { UserRole } from '../domain/models.js';
import { OtpService, type OtpChannel } from '../otp/otp-service.js';
import { listPermissionsByRoles } from '../rbac/permissions.js';
import type { IdentityStore } from '../repositories/identity-store.js';
import { TokenService } from './token-service.js';

interface TelegramAuthInput {
  initData: string;
}

interface PwaAuthInput {
  phone?: string;
  otpCode?: string;
  otpRequestId?: string;
  magicToken?: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    firstName: string;
    lastName?: string;
    roles: UserRole[];
    permissions: string[];
  };
}

export class AuthService {
  private readonly allowUnsafeTelegramIdFallback =
    process.env.AUTH_ALLOW_UNSAFE_TELEGRAM_ID === 'true' || process.env.NODE_ENV !== 'production';
  private readonly allowLegacyOtpBypass = process.env.AUTH_ALLOW_LEGACY_OTP === 'true' || process.env.NODE_ENV !== 'production';

  constructor(
    private readonly tokenService: TokenService,
    private readonly identityStore: IdentityStore,
    private readonly otpService: OtpService,
  ) {}

  requestPwaOtp(input: { phone?: string; channel?: string }): {
    requestId: string;
    channel: OtpChannel;
    expiresInSec: number;
    destinationMasked: string;
    debugCode?: string;
  } {
    return this.otpService.requestCode(String(input.phone ?? ''), String(input.channel ?? 'sms'));
  }

  async loginTelegram(input: TelegramAuthInput): Promise<AuthResponse> {
    const telegramId = this.extractTelegramId(input.initData);
    if (!telegramId) {
      throw new Error('Telegram initData does not contain user id');
    }

    const user =
      (await this.identityStore.getUserByTelegramId(telegramId)) ??
      (await this.identityStore.createUser({
        firstName: 'Telegram',
        lastName: 'User',
        telegramId,
      }));

    await this.ensureDefaultRoleAssignments(user.id, {
      telegramId,
      phone: user.phone,
    });

    return this.buildAuthResponse(user.id);
  }

  async loginPwa(input: PwaAuthInput): Promise<AuthResponse> {
    const byMagic = typeof input.magicToken === 'string' && input.magicToken.length > 0;
    const byOtp = Boolean(input.phone && input.otpCode);

    if (!byMagic && !byOtp) {
      throw new Error('Provide either magicToken or (phone + otpCode)');
    }

    let phone = input.phone;
    if (byMagic && !phone) {
      phone = '+79990000000';
    }

    if (!phone) {
      throw new Error('Phone is required for PWA login');
    }

    if (byOtp) {
      this.verifyOtp(phone, String(input.otpCode ?? ''), input.otpRequestId);
    }

    const user =
      (await this.identityStore.getUserByPhone(phone)) ??
      (await this.identityStore.createUser({
        firstName: 'Pwa',
        lastName: 'User',
        phone,
      }));

    await this.ensureDefaultRoleAssignments(user.id, {
      telegramId: user.telegramId,
      phone,
    });

    return this.buildAuthResponse(user.id);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const { userId } = this.tokenService.verifyRefreshToken(refreshToken);
    const user = await this.identityStore.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return this.buildAuthResponse(user.id);
  }

  private verifyOtp(phone: string, otpCode: string, otpRequestId?: string): void {
    if (otpRequestId && otpRequestId.length > 0) {
      this.otpService.verifyCode(phone, otpRequestId, otpCode);
      return;
    }

    if (otpCode === '1234' && (this.allowLegacyOtpBypass || this.isDemoPhone(phone))) {
      return;
    }

    throw new Error('OTP requestId is required. Сначала запросите OTP код.');
  }

  private async buildAuthResponse(userId: string): Promise<AuthResponse> {
    const user = await this.identityStore.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const assignments = await this.identityStore.listRoleAssignments(userId);
    const roles = assignments.map((assignment) => assignment.role);
    const permissions = listPermissionsByRoles(roles);

    const tokens = this.tokenService.issueTokens(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        permissions,
      },
    };
  }

  private extractTelegramId(initData: string): string | undefined {
    const params = new URLSearchParams(initData);
    const direct = params.get('id');
    if (direct) {
      if (!this.allowUnsafeTelegramIdFallback && !params.get('hash')) {
        throw new Error('Unsafe telegram id fallback is disabled');
      }
      return direct;
    }

    const userRaw = params.get('user');
    if (!userRaw) {
      return undefined;
    }

    try {
      const user = JSON.parse(userRaw) as { id?: number | string };
      if (typeof user.id === 'number') {
        return String(user.id);
      }
      return user.id;
    } catch {
      return undefined;
    }
  }

  private async ensureDefaultRoleAssignments(
    userId: string,
    identity: {
      telegramId?: string;
      phone?: string;
    },
  ): Promise<void> {
    const assignments = await this.identityStore.listRoleAssignments(userId);
    if (assignments.length > 0) {
      return;
    }

    const coachIds = this.readCsvEnv('DEMO_COACH_TELEGRAM_IDS', ['1001']);
    const sectionAdminIds = this.readCsvEnv('DEMO_SECTION_ADMIN_TELEGRAM_IDS', ['1002']);
    const coachPhones = this.readCsvEnv('DEMO_COACH_PHONES', ['+79990000002']);
    const sectionAdminPhones = this.readCsvEnv('DEMO_SECTION_ADMIN_PHONES', ['+79990000003']);

    const coachSectionId = process.env.DEMO_COACH_SECTION_ID?.trim() || 'section-a';
    const sectionAdminSectionId = process.env.DEMO_SECTION_ADMIN_SECTION_ID?.trim() || 'section-b';

    const isCoach =
      (identity.telegramId ? coachIds.includes(identity.telegramId) : false) ||
      (identity.phone ? coachPhones.includes(identity.phone) : false);
    const isSectionAdmin =
      (identity.telegramId ? sectionAdminIds.includes(identity.telegramId) : false) ||
      (identity.phone ? sectionAdminPhones.includes(identity.phone) : false);

    if (isSectionAdmin) {
      await this.identityStore.addRoleAssignment({
        userId,
        role: 'section_admin',
        sectionId: sectionAdminSectionId,
      });
      return;
    }

    if (isCoach) {
      await this.identityStore.addRoleAssignment({
        userId,
        role: 'coach',
        sectionId: coachSectionId,
      });
      return;
    }

    await this.identityStore.addRoleAssignment({ userId, role: 'parent' });
  }


  private isDemoPhone(phone: string): boolean {
    const demoParents = this.readCsvEnv('DEMO_PARENT_PHONES', ['+79990000001']);
    const demoCoaches = this.readCsvEnv('DEMO_COACH_PHONES', ['+79990000002']);
    const demoSectionAdmins = this.readCsvEnv('DEMO_SECTION_ADMIN_PHONES', ['+79990000003']);
    const all = new Set([...demoParents, ...demoCoaches, ...demoSectionAdmins]);
    return all.has(phone);
  }

  private readCsvEnv(key: string, fallback: string[] = []): string[] {
    const raw = process.env[key]?.trim();
    if (!raw) {
      return fallback;
    }

    return raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
}
