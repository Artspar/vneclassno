import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health(): { ok: true; store: string } {
    return {
      ok: true,
      store: process.env.APP_STORE ?? 'prisma',
    };
  }
}
