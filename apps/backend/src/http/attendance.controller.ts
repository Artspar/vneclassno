import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../auth/token-service.js';
import { AttendanceService } from '../attendance/attendance-service.js';
import { requireUserId } from '../common/auth.js';

@Controller()
export class AttendanceController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly attendanceService: AttendanceService,
  ) {}

  @Get('attendance/board')
  async board(@Req() request: Request, @Query('sectionId') sectionId?: string) {
    const userId = requireUserId(request, this.tokenService);
    return this.attendanceService.getBoard(userId, sectionId);
  }

  @Post('attendance/bulk-update')
  async bulkUpdate(
    @Req() request: Request,
    @Body()
    body: {
      sessionId?: string;
      updates?: Array<{
        childId?: string;
        status?: 'expected' | 'present' | 'late' | 'absent';
      }>;
    },
  ) {
    const userId = requireUserId(request, this.tokenService);
    return this.attendanceService.bulkUpdate(userId, body);
  }

  @Post('sessions/participation/confirm')
  async confirmParticipation(
    @Req() request: Request,
    @Body() body: { sessionId?: string; childId?: string; decision?: 'confirmed' | 'declined' },
  ) {
    const userId = requireUserId(request, this.tokenService);
    return this.attendanceService.confirmParticipation(userId, body);
  }

  @Post('absence/request')
  async requestAbsence(
    @Req() request: Request,
    @Body() body: { sessionId?: string; childId?: string; reason?: string },
  ) {
    const userId = requireUserId(request, this.tokenService);
    return this.attendanceService.requestAbsence(userId, body);
  }

  @Post('absence/:absenceId/decision')
  async decideAbsence(
    @Req() request: Request,
    @Param('absenceId') absenceId: string,
    @Body()
    body: {
      decision?: 'approved' | 'rejected';
      isExcused?: boolean;
    },
  ) {
    const userId = requireUserId(request, this.tokenService);
    return this.attendanceService.decideAbsence(userId, absenceId, body);
  }
}
