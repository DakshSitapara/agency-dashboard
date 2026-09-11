import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { getOnlineUserCount } from "../sockets";

export const getDashboard = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user!;

    if (user.role === Role.ADMIN) {
      const [totalProjects, tasksByStatusRaw, overdueCount] = await Promise.all(
        [
          prisma.project.count(),
          prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
          prisma.task.count({ where: { isOverdue: true } }),
        ],
      );
      const tasksByStatus = Object.fromEntries(
        tasksByStatusRaw.map((r) => [r.status, r._count._all]),
      );

      return res.json({
        success: true,
        data: {
          role: "ADMIN",
          totalProjects,
          tasksByStatus,
          overdueCount,
          onlineUsers: getOnlineUserCount(), // live presence, sourced from the socket layer, not a DB poll
        },
      });
    }

    if (user.role === Role.PM) {
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [projects, tasksByPriorityRaw, upcoming] = await Promise.all([
        prisma.project.findMany({
          where: { createdById: user.id },
          include: { _count: { select: { tasks: true } } },
        }),
        prisma.task.groupBy({
          by: ["priority"],
          where: { project: { createdById: user.id } },
          _count: { _all: true },
        }),
        prisma.task.findMany({
          where: {
            project: { createdById: user.id },
            dueDate: { gte: now, lte: weekFromNow },
          },
          orderBy: { dueDate: "asc" },
          include: {
            assignedTo: { select: { name: true } },
            project: { select: { name: true } },
          },
        }),
      ]);
      const tasksByPriority = Object.fromEntries(
        tasksByPriorityRaw.map((r) => [r.priority, r._count._all]),
      );

      return res.json({
        success: true,
        data: {
          role: "PM",
          projects,
          tasksByPriority,
          upcomingDueDates: upcoming,
        },
      });
    }

    // DEVELOPER
    const tasks = await prisma.task.findMany({
      where: { assignedToId: user.id },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      include: { project: { select: { name: true } } },
    });
    res.json({ success: true, data: { role: "DEVELOPER", tasks } });
  },
);
