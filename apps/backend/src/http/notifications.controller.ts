import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../auth/token-service.js';
import { requireUserId } from '../common/auth.js';
import { NotificationService } from '../notifications/notification-service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly notificationService: NotificationService,
  ) {}

  @Get()
  async list(@Req() request: Request, @Query('sectionId') sectionId?: string, @Query('childId') childId?: string) {
    const userId = requireUserId(request, this.tokenService);
    return this.notificationService.list(userId, { sectionId, childId });
  }

  @Post(':notificationId/read')
  async markRead(@Req() request: Request, @Param('notificationId') notificationId: string) {
    const userId = requireUserId(request, this.tokenService);
    return this.notificationService.markRead(userId, notificationId);
  }

  @Post()
  async create(
    @Req() request: Request,
    @Body()
    body: {
      sectionId?: string;
      type?: 'training' | 'game' | 'event';
      title?: string;
      message?: string;
      targetMode?: 'all' | 'selected';
      childIds?: string[];
    },
  ) {
    const userId = requireUserId(request, this.tokenService);
    return this.notificationService.create(userId, body);
  }
}
