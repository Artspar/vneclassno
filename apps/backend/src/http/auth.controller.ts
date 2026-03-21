import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth-service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  async telegram(@Body() body: { initData?: string }) {
    return this.authService.loginTelegram({ initData: String(body.initData ?? '') });
  }

  @Post('pwa/request-otp')
  async requestPwaOtp(@Body() body: { phone?: string; channel?: string }) {
    return this.authService.requestPwaOtp({
      phone: body.phone,
      channel: body.channel,
    });
  }

  @Post('pwa/login')
  async pwaLogin(
    @Body()
    body: {
      phone?: string;
      otpCode?: string;
      otpRequestId?: string;
      magicToken?: string;
    },
  ) {
    return this.authService.loginPwa({
      phone: body.phone,
      otpCode: body.otpCode,
      otpRequestId: body.otpRequestId,
      magicToken: body.magicToken,
    });
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken?: string }) {
    return this.authService.refresh(String(body.refreshToken ?? ''));
  }
}
