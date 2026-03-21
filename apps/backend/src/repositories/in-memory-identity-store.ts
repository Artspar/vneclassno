import { randomBytes, randomUUID } from 'node:crypto';
import type {
  Child,
  ChildSectionLink,
  Invite,
  JoinRequest,
  ParentChildLink,
  ParentContext,
  RoleAssignment,
  Section,
  User,
} from '../domain/models.js';
import type { IdentityStore } from './identity-store.js';

export class InMemoryIdentityStore implements IdentityStore {
  private users: User[] = [];
  private roleAssignments: RoleAssignment[] = [];
  private sections: Section[] = [];
  private children: Child[] = [];
  private parentChildren: ParentChildLink[] = [];
  private childSections: ChildSectionLink[] = [];
  private parentContexts: ParentContext[] = [];
  private invites: Invite[] = [];
  private joinRequests: JoinRequest[] = [];

  async getUserById(userId: string): Promise<User | undefined> {
    return this.users.find((user) => user.id === userId);
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    return this.users.find((user) => user.telegramId === telegramId);
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    return this.users.find((user) => user.phone === phone);
  }

  async createUser(input: Omit<User, 'id' | 'status'> & Partial<Pick<User, 'status'>>): Promise<User> {
    const user: User = {
      id: randomUUID(),
      status: input.status ?? 'active',
      ...input,
    };
    this.users.push(user);
    return user;
  }

  async listRoleAssignments(userId: string): Promise<RoleAssignment[]> {
    return this.roleAssignments.filter((assignment) => assignment.userId === userId);
  }

  async addRoleAssignment(assignment: RoleAssignment): Promise<void> {
    this.roleAssignments.push(assignment);
  }

  async getSectionById(sectionId: string): Promise<Section | undefined> {
    return this.sections.find((section) => section.id === sectionId);
  }

  async listSectionsByIds(sectionIds: string[]): Promise<Section[]> {
    const set = new Set(sectionIds);
    return this.sections.filter((section) => set.has(section.id));
  }

  async listChildrenForParent(parentUserId: string): Promise<Child[]> {
    const childIds = this.parentChildren
      .filter((link) => link.parentUserId === parentUserId)
      .map((link) => link.childId);

    return this.children.filter((child) => childIds.includes(child.id));
  }

  async listChildrenBySection(sectionId: string): Promise<Child[]> {
    const childIds = this.childSections.filter((link) => link.sectionId === sectionId).map((link) => link.childId);
    return this.children.filter((child) => childIds.includes(child.id));
  }

  async createChild(input: Pick<Child, 'firstName' | 'lastName' | 'birthDate'>): Promise<Child> {
    const child: Child = {
      id: randomUUID(),
      firstName: input.firstName,
      lastName: input.lastName,
      birthDate: input.birthDate,
    };
    this.children.push(child);
    return child;
  }

  async linkParentToChild(parentUserId: string, childId: string): Promise<void> {
    const exists = this.parentChildren.some((link) => link.parentUserId === parentUserId && link.childId === childId);
    if (!exists) {
      this.parentChildren.push({ parentUserId, childId });
    }
  }

  async listSectionIdsForChild(childId: string): Promise<string[]> {
    return this.childSections.filter((link) => link.childId === childId).map((link) => link.sectionId);
  }

  async linkChildToSection(childId: string, sectionId: string): Promise<void> {
    const exists = this.childSections.some((link) => link.childId === childId && link.sectionId === sectionId);
    if (!exists) {
      this.childSections.push({ childId, sectionId });
    }
  }

  async upsertParentContext(parentContext: ParentContext): Promise<ParentContext> {
    const current = this.parentContexts.find((context) => context.parentUserId === parentContext.parentUserId);
    if (current) {
      current.activeChildId = parentContext.activeChildId;
      current.activeSectionId = parentContext.activeSectionId;
      current.updatedAt = parentContext.updatedAt;
      return current;
    }

    this.parentContexts.push(parentContext);
    return parentContext;
  }

  async getParentContext(parentUserId: string): Promise<ParentContext | undefined> {
    return this.parentContexts.find((context) => context.parentUserId === parentUserId);
  }

  async createInvite(input: {
    sectionId: string;
    createdByUserId: string;
    allowParentReshare: boolean;
    expiresAt?: string;
  }): Promise<Invite> {
    const invite: Invite = {
      id: randomUUID(),
      sectionId: input.sectionId,
      token: randomBytes(12).toString('hex'),
      status: 'active',
      allowParentReshare: input.allowParentReshare,
      createdByUserId: input.createdByUserId,
      expiresAt: input.expiresAt,
      createdAt: new Date().toISOString(),
    };

    this.invites.push(invite);
    return invite;
  }

  async getInviteByToken(token: string): Promise<Invite | undefined> {
    const invite = this.invites.find((item) => item.token === token);
    if (!invite) {
      return undefined;
    }

    if (invite.status !== 'active') {
      return invite;
    }

    if (invite.expiresAt && Date.parse(invite.expiresAt) <= Date.now()) {
      invite.status = 'expired';
    }

    return invite;
  }

  async createJoinRequest(input: {
    sectionId: string;
    childId: string;
    createdByUserId: string;
    status: JoinRequest['status'];
  }): Promise<JoinRequest> {
    const existing = this.joinRequests.find(
      (request) => request.sectionId === input.sectionId && request.childId === input.childId && request.status === 'pending',
    );
    if (existing) {
      return existing;
    }

    const request: JoinRequest = {
      id: randomUUID(),
      sectionId: input.sectionId,
      childId: input.childId,
      createdByUserId: input.createdByUserId,
      status: input.status,
      createdAt: new Date().toISOString(),
    };

    this.joinRequests.push(request);
    return request;
  }

  async getJoinRequestById(requestId: string): Promise<JoinRequest | undefined> {
    return this.joinRequests.find((request) => request.id === requestId);
  }

  async decideJoinRequest(input: {
    requestId: string;
    decidedByUserId: string;
    decision: 'approved' | 'rejected';
    comment?: string;
  }): Promise<JoinRequest> {
    const request = this.joinRequests.find((item) => item.id === input.requestId);
    if (!request) {
      throw new Error('Join request not found');
    }

    request.status = input.decision;
    request.decidedByUserId = input.decidedByUserId;
    request.decidedAt = new Date().toISOString();
    request.comment = input.comment;

    if (input.decision === 'approved') {
      await this.linkChildToSection(request.childId, request.sectionId);
    }

    return request;
  }

  async seedDemoData(): Promise<void> {
    if (this.users.length > 0) {
      return;
    }

    this.sections.push(
      {
        id: 'section-a',
        name: 'Football A',
        autoAcceptJoinRequests: false,
        allowParentReshareInvites: true,
      },
      {
        id: 'section-b',
        name: 'Basketball B',
        autoAcceptJoinRequests: true,
        allowParentReshareInvites: true,
      },
    );

    const parent = await this.createUser({
      firstName: 'Demo',
      lastName: 'Parent',
      phone: '+79990000001',
    });
    await this.addRoleAssignment({ userId: parent.id, role: 'parent' });

    const coach = await this.createUser({
      firstName: 'Demo',
      lastName: 'Coach',
      phone: '+79990000002',
      telegramId: '1001',
    });
    await this.addRoleAssignment({ userId: coach.id, role: 'coach', sectionId: 'section-a' });

    const sectionAdmin = await this.createUser({
      firstName: 'Demo',
      lastName: 'SectionAdmin',
      phone: '+79990000003',
      telegramId: '1002',
    });
    await this.addRoleAssignment({ userId: sectionAdmin.id, role: 'section_admin', sectionId: 'section-b' });

    const childA: Child = {
      id: randomUUID(),
      firstName: 'Alex',
      lastName: 'Ivanov',
    };
    const childB: Child = {
      id: randomUUID(),
      firstName: 'Mila',
      lastName: 'Ivanova',
    };

    this.children.push(childA, childB);

    this.parentChildren.push(
      { parentUserId: parent.id, childId: childA.id },
      { parentUserId: parent.id, childId: childB.id },
    );

    this.childSections.push(
      { childId: childA.id, sectionId: 'section-a' },
      { childId: childA.id, sectionId: 'section-b' },
      { childId: childB.id, sectionId: 'section-b' },
    );
  }
}
