import { PrismaClient, type UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureRole(userId: string, role: UserRole, sectionId: string | null): Promise<void> {
  const existing = await prisma.roleAssignment.findFirst({
    where: {
      userId,
      role,
      sectionId,
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  await prisma.roleAssignment.create({
    data: {
      userId,
      role,
      sectionId,
    },
  });
}

async function ensureChild(firstName: string, lastName: string): Promise<{ id: string }> {
  const existing = await prisma.child.findFirst({
    where: { firstName, lastName },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.child.create({
    data: { firstName, lastName },
    select: { id: true },
  });
}

async function main() {
  await prisma.section.upsert({
    where: { id: 'section-a' },
    update: {},
    create: {
      id: 'section-a',
      name: 'Football A',
      autoAcceptJoinRequests: false,
      allowParentReshareInvites: true,
    },
  });

  await prisma.section.upsert({
    where: { id: 'section-b' },
    update: {},
    create: {
      id: 'section-b',
      name: 'Basketball B',
      autoAcceptJoinRequests: true,
      allowParentReshareInvites: true,
    },
  });

  const parent = await prisma.user.upsert({
    where: { phone: '+79990000001' },
    update: {},
    create: {
      phone: '+79990000001',
      firstName: 'Demo',
      lastName: 'Parent',
      status: 'active',
    },
  });

  const coach = await prisma.user.upsert({
    where: { telegramId: '1001' },
    update: {},
    create: {
      telegramId: '1001',
      firstName: 'Demo',
      lastName: 'Coach',
      status: 'active',
    },
  });

  const sectionAdmin = await prisma.user.upsert({
    where: { telegramId: '1002' },
    update: {},
    create: {
      telegramId: '1002',
      firstName: 'Demo',
      lastName: 'SectionAdmin',
      status: 'active',
    },
  });

  await ensureRole(parent.id, 'parent', null);
  await ensureRole(coach.id, 'coach', 'section-a');
  await ensureRole(sectionAdmin.id, 'section_admin', 'section-b');

  const childA = await ensureChild('Alex', 'Ivanov');
  const childB = await ensureChild('Mila', 'Ivanova');

  await prisma.parentChild.createMany({
    data: [
      { parentUserId: parent.id, childId: childA.id },
      { parentUserId: parent.id, childId: childB.id },
    ],
    skipDuplicates: true,
  });

  await prisma.childSection.createMany({
    data: [
      { childId: childA.id, sectionId: 'section-a' },
      { childId: childA.id, sectionId: 'section-b' },
      { childId: childB.id, sectionId: 'section-b' },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
