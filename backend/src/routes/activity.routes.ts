import { Router } from "express";
import { listActivity } from "../controllers/activity.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { activityQuerySchema } from "../validators/activity.validators";

const router = Router();

router.use(authenticate);
router.get("/", validate({ query: activityQuerySchema }), listActivity);

export default router;
