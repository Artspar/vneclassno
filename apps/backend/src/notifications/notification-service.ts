import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { UserRole } from '../domain/models.js';
import { RbacService } from '../rbac/rbac-service.js';
import type { IdentityStore } from '../repositories/identity-store.js';

type NotificationType = 'training' | 'game' | 'event';
type TargetMode = 'all' | 'selected';

interface NotificationItem {
  id: string;
  sectionId: string;
  type: NotificationType;
  title: string;
  message: string;
  targetMode: TargetMode;
  childIds: string[];
  createdByUserId: string;
  createdAt: string;
}

interface AccessContext {
  roles: UserRole[];
  sectionIds: string[];
  parentChildIds: string[];
  isSuperAdmin: boolean;
}

@Injectable()
export class NotificationService {
  private readonly notifications: NotificationItem[] = [];

  constructor(
    private readonly identityStore: IdentityStore,
    private readonly rbacService: RbacService,
  ) {}

  async create(
    userId: string,
    payload: {
      sectionId?: string;
      type?: NotificationType;
      title?: string;
      message?: string;
      targetMode?: TargetMode;
      childIds?: string[];
    },
  ) {
    const sectionId = String(payload.sectionId ?? '').trim();
    const type = payload.type;
    const title = String(payload.title ?? '').trim();
    const message = String(payload.message ?? '').trim();
    const targetMode = payload.targetMode ?? 'all';

    if (!sectionId || !type || !title || !message) {
      throw new BadRequestException('sectionId, type, title, message are required');
    }

    if (type !== 'training' && type !== 'game' && type !== 'event') {
      throw new BadRequestException('type must be training, game or event');
    }

    if (targetMode !== 'all' && targetMode !== 'selected') {
      throw new BadRequestException('targetMode must be all or selected');
    }

    await this.rbacService.assertPermission(userId, 'notifications:send', sectionId);

    const roster = await this.identityStore.listChildrenBySection(sectionId);
    const rosterIds = new Set(roster.map((child) => child.id));

    let childIds = [...rosterIds];
    if (targetMode === 'selected') {
      const requested = [...new Set((payload.childIds ?? []).map((value) => String(value).trim()).filter(Boolean))];
      if (requested.length === 0) {
        throw new BadRequestException('childIds are required for selected target mode');
      }

      for (const childId of requested) {
        if (!rosterIds.has(childId)) {
          throw new BadRequestException(`Child ${childId} is not in section ${sectionId}`);
        }
      }

      childIds = requested;
    }

    const item: NotificationItem = {
      id: randomUUID(),
      sectionId,
      type,
      title,
      message,
      targetMode,
      childIds,
      createdByUserId: userId,
      createdAt: new Date().toISOString(),
    };

    this.notifications.unshift(item);

    return {
      ...item,
      recipientsCount: childIds.length,
      channels: ['telegram', 'pwa'],
    };
  }

  async list(
    userId: string,
    filters: {
      sectionId?: string;
      childId?: string;
    },
  ) {
    const access = await this.resolveAccess(userId);
    const sectionFilter = filters.sectionId?.trim();
    const childFilter = filters.childId?.trim();

    const visible = this.notifications.filter((item) => {
      if (sectionFilter && item.sectionId !== sectionFilter) {
        return false;
      }

      const isManager = access.isSuperAdmin || this.canManageSection(access, item.sectionId);
      if (isManager) {
        if (childFilter) {
          return item.childIds.includes(childFilter);
        }
        return true;
      }

      const overlap = item.childIds.filter((childId) => access.parentChildIds.includes(childId));
      if (overlap.length === 0) {
        return false;
      }

      if (childFilter) {
        return overlap.includes(childFilter);
      }

      return true;
    });

    return {
      items: visible.map((item) => ({
        ...item,
        matchedChildIds: item.childIds.filter((childId) => access.parentChildIds.includes(childId)),
        channels: ['telegram', 'pwa'],
      })),
    };
  }

  private async resolveAccess(userId: string): Promise<AccessContext> {
    const assignments = await this.identityStore.listRoleAssignments(userId);
    const roles = [...new Set(assignments.map((item) => item.role))];
    const sectionIds = [...new Set(assignments.filter((item) => item.sectionId).map((item) => String(item.sectionId)))];

    const parentChildren = await this.identityStore.listChildrenForParent(userId);

    return {
      roles,
      sectionIds,
      parentChildIds: parentChildren.map((child) => child.id),
      isSuperAdmin: roles.includes('super_admin'),
    };
  }

  private canManageSection(access: AccessContext, sectionId: string): boolean {
    if (access.isSuperAdmin) {
      return true;
    }

    const hasManageRole = access.roles.includes('coach') || access.roles.includes('section_admin');
    if (!hasManageRole) {
      return false;
    }

    return access.sectionIds.includes(sectionId);
  }
}
