import { Router } from 'express';
import { listNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../validators/project.validators';

const router = Router();

router.use(authenticate);
router.get('/', listNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', validate({ params: idParamSchema }), markAsRead);

export default router;
