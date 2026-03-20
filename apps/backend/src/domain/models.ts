export type UserRole = 'super_admin' | 'section_admin' | 'coach' | 'parent';

export interface User {
  id: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  telegramId?: string;
  status: 'active' | 'blocked';
}

export interface RoleAssignment {
  userId: string;
  role: UserRole;
  sectionId?: string;
}

export interface Section {
  id: string;
  name: string;
  autoAcceptJoinRequests: boolean;
  allowParentReshareInvites: boolean;
}

export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
}

export interface ParentChildLink {
  parentUserId: string;
  childId: string;
}

export interface ChildSectionLink {
  childId: string;
  sectionId: string;
}

export interface ParentContextSelection {
  activeChildId?: string;
  activeSectionId?: string;
}

export interface ParentContext {
  parentUserId: string;
  activeChildId?: string;
  activeSectionId?: string;
  updatedAt: string;
}

export interface Invite {
  id: string;
  sectionId: string;
  token: string;
  status: 'active' | 'expired' | 'revoked';
  allowParentReshare: boolean;
  createdByUserId: string;
  expiresAt?: string;
  createdAt: string;
}

export interface JoinRequest {
  id: string;
  sectionId: string;
  childId: string;
  createdByUserId: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  decidedByUserId?: string;
  decidedAt?: string;
  comment?: string;
  createdAt: string;
}
