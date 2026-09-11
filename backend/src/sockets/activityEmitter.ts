import { TaskActivityLog, Task, Project, User, Notification } from '@prisma/client';
import { getIO } from './index';

export type ActivityFeedItem = {
  id: string;
  taskId: string;
  projectId: string;
  projectName: string;
  taskTitle: string;
  userId: string;
  userName: string;
  fromStatus: string | null;
  toStatus: string;
  message: string;
  createdAt: string;
};

export function formatActivityMessage(userName: string, taskTitle: string, fromStatus: string | null, toStatus: string) {
  const from = fromStatus ? prettyStatus(fromStatus) : null;
  const to = prettyStatus(toStatus);
  return from
    ? `${userName} moved "${taskTitle}" from ${from} → ${to}`
    : `${userName} set "${taskTitle}" to ${to}`;
}

function prettyStatus(s: string) {
  return s.replace('_', ' ').replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

/**
 * Fans a single activity event out to exactly the audiences allowed to see
 * it, mirroring the read-side role rules 1:1:
 *  - `role:ADMIN`        -> global feed, every event
 *  - `project:{id}`      -> anyone (admin/PM) actively viewing that project page
 *  - `user:{pmId}`       -> the PM who owns the project (their scoped feed, even off the project page)
 *  - `user:{devId}`      -> the developer assigned to the task (their scoped feed)
 * No event is ever broadcast unfiltered - there is no global "activity" room
 * a client can join to see everything regardless of role.
 */
export function emitActivityEvent(
  log: TaskActivityLog,
  task: Task,
  project: Project,
  actor: User
) {
  const io = getIO();
  const payload: ActivityFeedItem = {
    id: log.id,
    taskId: task.id,
    projectId: project.id,
    projectName: project.name,
    taskTitle: task.title,
    userId: actor.id,
    userName: actor.name,
    fromStatus: log.fromStatus,
    toStatus: log.toStatus,
    message: log.message,
    createdAt: log.createdAt.toISOString(),
  };

  io.to('role:ADMIN').emit('activity:new', payload);
  io.to(`project:${project.id}`).emit('activity:new', payload);
  io.to(`user:${project.createdById}`).emit('activity:new', payload);
  if (task.assignedToId) {
    io.to(`user:${task.assignedToId}`).emit('activity:new', payload);
  }
}

export function emitNotification(notification: Notification) {
  const io = getIO();
  io.to(`user:${notification.userId}`).emit('notification:new', {
    id: notification.id,
    type: notification.type,
    message: notification.message,
    relatedTaskId: notification.relatedTaskId,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  });
}
