import type { UserRole } from '../domain/models.js';

export type Permission =
  | 'sessions:read'
  | 'sessions:write'
  | 'attendance:write'
  | 'absence:request'
  | 'absence:decide'
  | 'subscriptions:read'
  | 'subscriptions:write'
  | 'payments:create'
  | 'payments:manual_confirm'
  | 'notifications:send'
  | 'context:select'
  | 'admin:manage_section'
  | 'admin:manage_platform';

const permissionMatrix: Record<UserRole, Permission[]> = {
  super_admin: [
    'sessions:read',
    'sessions:write',
    'attendance:write',
    'absence:request',
    'absence:decide',
    'subscriptions:read',
    'subscriptions:write',
    'payments:create',
    'payments:manual_confirm',
    'notifications:send',
    'context:select',
    'admin:manage_section',
    'admin:manage_platform',
  ],
  section_admin: [
    'sessions:read',
    'sessions:write',
    'attendance:write',
    'absence:request',
    'absence:decide',
    'subscriptions:read',
    'subscriptions:write',
    'payments:create',
    'payments:manual_confirm',
    'notifications:send',
    'context:select',
    'admin:manage_section',
  ],
  coach: [
    'sessions:read',
    'attendance:write',
    'absence:request',
    'absence:decide',
    'subscriptions:read',
    'payments:create',
    'payments:manual_confirm',
    'notifications:send',
    'context:select',
  ],
  parent: [
    'sessions:read',
    'absence:request',
    'subscriptions:read',
    'payments:create',
    'context:select',
  ],
};

export interface AccessScope {
  sectionId?: string;
}

export interface RoleAssignmentInput {
  role: UserRole;
  sectionId?: string;
}

export function hasPermission(
  assignments: RoleAssignmentInput[],
  permission: Permission,
  scope?: AccessScope,
): boolean {
  return assignments.some((assignment) => {
    const allowed = permissionMatrix[assignment.role] ?? [];
    if (!allowed.includes(permission)) {
      return false;
    }

    if (!scope?.sectionId) {
      return true;
    }

    if (assignment.role === 'super_admin') {
      return true;
    }

    return assignment.sectionId === scope.sectionId;
  });
}

export function listPermissionsByRoles(roles: UserRole[]): Permission[] {
  const union = new Set<Permission>();
  for (const role of roles) {
    const allowed = permissionMatrix[role] ?? [];
    for (const permission of allowed) {
      union.add(permission);
    }
  }
  return [...union];
}
