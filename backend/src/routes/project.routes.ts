import { Router } from 'express';
import { createProject, listProjects, getProject, updateProject } from '../controllers/project.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createProjectSchema, updateProjectSchema, idParamSchema } from '../validators/project.validators';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Developers never get project-level routes at all - not hidden in the UI,
// actually absent from what their role is allowed to call.
router.post('/', requireRole(Role.ADMIN, Role.PM), validate({ body: createProjectSchema }), createProject);
router.get('/', requireRole(Role.ADMIN, Role.PM), listProjects);
router.get('/:id', requireRole(Role.ADMIN, Role.PM), validate({ params: idParamSchema }), getProject);
router.patch(
  '/:id',
  requireRole(Role.ADMIN, Role.PM),
  validate({ params: idParamSchema, body: updateProjectSchema }),
  updateProject
);

export default router;
