import { PrismaClient, Role, TaskStatus, TaskPriority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

async function main() {
  console.log('Seeding database...');

  await prisma.notification.deleteMany();
  await prisma.taskActivityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: { name: 'Ananya Shah', email: 'admin@agency.test', password: passwordHash, role: Role.ADMIN },
  });

  const pm1 = await prisma.user.create({
    data: { name: 'Ravi Mehta', email: 'pm1@agency.test', password: passwordHash, role: Role.PM },
  });
  const pm2 = await prisma.user.create({
    data: { name: 'Sneha Kapoor', email: 'pm2@agency.test', password: passwordHash, role: Role.PM },
  });

  const dev1 = await prisma.user.create({
    data: { name: 'Karan Patel', email: 'dev1@agency.test', password: passwordHash, role: Role.DEVELOPER },
  });
  const dev2 = await prisma.user.create({
    data: { name: 'Priya Nair', email: 'dev2@agency.test', password: passwordHash, role: Role.DEVELOPER },
  });
  const dev3 = await prisma.user.create({
    data: { name: 'Arjun Rao', email: 'dev3@agency.test', password: passwordHash, role: Role.DEVELOPER },
  });
  const dev4 = await prisma.user.create({
    data: { name: 'Meera Iyer', email: 'dev4@agency.test', password: passwordHash, role: Role.DEVELOPER },
  });

  const clientA = await prisma.client.create({ data: { name: 'Northwind Retail', email: 'contact@northwind.test' } });
  const clientB = await prisma.client.create({ data: { name: 'Bluepeak Finance', email: 'contact@bluepeak.test' } });
  const clientC = await prisma.client.create({ data: { name: 'Verde Health', email: 'contact@verdehealth.test' } });

  const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  const projectAlpha = await prisma.project.create({
    data: {
      name: 'Northwind Storefront Revamp',
      description: 'Redesign and rebuild the e-commerce storefront.',
      clientId: clientA.id,
      createdById: pm1.id,
    },
  });

  const projectBeta = await prisma.project.create({
    data: {
      name: 'Bluepeak Client Portal',
      description: 'Secure portal for financial document exchange.',
      clientId: clientB.id,
      createdById: pm1.id,
    },
  });

  const projectGamma = await prisma.project.create({
    data: {
      name: 'Verde Health Patient App',
      description: 'Mobile-first patient scheduling application.',
      clientId: clientC.id,
      createdById: pm2.id,
    },
  });

  type SeedTask = {
    title: string;
    description: string;
    assignedToId: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date;
  };

  async function seedProjectTasks(projectId: string, pmId: string, tasks: SeedTask[]) {
    for (const t of tasks) {
      const isPastDue = t.dueDate.getTime() < Date.now();
      const task = await prisma.task.create({
        data: {
          title: t.title,
          description: t.description,
          projectId,
          assignedToId: t.assignedToId,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          isOverdue: isPastDue && t.status !== TaskStatus.DONE,
        },
      });

      // Pre-existing activity trail so the feed isn't empty on first load.
      await prisma.taskActivityLog.create({
        data: {
          taskId: task.id,
          projectId,
          userId: t.assignedToId,
          fromStatus: null,
          toStatus: TaskStatus.TODO,
          message: `Task "${task.title}" was created`,
          createdAt: new Date(task.dueDate!.getTime() - 6 * 24 * 60 * 60 * 1000),
        },
      });

      if (t.status !== TaskStatus.TODO) {
        await prisma.taskActivityLog.create({
          data: {
            taskId: task.id,
            projectId,
            userId: t.assignedToId,
            fromStatus: TaskStatus.TODO,
            toStatus: t.status,
            message: `Task moved from To Do to ${t.status.replace('_', ' ')}`,
            createdAt: new Date(),
          },
        });
      }

      await prisma.notification.create({
        data: {
          userId: t.assignedToId,
          type: 'TASK_ASSIGNED',
          message: `You were assigned to "${task.title}"`,
          relatedTaskId: task.id,
        },
      });
    }
  }

  await seedProjectTasks(projectAlpha.id, pm1.id, [
    { title: 'Set up design tokens', description: 'Establish color/typography tokens for the new theme.', assignedToId: dev1.id, status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, dueDate: daysFromNow(-10) },
    { title: 'Build product listing page', description: 'Grid layout with filters.', assignedToId: dev1.id, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, dueDate: daysFromNow(5) },
    { title: 'Checkout flow redesign', description: 'Multi-step checkout with saved addresses.', assignedToId: dev2.id, status: TaskStatus.IN_REVIEW, priority: TaskPriority.CRITICAL, dueDate: daysFromNow(2) },
    { title: 'Fix cart total rounding bug', description: 'Totals off by a cent on some currencies.', assignedToId: dev2.id, status: TaskStatus.TODO, priority: TaskPriority.HIGH, dueDate: daysFromNow(-2) }, // overdue
    { title: 'Add wishlist feature', description: 'Allow users to save items for later.', assignedToId: dev1.id, status: TaskStatus.TODO, priority: TaskPriority.LOW, dueDate: daysFromNow(14) },
    { title: 'Accessibility audit', description: 'WCAG AA pass on storefront pages.', assignedToId: dev2.id, status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, dueDate: daysFromNow(9) },
  ]);

  await seedProjectTasks(projectBeta.id, pm1.id, [
    { title: 'Document upload encryption', description: 'Client-side encryption before upload.', assignedToId: dev1.id, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.CRITICAL, dueDate: daysFromNow(3) },
    { title: '2FA enrollment flow', description: 'TOTP-based two-factor setup.', assignedToId: dev2.id, status: TaskStatus.TODO, priority: TaskPriority.HIGH, dueDate: daysFromNow(-1) }, // overdue
    { title: 'Audit log export', description: 'CSV export of account activity.', assignedToId: dev1.id, status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, dueDate: daysFromNow(-5) },
    { title: 'Session timeout warning modal', description: 'Warn users 1 minute before auto-logout.', assignedToId: dev2.id, status: TaskStatus.IN_REVIEW, priority: TaskPriority.LOW, dueDate: daysFromNow(4) },
    { title: 'Rate limit login attempts', description: 'Lock account after 5 failed attempts.', assignedToId: dev1.id, status: TaskStatus.TODO, priority: TaskPriority.HIGH, dueDate: daysFromNow(6) },
  ]);

  await seedProjectTasks(projectGamma.id, pm2.id, [
    { title: 'Appointment booking calendar', description: 'Drag-and-drop scheduling UI.', assignedToId: dev3.id, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, dueDate: daysFromNow(7) },
    { title: 'Push notification reminders', description: 'Remind patients 24h before appointment.', assignedToId: dev4.id, status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, dueDate: daysFromNow(10) },
    { title: 'Insurance card OCR scan', description: 'Auto-fill insurance details from photo.', assignedToId: dev3.id, status: TaskStatus.TODO, priority: TaskPriority.CRITICAL, dueDate: daysFromNow(1) },
    { title: 'Telehealth video integration', description: 'Embed video call SDK.', assignedToId: dev4.id, status: TaskStatus.IN_REVIEW, priority: TaskPriority.HIGH, dueDate: daysFromNow(3) },
    { title: 'HIPAA compliance review', description: 'Third-party audit checklist.', assignedToId: dev3.id, status: TaskStatus.DONE, priority: TaskPriority.CRITICAL, dueDate: daysFromNow(-8) },
    { title: 'Patient feedback survey', description: 'Post-appointment NPS survey.', assignedToId: dev4.id, status: TaskStatus.TODO, priority: TaskPriority.LOW, dueDate: daysFromNow(20) },
  ]);

  console.log('Seed complete.');
  console.log('----------------------------------------');
  console.log('Login with any of the following (password for all: ' + DEFAULT_PASSWORD + ')');
  console.log('Admin:  admin@agency.test');
  console.log('PM 1:   pm1@agency.test   (owns Northwind + Bluepeak projects)');
  console.log('PM 2:   pm2@agency.test   (owns Verde Health project)');
  console.log('Dev 1:  dev1@agency.test');
  console.log('Dev 2:  dev2@agency.test');
  console.log('Dev 3:  dev3@agency.test');
  console.log('Dev 4:  dev4@agency.test');
  console.log('----------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
