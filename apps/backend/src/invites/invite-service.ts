import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { IdentityStore } from '../repositories/identity-store.js';
import { RbacService } from '../rbac/rbac-service.js';
import { TelegramBotService } from '../telegram/telegram-bot.service.js';

interface CreateInviteInput {
  actorUserId: string;
  sectionId: string;
  allowParentReshare?: boolean;
  expiresAt?: string;
  childId?: string;
}

interface AcceptInviteInput {
  actorUserId: string;
  token: string;
  childId?: string;
  newChild?: {
    firstName: string;
    lastName: string;
    birthDate?: string;
  };
}

export class InviteService {
  constructor(
    private readonly store: IdentityStore,
    private readonly rbac: RbacService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  async createInvite(input: CreateInviteInput) {
    const section = await this.store.getSectionById(input.sectionId);
    if (!section) {
      throw new BadRequestException('Section not found');
    }

    const actorAssignments = await this.store.listRoleAssignments(input.actorUserId);
    const actorRoles = actorAssignments.map((item) => item.role);
    const actorIsParentOnly = actorRoles.length > 0 && actorRoles.every((role) => role === 'parent');

    if (actorIsParentOnly) {
      if (!section.allowParentReshareInvites) {
        throw new BadRequestException('Parent reshare invites are disabled for this section');
      }

      if (!input.childId) {
        throw new BadRequestException('childId is required for parent reshare link');
      }

      const parentChildren = await this.store.listChildrenForParent(input.actorUserId);
      if (!parentChildren.some((child) => child.id === input.childId)) {
        throw new BadRequestException('Parent can share only own child');
      }

      const childSections = await this.store.listSectionIdsForChild(input.childId);
      if (!childSections.includes(input.sectionId)) {
        throw new BadRequestException('Child is not linked to selected section');
      }
    } else {
      await this.rbac.assertPermission(input.actorUserId, 'notifications:send', input.sectionId);

      if (input.childId) {
        const sectionChildren = await this.store.listChildrenBySection(input.sectionId);
        if (!sectionChildren.some((child) => child.id === input.childId)) {
          throw new BadRequestException('Child is not linked to selected section');
        }
      }
    }

    const invite = await this.store.createInvite({
      sectionId: input.sectionId,
      createdByUserId: input.actorUserId,
      allowParentReshare: input.allowParentReshare ?? section.allowParentReshareInvites,
      expiresAt: input.expiresAt,
    });

    const pwaBase = (process.env.PWA_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
    const pwaUrl = new URL(`${pwaBase}/invite/${encodeURIComponent(invite.token)}`);
    if (input.childId) {
      pwaUrl.searchParams.set('childId', input.childId);
      pwaUrl.searchParams.set('mode', 'add_parent');
    }

    return {
      ...invite,
      pwaInviteUrl: pwaUrl.toString(),
      telegramStartAppUrl: this.telegramBotService.getInviteStartAppUrl(invite.token),
      telegramMiniAppUrl: this.telegramBotService.getMiniAppDirectUrl(invite.token),
      childId: input.childId,
      mode: input.childId ? 'add_parent' : 'join_section',
    };
  }

  async resolveInvite(token: string) {
    const invite = await this.store.getInviteByToken(token);
    if (!invite) {
      throw new BadRequestException('Invite not found');
    }

    if (invite.status !== 'active') {
      throw new BadRequestException(`Invite is ${invite.status}`);
    }

    return {
      invite,
      authRequired: true,
      suggestedClient: 'pwa' as const,
    };
  }

  async acceptInvite(input: AcceptInviteInput) {
    const invite = await this.store.getInviteByToken(input.token);
    if (!invite || invite.status !== 'active') {
      throw new BadRequestException('Invite is not active');
    }

    let resolvedChildId = input.childId;
    if (!resolvedChildId && input.newChild) {
      const child = await this.store.createChild({
        firstName: input.newChild.firstName,
        lastName: input.newChild.lastName,
        birthDate: input.newChild.birthDate,
      });
      resolvedChildId = child.id;
    }

    if (!resolvedChildId) {
      throw new BadRequestException('Provide childId or newChild');
    }

    const section = await this.store.getSectionById(invite.sectionId);
    if (!section) {
      throw new BadRequestException('Section not found');
    }

    const parentChildren = await this.store.listChildrenForParent(input.actorUserId);
    const hasChild = parentChildren.some((child) => child.id === resolvedChildId);
    if (!hasChild) {
      const childSections = await this.store.listSectionIdsForChild(resolvedChildId);
      const childAlreadyInSection = childSections.includes(section.id);

      if (childAlreadyInSection) {
        if (!invite.allowParentReshare) {
          throw new BadRequestException('Invite does not allow linking second parent to existing child');
        }
        await this.store.linkParentToChild(input.actorUserId, resolvedChildId);
        return {
          id: randomUUID(),
          sectionId: section.id,
          childId: resolvedChildId,
          createdByUserId: input.actorUserId,
          status: 'auto_approved' as const,
          createdAt: new Date().toISOString(),
        };
      }

      await this.store.linkParentToChild(input.actorUserId, resolvedChildId);
    }

    if (section.autoAcceptJoinRequests) {
      await this.store.linkChildToSection(resolvedChildId, section.id);
      return this.store.createJoinRequest({
        sectionId: section.id,
        childId: resolvedChildId,
        createdByUserId: input.actorUserId,
        status: 'auto_approved',
      });
    }

    return this.store.createJoinRequest({
      sectionId: section.id,
      childId: resolvedChildId,
      createdByUserId: input.actorUserId,
      status: 'pending',
    });
  }

  async decideJoinRequest(input: {
    actorUserId: string;
    requestId: string;
    decision: 'approved' | 'rejected';
    comment?: string;
  }) {
    const request = await this.store.getJoinRequestById(input.requestId);
    if (!request) {
      throw new BadRequestException('Join request not found');
    }

    await this.rbac.assertPermission(input.actorUserId, 'admin:manage_section', request.sectionId);

    return this.store.decideJoinRequest({
      requestId: request.id,
      decidedByUserId: input.actorUserId,
      decision: input.decision,
      comment: input.comment,
    });
  }

  async createShareInviteFromParent(input: { actorUserId: string; sectionId: string; expiresAt?: string }) {
    const section = await this.store.getSectionById(input.sectionId);
    if (!section) {
      throw new BadRequestException('Section not found');
    }

    if (!section.allowParentReshareInvites) {
      throw new BadRequestException('Section does not allow parent reshare invites');
    }

    return this.store.createInvite({
      sectionId: input.sectionId,
      createdByUserId: input.actorUserId,
      allowParentReshare: true,
      expiresAt: input.expiresAt,
    });
  }

  async demoCreatePublicInvite(sectionId: string): Promise<string> {
    const invite = await this.store.createInvite({
      sectionId,
      createdByUserId: randomUUID(),
      allowParentReshare: true,
    });
    return `https://app.vneclassno.ru/invite/${invite.token}`;
  }
}
