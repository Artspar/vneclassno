import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { OtpService, type OtpChannel } from '../otp/otp-service.js';
import type { IdentityStore } from '../repositories/identity-store.js';

interface TelegramLinkRequest {
  userId: string;
  expiresAt: number;
}

@Injectable()
export class AccountLinkService {
  private readonly telegramLinks = new Map<string, TelegramLinkRequest>();
  private readonly botUsername = process.env.TELEGRAM_BOT_USERNAME ?? '';
  private readonly allowLegacyOtpBypass = process.env.AUTH_ALLOW_LEGACY_OTP === 'true' || process.env.NODE_ENV !== 'production';

  constructor(
    private readonly identityStore: IdentityStore,
    private readonly otpService: OtpService,
  ) {}

  async createTelegramLink(userId: string): Promise<{ startUrl: string; token: string; expiresInSec: number }> {
    if (!this.botUsername) {
      throw new BadRequestException('TELEGRAM_BOT_USERNAME is not configured');
    }

    const token = randomBytes(16).toString('hex');
    const expiresInSec = 10 * 60;
    this.telegramLinks.set(token, {
      userId,
      expiresAt: Date.now() + expiresInSec * 1000,
    });

    return {
      token,
      expiresInSec,
      startUrl: `https://t.me/${this.botUsername}?start=link_${token}`,
    };
  }

  requestPhoneLinkOtp(phone: string, channel: string): {
    requestId: string;
    channel: OtpChannel;
    expiresInSec: number;
    destinationMasked: string;
    debugCode?: string;
  } {
    return this.otpService.requestCode(phone, channel);
  }

  async consumeTelegramLink(token: string, telegramId: string): Promise<void> {
    const record = this.telegramLinks.get(token);
    if (!record) {
      throw new BadRequestException('Link token not found');
    }

    if (record.expiresAt <= Date.now()) {
      this.telegramLinks.delete(token);
      throw new BadRequestException('Link token expired');
    }

    const existing = await this.identityStore.getUserByTelegramId(telegramId);
    if (existing && existing.id !== record.userId) {
      throw new BadRequestException('Этот Telegram уже привязан к другому аккаунту');
    }

    await this.identityStore.setUserTelegramId(record.userId, telegramId);
    this.telegramLinks.delete(token);
  }

  async linkPhone(userId: string, phone: string, otpCode: string, otpRequestId?: string): Promise<void> {
    if (otpRequestId && otpRequestId.length > 0) {
      this.otpService.verifyCode(phone, otpRequestId, otpCode);
    } else if (!(this.allowLegacyOtpBypass && otpCode === '1234')) {
      throw new BadRequestException('OTP requestId обязателен. Сначала запросите OTP код.');
    }

    const normalized = phone.trim();
    if (!normalized.startsWith('+')) {
      throw new BadRequestException('Телефон должен быть в международном формате, например +79990000001');
    }

    const existing = await this.identityStore.getUserByPhone(normalized);
    if (existing && existing.id !== userId) {
      throw new BadRequestException('Этот номер уже привязан к другому аккаунту');
    }

    await this.identityStore.setUserPhone(userId, normalized);
  }
}
