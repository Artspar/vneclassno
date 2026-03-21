import { BadRequestException, Injectable } from '@nestjs/common';
import type { UserRole } from '../domain/models.js';
import type { IdentityStore } from '../repositories/identity-store.js';

@Injectable()
export class UserPreferencesService {
  private readonly activeRoles = new Map<string, UserRole>();
  private readonly activeContexts = new Map<string, { activeChildId?: string; activeSectionId?: string }>();

  constructor(private readonly identityStore: IdentityStore) {}

  async getPreferences(userId: string): Promise<{ activeRole?: UserRole }> {
    const assignments = await this.identityStore.listRoleAssignments(userId);
    const roles = [...new Set(assignments.map((item) => item.role))] as UserRole[];
    const current = this.activeRoles.get(userId);

    if (current && roles.includes(current)) {
      return { activeRole: current };
    }

    const fallback = roles[0];
    if (fallback) {
      this.activeRoles.set(userId, fallback);
      return { activeRole: fallback };
    }

    this.activeRoles.delete(userId);
    return { activeRole: undefined };
  }

  async setActiveRole(userId: string, role: string): Promise<{ activeRole: UserRole }> {
    if (!this.isRole(role)) {
      throw new BadRequestException('Unsupported role');
    }

    const assignments = await this.identityStore.listRoleAssignments(userId);
    const roles = new Set(assignments.map((item) => item.role));
    if (!roles.has(role)) {
      throw new BadRequestException('Role is not assigned to this user');
    }

    this.activeRoles.set(userId, role);
    return { activeRole: role };
  }

  async getContextSelection(userId: string): Promise<{ activeChildId?: string; activeSectionId?: string }> {
    const current = this.activeContexts.get(userId);
    const normalized = await this.normalizeContextSelection(userId, current);
    this.activeContexts.set(userId, normalized);
    return normalized;
  }

  async setContextSelection(
    userId: string,
    input: { activeChildId?: string; activeSectionId?: string },
  ): Promise<{ activeChildId?: string; activeSectionId?: string }> {
    const normalized = await this.normalizeContextSelection(userId, input);
    this.activeContexts.set(userId, normalized);
    return normalized;
  }

  private isRole(value: string): value is UserRole {
    return value === 'super_admin' || value === 'section_admin' || value === 'coach' || value === 'parent';
  }

  private async normalizeContextSelection(
    userId: string,
    input?: { activeChildId?: string; activeSectionId?: string },
  ): Promise<{ activeChildId?: string; activeSectionId?: string }> {
    const assignments = await this.identityStore.listRoleAssignments(userId);
    const managedSectionIds = assignments
      .filter((item) => item.sectionId)
      .map((item) => String(item.sectionId));

    const children = await this.identityStore.listChildrenForParent(userId);
    const childIds = children.map((child) => child.id);
    const childSectionEntries = await Promise.all(
      childIds.map(async (childId) => ({ childId, sectionIds: await this.identityStore.listSectionIdsForChild(childId) })),
    );

    const parentSectionIds = new Set<string>();
    for (const entry of childSectionEntries) {
      for (const sectionId of entry.sectionIds) {
        parentSectionIds.add(sectionId);
      }
    }

    const accessibleSections = [...new Set([...managedSectionIds, ...parentSectionIds])];
    const requestedSection = input?.activeSectionId?.trim();
    const resolvedSection = requestedSection && accessibleSections.includes(requestedSection) ? requestedSection : accessibleSections[0];

    const requestedChild = input?.activeChildId?.trim();
    const canUseChild = requestedChild && childIds.includes(requestedChild);
    const childSections = canUseChild
      ? childSectionEntries.find((entry) => entry.childId === requestedChild)?.sectionIds ?? []
      : [];

    const childFitsSection = resolvedSection ? childSections.includes(resolvedSection) : true;
    const resolvedChild = canUseChild && childFitsSection ? requestedChild : undefined;

    if (input?.activeChildId && !canUseChild) {
      throw new BadRequestException('Selected child is not available for this user');
    }

    if (input?.activeSectionId && requestedSection && !accessibleSections.includes(requestedSection)) {
      throw new BadRequestException('Selected section is not available for this user');
    }

    return {
      activeChildId: resolvedChild,
      activeSectionId: resolvedSection,
    };
  }
}
