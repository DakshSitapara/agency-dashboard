import { Router } from 'express';
import { z } from 'zod';
import { listClients, createClient } from '../controllers/client.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Admin and PM both need the client list to attach new projects to a client.
router.get('/', requireRole(Role.ADMIN, Role.PM), listClients);

router.post(
  '/',
  requireRole(Role.ADMIN, Role.PM),
  validate({ body: z.object({ name: z.string().min(2), email: z.string().email().optional() }) }),
  createClient
);

export default router;
