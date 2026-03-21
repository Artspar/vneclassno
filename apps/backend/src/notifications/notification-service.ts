import { BadRequestException, Injectable } from '@nestjs/common';
import { AttendanceService } from '../attendance/attendance-service.js';
import { randomUUID } from 'node:crypto';
import type { UserRole } from '../domain/models.js';
import { RbacService } from '../rbac/rbac-service.js';
import type { IdentityStore } from '../repositories/identity-store.js';
import { TelegramBotService } from '../telegram/telegram-bot.service.js';

type NotificationType = 'training' | 'game' | 'event';
type TargetMode = 'all' | 'selected';

interface NotificationDelivery {
  attempted: number;
  delivered: number;
  failed: number;
}

interface NotificationItem {
  id: string;
  sectionId: string;
  sessionId?: string;
  type: NotificationType;
  title: string;
  message: string;
  targetMode: TargetMode;
  childIds: string[];
  createdByUserId: string;
  createdAt: string;
  delivery: NotificationDelivery;
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
  private readonly readByNotificationId = new Map<string, Set<string>>();

  constructor(
    private readonly identityStore: IdentityStore,
    private readonly rbacService: RbacService,
    private readonly telegramBotService: TelegramBotService,
    private readonly attendanceService: AttendanceService,
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

    let sessionId: string | undefined;
    if (type === 'training' || type === 'game') {
      sessionId = (await this.attendanceService.getSectionSession(sectionId).catch(() => undefined))?.id;
    }

    const delivery = await this.deliverToTelegram(
      {
        id: randomUUID(),
        sectionId,
        sessionId,
        type,
        title,
        message,
        targetMode,
        childIds,
        createdByUserId: userId,
        createdAt: new Date().toISOString(),
        delivery: {
          attempted: 0,
          delivered: 0,
          failed: 0,
        },
      },
      roster,
    );

    const item: NotificationItem = {
      id: randomUUID(),
      sectionId,
      sessionId,
      type,
      title,
      message,
      targetMode,
      childIds,
      createdByUserId: userId,
      createdAt: new Date().toISOString(),
      delivery,
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

    const visible = this.notifications.filter((item) => this.isVisibleForUser(item, access, sectionFilter, childFilter));

    const items = await Promise.all(
      visible.map(async (item) => {
        const matchedChildIds = item.childIds.filter((childId) => access.parentChildIds.includes(childId));
        const isManager = access.isSuperAdmin || this.canManageSection(access, item.sectionId);

        const readBy = this.readByNotificationId.get(item.id);
        const isRead = isManager ? false : (readBy?.has(userId) ?? false);

        let participationSummary:
          | {
              confirmed: number;
              declined: number;
              notConfirmed: number;
            }
          | undefined;

        if (item.sessionId) {
          const targetChildIds = isManager ? item.childIds : matchedChildIds;
          let confirmed = 0;
          let declined = 0;
          let notConfirmed = 0;

          for (const childId of targetChildIds) {
            const status = await this.attendanceService.getParticipationStatus(item.sessionId, childId);
            if (status === 'confirmed') {
              confirmed += 1;
            } else if (status === 'declined') {
              declined += 1;
            } else {
              notConfirmed += 1;
            }
          }

          participationSummary = {
            confirmed,
            declined,
            notConfirmed,
          };
        }

        return {
          ...item,
          matchedChildIds,
          isRead,
          participationSummary,
          channels: ['telegram', 'pwa'] as const,
        };
      }),
    );

    return {
      unreadCount: items.filter((item) => !item.isRead).length,
      items,
    };
  }

  async markRead(userId: string, notificationId: string) {
    const item = this.notifications.find((entry) => entry.id === notificationId);
    if (!item) {
      throw new BadRequestException('Notification not found');
    }

    const access = await this.resolveAccess(userId);
    if (!this.isVisibleForUser(item, access)) {
      throw new BadRequestException('Notification is not visible for this user');
    }

    const isManager = access.isSuperAdmin || this.canManageSection(access, item.sectionId);
    if (isManager) {
      return { id: notificationId, isRead: false };
    }

    const readBy = this.readByNotificationId.get(notificationId) ?? new Set<string>();
    readBy.add(userId);
    this.readByNotificationId.set(notificationId, readBy);

    return {
      id: notificationId,
      isRead: true,
    };
  }

  private async deliverToTelegram(
    item: NotificationItem,
    roster: Array<{ id: string; firstName: string; lastName: string }>,
  ): Promise<NotificationDelivery> {
    const section = await this.identityStore.getSectionById(item.sectionId);
    const typeLabel = item.type === 'training' ? 'Тренировка' : item.type === 'game' ? 'Игра' : 'Мероприятие';

    const targetNames = roster
      .filter((child) => item.childIds.includes(child.id))
      .map((child) => `${child.firstName} ${child.lastName}`);

    const text = [
      `🔔 ${typeLabel}: ${item.title}`,
      section ? `Секция: ${section.name}` : `Секция: ${item.sectionId}`,
      `Кому: ${item.targetMode === 'all' ? 'всем детям секции' : targetNames.join(', ')}`,
      '',
      item.message,
    ].join('\n');

    const chatIds = new Set<string>();
    for (const childId of item.childIds) {
      const parents = await this.identityStore.listParentsForChild(childId);
      for (const parent of parents) {
        if (parent.telegramId) {
          chatIds.add(parent.telegramId);
        }
      }
    }

    let delivered = 0;
    let failed = 0;
    for (const chatId of chatIds) {
      try {
        await this.telegramBotService.sendInfo(Number(chatId), text);
        delivered += 1;
      } catch {
        failed += 1;
      }
    }

    return {
      attempted: chatIds.size,
      delivered,
      failed,
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

  private isVisibleForUser(
    item: NotificationItem,
    access: AccessContext,
    sectionFilter?: string,
    childFilter?: string,
  ): boolean {
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
  }
}
