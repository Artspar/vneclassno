import { Body, Controller, Get, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../auth/token-service.js';
import { requireUserId } from '../common/auth.js';
import { ParentContextService } from '../context/parent-context-service.js';
import { UserPreferencesService } from '../preferences/user-preferences-service.js';
import { IDENTITY_STORE } from '../tokens.js';
import type { IdentityStore } from '../repositories/identity-store.js';

@Controller()
export class ContextController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly parentContextService: ParentContextService,
    private readonly userPreferencesService: UserPreferencesService,
    @Inject(IDENTITY_STORE) private readonly identityStore: IdentityStore,
  ) {}

  @Get('me/context')
  async meContext(@Req() request: Request) {
    const userId = requireUserId(request, this.tokenService);
    const user = await this.identityStore.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const assignments = await this.identityStore.listRoleAssignments(userId);
    const roles = [...new Set(assignments.map((item) => item.role))];
    const isParent = roles.includes('parent');

    const children = isParent
      ? (await this.identityStore.listChildrenForParent(userId)).map((child) => ({
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
        }))
      : [];

    const sectionIds = new Set<string>();
    for (const assignment of assignments) {
      if (assignment.sectionId) {
        sectionIds.add(assignment.sectionId);
      }
    }

    if (isParent) {
      const parentChildren = await this.identityStore.listChildrenForParent(userId);
      for (const child of parentChildren) {
        const childSectionIds = await this.identityStore.listSectionIdsForChild(child.id);
        for (const sectionId of childSectionIds) {
          sectionIds.add(sectionId);
        }
      }
    }

    const sections = (await this.identityStore.listSectionsByIds([...sectionIds])).map((section) => ({
      id: section.id,
      name: section.name,
    }));

    const context = isParent ? await this.parentContextService.getContext(userId) : undefined;
    const selection = await this.userPreferencesService.getContextSelection(userId);

    return {
      userId,
      roles,
      hasLinkedPhone: Boolean(user.phone),
      hasLinkedTelegram: Boolean(user.telegramId),
      children,
      sections,
      activeChildId: selection.activeChildId ?? context?.activeChildId,
      activeSectionId: selection.activeSectionId ?? context?.activeSectionId,
    };
  }

  @Post('context/select')
  async setContext(
    @Req() request: Request,
    @Body() body: { activeChildId?: string; activeSectionId?: string },
  ) {
    const userId = requireUserId(request, this.tokenService);

    return this.parentContextService.setContext(userId, {
      activeChildId: body.activeChildId,
      activeSectionId: body.activeSectionId,
    });
  }
}
