import type { IdentityStore } from '../repositories/identity-store.js';
import type { Permission } from './permissions.js';
import { hasPermission } from './permissions.js';

export class RbacService {
  constructor(private readonly identityStore: IdentityStore) {}

  async assertPermission(userId: string, permission: Permission, sectionId?: string): Promise<void> {
    const assignments = await this.identityStore.listRoleAssignments(userId);
    const allowed = hasPermission(assignments, permission, { sectionId });

    if (!allowed) {
      throw new Error(`Access denied for permission ${permission}`);
    }
  }
}
