import { Request, Response } from "express";
import { Prisma, Role, NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { assertProjectAccess, assertTaskAccess } from "../utils/authz";
import {
  emitActivityEvent,
  emitNotification,
  formatActivityMessage,
} from "../sockets/activityEmitter";

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const { title, description, projectId, assignedToId, priority, dueDate } =
    req.body;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw ApiError.notFound("Project not found");
  assertProjectAccess(req.user!, project); // only the owning PM or an Admin may add tasks

  if (assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
    });
    if (!assignee || assignee.role !== Role.DEVELOPER) {
      throw ApiError.badRequest(
        "assignedToId must reference an existing Developer",
      );
    }
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      projectId,
      assignedToId: assignedToId ?? null,
      priority: priority ?? undefined,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  if (assignedToId) {
    const notification = await prisma.notification.create({
      data: {
        userId: assignedToId,
        type: NotificationType.TASK_ASSIGNED,
        message: `You were assigned to "${task.title}"`,
        relatedTaskId: task.id,
      },
    });
    emitNotification(notification);
  }

  res.status(201).json({ success: true, data: task });
});

/**
 * Role-scoped list with shareable-URL filters (status/priority/due date
 * range) applied entirely in the WHERE clause, so pagination and filtering
 * stay correct together and a Developer's query can never widen past their
 * own assigned tasks no matter what query params are supplied.
 */
export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  const {
    status,
    priority,
    dueFrom,
    dueTo,
    projectId,
    page = 1,
    pageSize = 20,
  } = req.query as any;

  const where: Prisma.TaskWhereInput = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (dueFrom || dueTo) {
    where.dueDate = {
      ...(dueFrom ? { gte: new Date(dueFrom) } : {}),
      ...(dueTo ? { lte: new Date(dueTo) } : {}),
    };
  }
  if (projectId) where.projectId = projectId;

  if (req.user!.role === Role.DEVELOPER) {
    where.assignedToId = req.user!.id; // hard floor - cannot be overridden by any query param above
  } else if (req.user!.role === Role.PM) {
    where.project = { createdById: req.user!.id };
  }
  // Admin: no additional scope restriction.

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.task.count({ where }),
  ]);

  res.json({ success: true, data: { items, total, page, pageSize } });
});

export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      project: true,
      assignedTo: true,
      activityLogs: { include: { user: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!task) throw ApiError.notFound("Task not found");
  assertTaskAccess(req.user!, task, task.project);
  res.json({ success: true, data: task });
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { project: true },
  });
  if (!task) throw ApiError.notFound("Task not found");
  // Only Admin/owning PM can edit task fields (reassign, reprioritize, etc).
  // Developers use the dedicated status-only endpoint below.
  assertProjectAccess(req.user!, task.project);

  const { dueDate, assignedToId, ...rest } = req.body;
  if (assignedToId !== undefined && assignedToId !== null) {
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
    });
    if (!assignee || assignee.role !== Role.DEVELOPER) {
      throw ApiError.badRequest(
        "assignedToId must reference an existing Developer",
      );
    }
  }
  const nextDueDate =
    dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : task.dueDate;
  const nextStatus = rest.status ?? task.status;
  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      ...rest,
      ...(assignedToId !== undefined ? { assignedToId } : {}),
      ...(dueDate !== undefined ? { dueDate: nextDueDate } : {}),
      isOverdue: Boolean(
        nextDueDate && nextStatus !== "DONE" && nextDueDate < new Date(),
      ),
    },
  });

  if (assignedToId && assignedToId !== task.assignedToId) {
    const notification = await prisma.notification.create({
      data: {
        userId: assignedToId,
        type: NotificationType.TASK_ASSIGNED,
        message: `You were assigned to "${updated.title}"`,
        relatedTaskId: updated.id,
      },
    });
    emitNotification(notification);
  }

  res.json({ success: true, data: updated });
});

/**
 * The one endpoint Developers can call to change a task. Every transition is
 * written to TaskActivityLog with a timestamp and the acting user - this is
 * an immutable, queried-from-DB audit trail, never derived from Task.status
 * after the fact.
 */
export const updateTaskStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { status } = req.body;
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { project: true },
    });
    if (!task) throw ApiError.notFound("Task not found");
    assertTaskAccess(req.user!, task, task.project);

    if (task.status === status) {
      return res.json({ success: true, data: task });
    }

    const message = formatActivityMessage(
      req.user!.name,
      task.title,
      task.status,
      status,
    );

    const [updatedTask, log] = await prisma.$transaction([
      prisma.task.update({
        where: { id: task.id },
        data: { status, isOverdue: status === "DONE" ? false : task.isOverdue },
      }),
      prisma.taskActivityLog.create({
        data: {
          taskId: task.id,
          projectId: task.projectId,
          userId: req.user!.id,
          fromStatus: task.status,
          toStatus: status,
          message,
        },
      }),
    ]);

    const actor = req.user!;
    emitActivityEvent(log, updatedTask, task.project, {
      id: actor.id,
      name: actor.name,
    } as any);

    if (status === "IN_REVIEW") {
      const notification = await prisma.notification.create({
        data: {
          userId: task.project.createdById,
          type: NotificationType.TASK_MOVED_TO_REVIEW,
          message: `"${task.title}" was moved to In Review by ${actor.name}`,
          relatedTaskId: task.id,
        },
      });
      emitNotification(notification);
    }

    res.json({ success: true, data: updatedTask });
  },
);
