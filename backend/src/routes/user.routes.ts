import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

// Admin/PM need the developer directory to populate task-assignment dropdowns.
// Only non-sensitive fields are ever returned - never the password hash.
router.get(
  '/developers',
  requireRole(Role.ADMIN, Role.PM),
  asyncHandler(async (_req, res) => {
    const developers = await prisma.user.findMany({
      where: { role: Role.DEVELOPER },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: developers });
  })
);

export default router;
