import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';

export type OtpChannel = 'sms' | 'telegram' | 'vk';

interface OtpRequest {
  id: string;
  phone: string;
  channel: OtpChannel;
  code: string;
  expiresAt: number;
  attemptsLeft: number;
}

@Injectable()
export class OtpService {
  private readonly requests = new Map<string, OtpRequest>();
  private readonly ttlSec = Number(process.env.OTP_TTL_SEC ?? 300);
  private readonly maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
  private readonly exposeCode = process.env.OTP_EXPOSE_CODE === 'true' || process.env.NODE_ENV !== 'production';

  requestCode(phoneRaw: string, channelRaw: string): {
    requestId: string;
    channel: OtpChannel;
    expiresInSec: number;
    destinationMasked: string;
    debugCode?: string;
  } {
    const phone = this.normalizePhone(phoneRaw);
    const channel = this.normalizeChannel(channelRaw);
    const requestId = randomUUID();
    const code = String(randomInt(1000, 9999));

    this.requests.set(requestId, {
      id: requestId,
      phone,
      channel,
      code,
      expiresAt: Date.now() + this.ttlSec * 1000,
      attemptsLeft: this.maxAttempts,
    });

    return {
      requestId,
      channel,
      expiresInSec: this.ttlSec,
      destinationMasked: this.maskPhone(phone),
      debugCode: this.exposeCode ? code : undefined,
    };
  }

  verifyCode(phoneRaw: string, requestId: string, otpCodeRaw: string): void {
    const phone = this.normalizePhone(phoneRaw);
    const otpCode = String(otpCodeRaw ?? '').trim();
    const request = this.requests.get(requestId);

    if (!request) {
      throw new BadRequestException('OTP сессия не найдена');
    }

    if (request.expiresAt <= Date.now()) {
      this.requests.delete(requestId);
      throw new BadRequestException('OTP код истек');
    }

    if (request.phone !== phone) {
      throw new BadRequestException('Телефон не совпадает с OTP сессией');
    }

    if (request.attemptsLeft <= 0) {
      this.requests.delete(requestId);
      throw new HttpException('Превышено число попыток. Запросите новый OTP код', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (request.code !== otpCode) {
      request.attemptsLeft -= 1;
      if (request.attemptsLeft <= 0) {
        this.requests.delete(requestId);
        throw new HttpException('Превышено число попыток. Запросите новый OTP код', HttpStatus.TOO_MANY_REQUESTS);
      }

      throw new BadRequestException(`Неверный OTP код. Осталось попыток: ${request.attemptsLeft}`);
    }

    this.requests.delete(requestId);
  }

  private normalizePhone(phoneRaw: string): string {
    const normalized = String(phoneRaw ?? '').trim();
    if (!/^\+[1-9][0-9]{7,14}$/.test(normalized)) {
      throw new BadRequestException('Телефон должен быть в международном формате, например +79990000001');
    }

    return normalized;
  }

  private normalizeChannel(channelRaw: string): OtpChannel {
    if (channelRaw === 'sms' || channelRaw === 'telegram' || channelRaw === 'vk') {
      return channelRaw;
    }

    throw new BadRequestException('Неподдерживаемый OTP канал');
  }

  private maskPhone(phone: string): string {
    if (phone.length < 6) {
      return phone;
    }

    return `${phone.slice(0, 2)}***${phone.slice(-2)}`;
  }
}
