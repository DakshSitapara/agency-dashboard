import { Router } from 'express';
import { createTask, listTasks, getTask, updateTask, updateTaskStatus } from '../controllers/task.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createTaskSchema, updateTaskSchema, updateTaskStatusSchema, taskQuerySchema } from '../validators/task.validators';
import { idParamSchema } from '../validators/project.validators';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.post('/', requireRole(Role.ADMIN, Role.PM), validate({ body: createTaskSchema }), createTask);

// All three roles can list tasks - the controller scopes the WHERE clause per role.
router.get('/', validate({ query: taskQuerySchema }), listTasks);

router.get('/:id', validate({ params: idParamSchema }), getTask);

router.patch(
  '/:id',
  requireRole(Role.ADMIN, Role.PM),
  validate({ params: idParamSchema, body: updateTaskSchema }),
  updateTask
);

// Any role may hit this (a Developer must be able to move their own task) -
// row-level check inside the controller enforces "only YOUR task".
router.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: updateTaskStatusSchema }),
  updateTaskStatus
);

export default router;
