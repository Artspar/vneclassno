import { Injectable } from '@nestjs/common';
import type { UserRole } from '../domain/models.js';
import { AttendanceService } from '../attendance/attendance-service.js';
import type { IdentityStore } from '../repositories/identity-store.js';

interface AccessContext {
  roles: UserRole[];
  sectionIds: string[];
  parentChildIds: string[];
  isSuperAdmin: boolean;
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly identityStore: IdentityStore,
    private readonly attendanceService: AttendanceService,
  ) {}

  async listOptions(
    userId: string,
    filters: {
      sectionId?: string;
      childId?: string;
    },
  ) {
    const access = await this.resolveAccess(userId);
    const sectionFilter = filters.sectionId?.trim();
    const childFilter = filters.childId?.trim();

    const candidates = new Map<string, { childId: string; childName: string; sectionId: string }>();

    const canManageAny = access.isSuperAdmin || access.roles.includes('coach') || access.roles.includes('section_admin');
    if (canManageAny) {
      const managedSections = sectionFilter ? [sectionFilter] : access.isSuperAdmin ? ['section-a', 'section-b'] : access.sectionIds;
      for (const sectionId of managedSections) {
        const children = await this.identityStore.listChildrenBySection(sectionId);
        for (const child of children) {
          if (childFilter && child.id !== childFilter) {
            continue;
          }
          candidates.set(`${child.id}:${sectionId}`, {
            childId: child.id,
            childName: `${child.firstName} ${child.lastName}`,
            sectionId,
          });
        }
      }
    }

    for (const childId of access.parentChildIds) {
      if (childFilter && childFilter !== childId) {
        continue;
      }

      const childSections = await this.identityStore.listSectionIdsForChild(childId);
      const sectionIds = sectionFilter ? childSections.filter((value) => value === sectionFilter) : childSections;
      for (const sectionId of sectionIds) {
        const sectionChildren = await this.identityStore.listChildrenBySection(sectionId);
        const child = sectionChildren.find((item) => item.id === childId);
        if (!child) {
          continue;
        }

        candidates.set(`${child.id}:${sectionId}`, {
          childId: child.id,
          childName: `${child.firstName} ${child.lastName}`,
          sectionId,
        });
      }
    }

    const items = [] as Array<{
      childId: string;
      childName: string;
      sectionId: string;
      sessionId: string;
      sessionTitle: string;
      dueAt: string;
      participationStatus: 'confirmed' | 'declined' | 'not_confirmed';
      duePassed: boolean;
      canPayNow: boolean;
      canPayEarly: boolean;
      lockedReason?: string;
      recommendedMethod: 'auto_link' | 'auto_qr' | 'manual_transfer';
    }>;

    for (const candidate of candidates.values()) {
      const session = await this.attendanceService.getSectionSession(candidate.sectionId);
      const participation = await this.attendanceService.getParticipationStatus(session.id, candidate.childId);
      const duePassed = Date.parse(session.endsAt) <= Date.now();

      const isConfirmed = participation === 'confirmed';
      const canPayNow = isConfirmed;
      const canPayEarly = isConfirmed && !duePassed;

      items.push({
        childId: candidate.childId,
        childName: candidate.childName,
        sectionId: candidate.sectionId,
        sessionId: session.id,
        sessionTitle: session.title,
        dueAt: session.endsAt,
        participationStatus: participation ?? 'not_confirmed',
        duePassed,
        canPayNow,
        canPayEarly,
        lockedReason: canPayNow ? undefined : 'Оплата доступна после подтверждения участия.',
        recommendedMethod: duePassed ? 'auto_link' : 'auto_qr',
      });
    }

    return {
      items,
      rule: {
        description:
          'Доступ к оплате открыт только при подтвержденном участии. После окончания срока оплата обязательна, до срока можно оплатить заранее.',
      },
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
}
