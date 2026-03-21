import type {
  Child,
  Invite,
  JoinRequest,
  Notification,
  ParentContext,
  RoleAssignment,
  Section,
  User,
} from '../domain/models.js';

export interface IdentityStore {
  getUserById(userId: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  setUserTelegramId(userId: string, telegramId: string): Promise<User>;
  setUserPhone(userId: string, phone: string): Promise<User>;
  createUser(input: Omit<User, 'id' | 'status'> & Partial<Pick<User, 'status'>>): Promise<User>;

  listRoleAssignments(userId: string): Promise<RoleAssignment[]>;
  addRoleAssignment(assignment: RoleAssignment): Promise<void>;

  getSectionById(sectionId: string): Promise<Section | undefined>;
  listSectionsByIds(sectionIds: string[]): Promise<Section[]>;

  listChildrenForParent(parentUserId: string): Promise<Child[]>;
  listParentsForChild(childId: string): Promise<User[]>;
  listChildrenBySection(sectionId: string): Promise<Child[]>;
  createChild(input: Pick<Child, 'firstName' | 'lastName' | 'birthDate'>): Promise<Child>;
  linkParentToChild(parentUserId: string, childId: string): Promise<void>;

  listSectionIdsForChild(childId: string): Promise<string[]>;
  linkChildToSection(childId: string, sectionId: string): Promise<void>;

  upsertParentContext(parentContext: ParentContext): Promise<ParentContext>;
  getParentContext(parentUserId: string): Promise<ParentContext | undefined>;

  createInvite(input: {
    sectionId: string;
    createdByUserId: string;
    allowParentReshare: boolean;
    expiresAt?: string;
  }): Promise<Invite>;
  getInviteByToken(token: string): Promise<Invite | undefined>;

  createJoinRequest(input: {
    sectionId: string;
    childId: string;
    createdByUserId: string;
    status: JoinRequest['status'];
  }): Promise<JoinRequest>;
  getJoinRequestById(requestId: string): Promise<JoinRequest | undefined>;
  decideJoinRequest(input: {
    requestId: string;
    decidedByUserId: string;
    decision: 'approved' | 'rejected';
    comment?: string;
  }): Promise<JoinRequest>;

  createNotification(input: {
    sectionId: string;
    sessionId?: string;
    type: Notification['type'];
    title: string;
    message: string;
    targetMode: Notification['targetMode'];
    childIds: string[];
    createdByUserId: string;
    delivery: Notification['delivery'];
  }): Promise<Notification>;
  listNotifications(filters?: { sectionId?: string }): Promise<Notification[]>;
  getNotificationById(notificationId: string): Promise<Notification | undefined>;
  markNotificationRead(userId: string, notificationId: string): Promise<void>;
  listReadNotificationIds(userId: string, notificationIds: string[]): Promise<string[]>;
}
