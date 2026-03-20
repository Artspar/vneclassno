import type { IdentityStore } from '../repositories/identity-store.js';

interface ParentContextResult {
  parentUserId: string;
  activeChildId?: string;
  activeSectionId?: string;
  availableChildren: Array<{
    id: string;
    firstName: string;
    lastName: string;
    sectionIds: string[];
  }>;
}

export class ParentContextService {
  constructor(private readonly identityStore: IdentityStore) {}

  async getContext(parentUserId: string): Promise<ParentContextResult> {
    const children = await this.identityStore.listChildrenForParent(parentUserId);
    const current = await this.identityStore.getParentContext(parentUserId);

    const availableChildren = await Promise.all(
      children.map(async (child) => ({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        sectionIds: await this.identityStore.listSectionIdsForChild(child.id),
      })),
    );

    return {
      parentUserId,
      activeChildId: current?.activeChildId,
      activeSectionId: current?.activeSectionId,
      availableChildren,
    };
  }

  async setContext(
    parentUserId: string,
    selection: {
      activeChildId?: string;
      activeSectionId?: string;
    },
  ): Promise<ParentContextResult> {
    const children = await this.identityStore.listChildrenForParent(parentUserId);
    const childIds = new Set(children.map((child) => child.id));

    if (selection.activeChildId && !childIds.has(selection.activeChildId)) {
      throw new Error('Parent does not have access to selected child');
    }

    if (selection.activeSectionId && selection.activeChildId) {
      const childSections = await this.identityStore.listSectionIdsForChild(selection.activeChildId);
      if (!childSections.includes(selection.activeSectionId)) {
        throw new Error('Selected section is not available for selected child');
      }
    }

    await this.identityStore.upsertParentContext({
      parentUserId,
      activeChildId: selection.activeChildId,
      activeSectionId: selection.activeSectionId,
      updatedAt: new Date().toISOString(),
    });

    return this.getContext(parentUserId);
  }
}
