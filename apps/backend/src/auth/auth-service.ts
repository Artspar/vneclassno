import type { UserRole } from '../domain/models.js';
import { listPermissionsByRoles } from '../rbac/permissions.js';
import type { IdentityStore } from '../repositories/identity-store.js';
import { TokenService } from './token-service.js';

interface TelegramAuthInput {
  initData: string;
}

interface PwaAuthInput {
  phone?: string;
  otpCode?: string;
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
  constructor(
    private readonly tokenService: TokenService,
    private readonly identityStore: IdentityStore,
  ) {}

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

    if ((await this.identityStore.listRoleAssignments(user.id)).length === 0) {
      await this.identityStore.addRoleAssignment({ userId: user.id, role: 'parent' });
    }

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

    const user =
      (await this.identityStore.getUserByPhone(phone)) ??
      (await this.identityStore.createUser({
        firstName: 'Pwa',
        lastName: 'User',
        phone,
      }));

    if ((await this.identityStore.listRoleAssignments(user.id)).length === 0) {
      await this.identityStore.addRoleAssignment({ userId: user.id, role: 'parent' });
    }

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
}
