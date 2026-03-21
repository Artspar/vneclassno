import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../auth/token-service.js';
import { requireUserId } from '../common/auth.js';
import { UserPreferencesService } from '../preferences/user-preferences-service.js';

@Controller('me/preferences')
export class PreferencesController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly userPreferencesService: UserPreferencesService,
  ) {}

  @Get()
  async getPreferences(@Req() request: Request) {
    const userId = requireUserId(request, this.tokenService);
    return this.userPreferencesService.getPreferences(userId);
  }

  @Post('role')
  async setActiveRole(@Req() request: Request, @Body() body: { activeRole?: string }) {
    const userId = requireUserId(request, this.tokenService);
    return this.userPreferencesService.setActiveRole(userId, String(body.activeRole ?? ''));
  }
}
