import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  Child,
  Invite,
  JoinRequest,
  ParentContext,
  RoleAssignment,
  Section,
  User,
} from '../domain/models.js';
import type { IdentityStore } from './identity-store.js';

@Injectable()
export class PrismaIdentityStore implements IdentityStore {
  constructor(private readonly prisma: PrismaService) {}

  async getUserById(userId: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user
      ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName ?? undefined,
          phone: user.phone ?? undefined,
          telegramId: user.telegramId ?? undefined,
          status: user.status,
        }
      : undefined;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    return user
      ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName ?? undefined,
          phone: user.phone ?? undefined,
          telegramId: user.telegramId ?? undefined,
          status: user.status,
        }
      : undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    return user
      ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName ?? undefined,
          phone: user.phone ?? undefined,
          telegramId: user.telegramId ?? undefined,
          status: user.status,
        }
      : undefined;
  }

  async setUserTelegramId(userId: string, telegramId: string): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { telegramId },
    });

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName ?? undefined,
      phone: user.phone ?? undefined,
      telegramId: user.telegramId ?? undefined,
      status: user.status,
    };
  }

  async setUserPhone(userId: string, phone: string): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { phone },
    });

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName ?? undefined,
      phone: user.phone ?? undefined,
      telegramId: user.telegramId ?? undefined,
      status: user.status,
    };
  }

  async createUser(input: Omit<User, 'id' | 'status'> & Partial<Pick<User, 'status'>>): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        telegramId: input.telegramId,
        status: input.status ?? 'active',
      },
    });

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName ?? undefined,
      phone: user.phone ?? undefined,
      telegramId: user.telegramId ?? undefined,
      status: user.status,
    };
  }

  async listRoleAssignments(userId: string): Promise<RoleAssignment[]> {
    const rows = await this.prisma.roleAssignment.findMany({ where: { userId } });
    return rows.map((row) => ({ userId: row.userId, role: row.role, sectionId: row.sectionId ?? undefined }));
  }

  async addRoleAssignment(assignment: RoleAssignment): Promise<void> {
    const existing = await this.prisma.roleAssignment.findFirst({
      where: {
        userId: assignment.userId,
        role: assignment.role,
        sectionId: assignment.sectionId ?? null,
      },
      select: { id: true },
    });

    if (existing) {
      return;
    }

    await this.prisma.roleAssignment.create({
      data: {
        userId: assignment.userId,
        role: assignment.role,
        sectionId: assignment.sectionId ?? null,
      },
    });
  }

  async getSectionById(sectionId: string): Promise<Section | undefined> {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
    return section
      ? {
          id: section.id,
          name: section.name,
          autoAcceptJoinRequests: section.autoAcceptJoinRequests,
          allowParentReshareInvites: section.allowParentReshareInvites,
        }
      : undefined;
  }

  async listSectionsByIds(sectionIds: string[]): Promise<Section[]> {
    if (sectionIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.section.findMany({ where: { id: { in: sectionIds } } });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      autoAcceptJoinRequests: row.autoAcceptJoinRequests,
      allowParentReshareInvites: row.allowParentReshareInvites,
    }));
  }

  async listChildrenForParent(parentUserId: string): Promise<Child[]> {
    const rows = await this.prisma.parentChild.findMany({
      where: { parentUserId },
      include: { child: true },
    });

    return rows.map((row) => ({
      id: row.child.id,
      firstName: row.child.firstName,
      lastName: row.child.lastName,
      birthDate: row.child.birthDate?.toISOString(),
    }));
  }

  async listChildrenBySection(sectionId: string): Promise<Child[]> {
    const rows = await this.prisma.childSection.findMany({
      where: { sectionId },
      include: { child: true },
    });

    return rows.map((row) => ({
      id: row.child.id,
      firstName: row.child.firstName,
      lastName: row.child.lastName,
      birthDate: row.child.birthDate?.toISOString(),
    }));
  }

  async createChild(input: Pick<Child, 'firstName' | 'lastName' | 'birthDate'>): Promise<Child> {
    const child = await this.prisma.child.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
      },
    });

    return {
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
      birthDate: child.birthDate?.toISOString(),
    };
  }

  async linkParentToChild(parentUserId: string, childId: string): Promise<void> {
    await this.prisma.parentChild.upsert({
      where: {
        parentUserId_childId: {
          parentUserId,
          childId,
        },
      },
      update: {},
      create: {
        parentUserId,
        childId,
      },
    });
  }

  async listSectionIdsForChild(childId: string): Promise<string[]> {
    const rows = await this.prisma.childSection.findMany({
      where: { childId },
      select: { sectionId: true },
    });
    return rows.map((row) => row.sectionId);
  }

  async linkChildToSection(childId: string, sectionId: string): Promise<void> {
    await this.prisma.childSection.upsert({
      where: {
        childId_sectionId: {
          childId,
          sectionId,
        },
      },
      update: {},
      create: {
        childId,
        sectionId,
      },
    });
  }

  async upsertParentContext(parentContext: ParentContext): Promise<ParentContext> {
    const row = await this.prisma.parentContext.upsert({
      where: { parentUserId: parentContext.parentUserId },
      update: {
        activeChildId: parentContext.activeChildId ?? null,
        activeSectionId: parentContext.activeSectionId ?? null,
        updatedAt: new Date(parentContext.updatedAt),
      },
      create: {
        parentUserId: parentContext.parentUserId,
        activeChildId: parentContext.activeChildId ?? null,
        activeSectionId: parentContext.activeSectionId ?? null,
        updatedAt: new Date(parentContext.updatedAt),
      },
    });

    return {
      parentUserId: row.parentUserId,
      activeChildId: row.activeChildId ?? undefined,
      activeSectionId: row.activeSectionId ?? undefined,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getParentContext(parentUserId: string): Promise<ParentContext | undefined> {
    const row = await this.prisma.parentContext.findUnique({ where: { parentUserId } });
    return row
      ? {
          parentUserId: row.parentUserId,
          activeChildId: row.activeChildId ?? undefined,
          activeSectionId: row.activeSectionId ?? undefined,
          updatedAt: row.updatedAt.toISOString(),
        }
      : undefined;
  }

  async createInvite(input: {
    sectionId: string;
    createdByUserId: string;
    allowParentReshare: boolean;
    expiresAt?: string;
  }): Promise<Invite> {
    const invite = await this.prisma.invite.create({
      data: {
        sectionId: input.sectionId,
        token: randomBytes(12).toString('hex'),
        status: 'active',
        allowParentReshare: input.allowParentReshare,
        createdByUserId: input.createdByUserId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    return {
      id: invite.id,
      sectionId: invite.sectionId,
      token: invite.token,
      status: invite.status,
      allowParentReshare: invite.allowParentReshare,
      createdByUserId: invite.createdByUserId,
      expiresAt: invite.expiresAt?.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    };
  }

  async getInviteByToken(token: string): Promise<Invite | undefined> {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite) {
      return undefined;
    }

    if (invite.status === 'active' && invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
      const expired = await this.prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      return {
        id: expired.id,
        sectionId: expired.sectionId,
        token: expired.token,
        status: expired.status,
        allowParentReshare: expired.allowParentReshare,
        createdByUserId: expired.createdByUserId,
        expiresAt: expired.expiresAt?.toISOString(),
        createdAt: expired.createdAt.toISOString(),
      };
    }

    return {
      id: invite.id,
      sectionId: invite.sectionId,
      token: invite.token,
      status: invite.status,
      allowParentReshare: invite.allowParentReshare,
      createdByUserId: invite.createdByUserId,
      expiresAt: invite.expiresAt?.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    };
  }

  async createJoinRequest(input: {
    sectionId: string;
    childId: string;
    createdByUserId: string;
    status: JoinRequest['status'];
  }): Promise<JoinRequest> {
    if (input.status === 'pending') {
      const existing = await this.prisma.joinRequest.findFirst({
        where: {
          sectionId: input.sectionId,
          childId: input.childId,
          status: 'pending',
        },
      });
      if (existing) {
        return {
          id: existing.id,
          sectionId: existing.sectionId,
          childId: existing.childId,
          createdByUserId: existing.createdByUserId,
          status: existing.status,
          decidedByUserId: existing.decidedByUserId ?? undefined,
          decidedAt: existing.decidedAt?.toISOString(),
          comment: existing.comment ?? undefined,
          createdAt: existing.createdAt.toISOString(),
        };
      }
    }

    const created = await this.prisma.joinRequest.create({
      data: {
        sectionId: input.sectionId,
        childId: input.childId,
        createdByUserId: input.createdByUserId,
        status: input.status,
      },
    });

    return {
      id: created.id,
      sectionId: created.sectionId,
      childId: created.childId,
      createdByUserId: created.createdByUserId,
      status: created.status,
      decidedByUserId: created.decidedByUserId ?? undefined,
      decidedAt: created.decidedAt?.toISOString(),
      comment: created.comment ?? undefined,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async getJoinRequestById(requestId: string): Promise<JoinRequest | undefined> {
    const row = await this.prisma.joinRequest.findUnique({ where: { id: requestId } });
    return row
      ? {
          id: row.id,
          sectionId: row.sectionId,
          childId: row.childId,
          createdByUserId: row.createdByUserId,
          status: row.status,
          decidedByUserId: row.decidedByUserId ?? undefined,
          decidedAt: row.decidedAt?.toISOString(),
          comment: row.comment ?? undefined,
          createdAt: row.createdAt.toISOString(),
        }
      : undefined;
  }

  async decideJoinRequest(input: {
    requestId: string;
    decidedByUserId: string;
    decision: 'approved' | 'rejected';
    comment?: string;
  }): Promise<JoinRequest> {
    const updated = await this.prisma.joinRequest.update({
      where: { id: input.requestId },
      data: {
        status: input.decision,
        decidedByUserId: input.decidedByUserId,
        decidedAt: new Date(),
        comment: input.comment,
      },
    });

    if (input.decision === 'approved') {
      await this.linkChildToSection(updated.childId, updated.sectionId);
    }

    return {
      id: updated.id,
      sectionId: updated.sectionId,
      childId: updated.childId,
      createdByUserId: updated.createdByUserId,
      status: updated.status,
      decidedByUserId: updated.decidedByUserId ?? undefined,
      decidedAt: updated.decidedAt?.toISOString(),
      comment: updated.comment ?? undefined,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
