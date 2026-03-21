import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../auth/token-service.js';
import { requireUserId } from '../common/auth.js';
import { PaymentService } from '../payments/payment-service.js';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get('options')
  async options(@Req() request: Request, @Query('sectionId') sectionId?: string, @Query('childId') childId?: string) {
    const userId = requireUserId(request, this.tokenService);
    return this.paymentService.listOptions(userId, { sectionId, childId });
  }
}
