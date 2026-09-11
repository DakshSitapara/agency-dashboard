import { Request, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { formatActivityMessage } from "../sockets/activityEmitter";

/**
 * Backs both the initial feed load and the "I was offline, what did I miss"
 * catchup. Nothing here is served from an in-memory cache/buffer - a server
 * restart or a user reconnecting from a different device gets an identical,
 * correct result because it's always a fresh DB read scoped by role.
 *
 * Query params:
 *   projectId  - optional, further narrows to one project (must still pass the role scope below)
 *   after      - ISO timestamp; if provided, returns events after it (catchup use case)
 *   limit      - defaults to 20 per the spec's "last 20 missed events"
 */
export const listActivity = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, after, limit } = req.query as {
      projectId?: string;
      after?: string;
      limit?: number;
    };
    const take = limit ?? 20;

    const where: Prisma.TaskActivityLogWhereInput = {};
    if (projectId) where.projectId = projectId;
    if (after) where.createdAt = { gt: new Date(after) };

    if (req.user!.role === Role.ADMIN) {
      // no extra scoping - global feed
    } else if (req.user!.role === Role.PM) {
      where.project = { createdById: req.user!.id };
    } else {
      // Developer: only activity on tasks assigned to them, regardless of project.
      where.task = { assignedToId: req.user!.id };
    }

    const logs = await prisma.taskActivityLog.findMany({
      where,
      include: { user: true, task: true, project: true },
      orderBy: { createdAt: "desc" },
      take,
    });

    const items = logs.map((log) => ({
      id: log.id,
      taskId: log.taskId,
      taskTitle: log.task.title,
      projectId: log.projectId,
      projectName: log.project.name,
      userId: log.userId,
      userName: log.user.name,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      message:
        log.message ||
        formatActivityMessage(
          log.user.name,
          log.task.title,
          log.fromStatus,
          log.toStatus,
        ),
      createdAt: log.createdAt.toISOString(),
    }));

    res.json({ success: true, data: items });
  },
);
