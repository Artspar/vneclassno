import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../auth/token-service.js';
import { requireUserId } from '../common/auth.js';
import { InviteService } from '../invites/invite-service.js';

@Controller()
export class InvitesController {
  constructor(
    private readonly inviteService: InviteService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('invites')
  async createInvite(
    @Req() request: Request,
    @Body() body: { sectionId?: string; allowParentReshare?: boolean; expiresAt?: string; childId?: string },
  ) {
    const userId = requireUserId(request, this.tokenService);

    return this.inviteService.createInvite({
      actorUserId: userId,
      sectionId: String(body.sectionId ?? ''),
      allowParentReshare: body.allowParentReshare,
      expiresAt: body.expiresAt,
      childId: body.childId,
    });
  }

  @Get('invites/:token')
  async resolveInvite(@Param('token') token: string) {
    return this.inviteService.resolveInvite(token);
  }

  @Post('invites/:token/accept')
  async acceptInvite(
    @Req() request: Request,
    @Param('token') token: string,
    @Body()
    body: {
      childId?: string;
      newChild?: { firstName?: string; lastName?: string; birthDate?: string };
    },
  ) {
    const userId = requireUserId(request, this.tokenService);

    return this.inviteService.acceptInvite({
      actorUserId: userId,
      token,
      childId: body.childId,
      newChild: body.newChild
        ? {
            firstName: String(body.newChild.firstName ?? ''),
            lastName: String(body.newChild.lastName ?? ''),
            birthDate: body.newChild.birthDate,
          }
        : undefined,
    });
  }

  @Post('join-requests/:requestId/decision')
  async decideJoinRequest(
    @Req() request: Request,
    @Param('requestId') requestId: string,
    @Body() body: { decision?: 'approved' | 'rejected'; comment?: string },
  ) {
    const userId = requireUserId(request, this.tokenService);

    if (body.decision !== 'approved' && body.decision !== 'rejected') {
      throw new Error('Decision must be approved or rejected');
    }

    return this.inviteService.decideJoinRequest({
      actorUserId: userId,
      requestId,
      decision: body.decision,
      comment: body.comment,
    });
  }
}
