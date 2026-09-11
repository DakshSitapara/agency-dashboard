import { z } from "zod";

export const activityQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  after: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
