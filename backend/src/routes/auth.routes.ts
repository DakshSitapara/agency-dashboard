import { Router } from 'express';
import { login, refresh, logout, me, registerUser } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema } from '../validators/auth.validators';
import { authenticate, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.post('/login', validate({ body: loginSchema }), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);

// Only Admins may create new accounts - keeps role assignment out of self-service signup.
router.post('/register', authenticate, requireRole(Role.ADMIN), validate({ body: registerSchema }), registerUser);

export default router;
