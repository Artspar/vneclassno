import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../auth/token-service.js';
import { requireUserId } from '../common/auth.js';
import { AccountLinkService } from '../linking/account-link-service.js';

@Controller('me/link')
export class LinkingController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly accountLinkService: AccountLinkService,
  ) {}

  @Post('telegram/request')
  async requestTelegramLink(@Req() request: Request) {
    const userId = requireUserId(request, this.tokenService);
    return this.accountLinkService.createTelegramLink(userId);
  }

  @Post('phone/request-otp')
  async requestPhoneLinkOtp(@Req() request: Request, @Body() body: { phone?: string; channel?: string }) {
    requireUserId(request, this.tokenService);
    return this.accountLinkService.requestPhoneLinkOtp(String(body.phone ?? ''), String(body.channel ?? 'sms'));
  }

  @Post('phone/confirm')
  async confirmPhoneLink(
    @Req() request: Request,
    @Body() body: { phone?: string; otpCode?: string; otpRequestId?: string },
  ) {
    const userId = requireUserId(request, this.tokenService);
    await this.accountLinkService.linkPhone(
      userId,
      String(body.phone ?? ''),
      String(body.otpCode ?? ''),
      body.otpRequestId ? String(body.otpRequestId) : undefined,
    );
    return { ok: true };
  }
}
