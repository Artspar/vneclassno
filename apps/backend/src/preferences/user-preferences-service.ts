import { BadRequestException, Injectable } from '@nestjs/common';
import type { UserRole } from '../domain/models.js';
import type { IdentityStore } from '../repositories/identity-store.js';

@Injectable()
export class UserPreferencesService {
  private readonly activeRoles = new Map<string, UserRole>();

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

  private isRole(value: string): value is UserRole {
    return value === 'super_admin' || value === 'section_admin' || value === 'coach' || value === 'parent';
  }
}
