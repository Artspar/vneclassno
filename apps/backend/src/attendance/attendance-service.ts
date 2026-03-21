import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { UserRole } from '../domain/models.js';
import type { IdentityStore } from '../repositories/identity-store.js';

type AttendanceStatus = 'expected' | 'present' | 'late' | 'absent';
type SessionStatus = 'scheduled' | 'live' | 'completed';

interface SessionItem {
  id: string;
  sectionId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
}

interface AttendanceMark {
  sessionId: string;
  childId: string;
  status: AttendanceStatus;
  updatedByUserId: string;
  updatedAt: string;
}

interface AbsenceRequest {
  id: string;
  sessionId: string;
  childId: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  requestedByUserId: string;
  decidedByUserId?: string;
  decidedAt?: string;
  isExcused?: boolean;
}

interface AccessContext {
  roles: UserRole[];
  sectionIds: string[];
  parentChildIds: string[];
  isSuperAdmin: boolean;
}

@Injectable()
export class AttendanceService {
  private initialized = false;
  private sessions: SessionItem[] = [];
  private marks: AttendanceMark[] = [];
  private absences: AbsenceRequest[] = [];

  constructor(private readonly identityStore: IdentityStore) {}

  async getBoard(userId: string, sectionId?: string) {
    await this.ensureSeeded();
    const access = await this.resolveAccess(userId);

    const resolvedSectionId = await this.resolveSectionId(sectionId, access);
    if (!resolvedSectionId) {
      throw new BadRequestException('Не удалось определить секцию для таба посещений.');
    }

    if (!(await this.canReadSection(access, resolvedSectionId))) {
      throw new ForbiddenException('Нет доступа к секции');
    }

    const roster = await this.identityStore.listChildrenBySection(resolvedSectionId);
    const session = this.pickSessionForSection(resolvedSectionId);

    const items = roster.map((child) => {
      const mark = this.marks.find((entry) => entry.sessionId === session.id && entry.childId === child.id);
      const absence = this.absences.find((entry) => entry.sessionId === session.id && entry.childId === child.id);

      return {
        childId: child.id,
        childName: `${child.firstName} ${child.lastName}`,
        status: mark?.status ?? 'expected',
        onLesson: session.status === 'live' && (mark?.status === 'present' || mark?.status === 'late'),
        absenceId: absence?.id,
        absenceStatus: absence?.status,
        isExcused: absence?.status === 'approved' ? Boolean(absence?.isExcused) : undefined,
      };
    });

    const canManage = this.canManageSection(access, resolvedSectionId);

    return {
      sectionId: resolvedSectionId,
      session,
      canManage,
      items,
    };
  }

  async bulkUpdate(
    userId: string,
    payload: {
      sessionId?: string;
      updates?: Array<{ childId?: string; status?: AttendanceStatus }>;
    },
  ) {
    const sessionId = payload.sessionId?.trim();
    if (!sessionId) {
      throw new BadRequestException('sessionId is required');
    }

    const updates = payload.updates ?? [];
    if (updates.length === 0) {
      throw new BadRequestException('updates should not be empty');
    }

    const session = this.sessions.find((item) => item.id === sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const access = await this.resolveAccess(userId);
    if (!this.canManageSection(access, session.sectionId)) {
      throw new ForbiddenException('Нет прав на отметку посещения');
    }

    const roster = await this.identityStore.listChildrenBySection(session.sectionId);
    const childIds = new Set(roster.map((child) => child.id));

    for (const item of updates) {
      const childId = item.childId?.trim() ?? '';
      const status = item.status;

      if (!childId || !status) {
        throw new BadRequestException('Each update requires childId and status');
      }

      if (!childIds.has(childId)) {
        throw new BadRequestException(`Child ${childId} is not in this section`);
      }

      const existing = this.marks.find((entry) => entry.sessionId === session.id && entry.childId === childId);
      if (existing) {
        existing.status = status;
        existing.updatedByUserId = userId;
        existing.updatedAt = new Date().toISOString();
      } else {
        this.marks.push({
          sessionId: session.id,
          childId,
          status,
          updatedByUserId: userId,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return this.getBoard(userId, session.sectionId);
  }

  async requestAbsence(
    userId: string,
    payload: {
      sessionId?: string;
      childId?: string;
      reason?: string;
    },
  ) {
    const sessionId = payload.sessionId?.trim();
    const childId = payload.childId?.trim();
    if (!sessionId || !childId) {
      throw new BadRequestException('sessionId and childId are required');
    }

    const session = this.sessions.find((item) => item.id === sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const access = await this.resolveAccess(userId);
    const isParentChild = access.parentChildIds.includes(childId);
    const canManage = this.canManageSection(access, session.sectionId);
    if (!isParentChild && !canManage) {
      throw new ForbiddenException('Нет прав создать отсутствие для этого ребенка');
    }

    const roster = await this.identityStore.listChildrenBySection(session.sectionId);
    if (!roster.some((child) => child.id === childId)) {
      throw new BadRequestException('Ребенок не привязан к секции сессии');
    }

    const existing = this.absences.find((entry) => entry.sessionId === session.id && entry.childId === childId);
    if (existing) {
      existing.status = 'pending';
      existing.reason = payload.reason?.trim() || undefined;
      existing.requestedByUserId = userId;
      existing.decidedByUserId = undefined;
      existing.decidedAt = undefined;
      existing.isExcused = undefined;
      return existing;
    }

    const absence: AbsenceRequest = {
      id: randomUUID(),
      sessionId: session.id,
      childId,
      status: 'pending',
      reason: payload.reason?.trim() || undefined,
      requestedByUserId: userId,
    };
    this.absences.push(absence);
    return absence;
  }

  async decideAbsence(
    userId: string,
    absenceId: string,
    payload: {
      decision?: 'approved' | 'rejected';
      isExcused?: boolean;
    },
  ) {
    const absence = this.absences.find((entry) => entry.id === absenceId);
    if (!absence) {
      throw new NotFoundException('Absence request not found');
    }

    const session = this.sessions.find((item) => item.id === absence.sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const access = await this.resolveAccess(userId);
    if (!this.canManageSection(access, session.sectionId)) {
      throw new ForbiddenException('Нет прав на решение по отсутствию');
    }

    if (payload.decision !== 'approved' && payload.decision !== 'rejected') {
      throw new BadRequestException('decision must be approved or rejected');
    }

    absence.status = payload.decision;
    absence.decidedByUserId = userId;
    absence.decidedAt = new Date().toISOString();
    absence.isExcused = payload.decision === 'approved' ? payload.isExcused ?? true : false;

    return absence;
  }

  private async ensureSeeded() {
    if (this.initialized) {
      return;
    }

    const now = Date.now();
    this.sessions = [
      {
        id: 'session-a-live',
        sectionId: 'section-a',
        title: 'Тренировка · Football A',
        startsAt: new Date(now - 30 * 60 * 1000).toISOString(),
        endsAt: new Date(now + 60 * 60 * 1000).toISOString(),
        status: 'live',
      },
      {
        id: 'session-b-next',
        sectionId: 'section-b',
        title: 'Тренировка · Basketball B',
        startsAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
        status: 'scheduled',
      },
    ];

    this.initialized = true;
  }

  private async resolveAccess(userId: string): Promise<AccessContext> {
    const assignments = await this.identityStore.listRoleAssignments(userId);
    const roles = [...new Set(assignments.map((item) => item.role))];
    const sectionIds = [
      ...new Set(assignments.filter((item) => item.sectionId).map((item) => String(item.sectionId))),
    ];

    const parentChildren = await this.identityStore.listChildrenForParent(userId);

    return {
      roles,
      sectionIds,
      parentChildIds: parentChildren.map((child) => child.id),
      isSuperAdmin: roles.includes('super_admin'),
    };
  }

  private async canReadSection(access: AccessContext, sectionId: string): Promise<boolean> {
    if (access.isSuperAdmin || this.canManageSection(access, sectionId)) {
      return true;
    }

    for (const childId of access.parentChildIds) {
      const childSections = await this.identityStore.listSectionIdsForChild(childId);
      if (childSections.includes(sectionId)) {
        return true;
      }
    }

    return false;
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

  private pickSessionForSection(sectionId: string): SessionItem {
    const inSection = this.sessions.filter((session) => session.sectionId === sectionId);
    const live = inSection.find((session) => session.status === 'live');
    if (live) {
      return live;
    }

    const scheduled = inSection.find((session) => session.status === 'scheduled');
    if (scheduled) {
      return scheduled;
    }

    throw new NotFoundException('Session not found for section');
  }

  private async resolveSectionId(sectionId: string | undefined, access: AccessContext): Promise<string | undefined> {
    const explicit = sectionId?.trim();
    if (explicit) {
      return explicit;
    }

    if (access.sectionIds.length > 0) {
      return access.sectionIds[0];
    }

    for (const childId of access.parentChildIds) {
      const childSections = await this.identityStore.listSectionIdsForChild(childId);
      if (childSections.length > 0) {
        return childSections[0];
      }
    }

    return undefined;
  }
}
