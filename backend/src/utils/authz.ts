import { Project, Task, Role } from '@prisma/client';
import { AuthUser } from '../middleware/auth';
import { ApiError } from './ApiError';

/**
 * Role middleware alone only answers "is this endpoint allowed for this
 * role?". It does NOT answer "does this specific PM own this specific
 * project?" or "is this specific task assigned to this specific developer?".
 * Those checks must happen per-row, after the record is fetched, or a
 * Developer with a perfectly valid token for their own account could read
 * another developer's task by guessing/enumerating its id. These helpers are
 * called from controllers after the resource is loaded, and always throw
 * ApiError.forbidden (never silently filter) so access denial is explicit
 * and auditable.
 */

export function assertProjectAccess(user: AuthUser, project: Pick<Project, 'createdById'>) {
  if (user.role === Role.ADMIN) return;
  if (user.role === Role.PM) {
    if (project.createdById !== user.id) {
      throw ApiError.forbidden('You can only access projects you created');
    }
    return;
  }
  // Developers never get project-level access directly; they only ever see
  // individual tasks assigned to them (enforced by assertTaskAccess / query filters).
  throw ApiError.forbidden('Developers cannot access project-level data');
}

export function assertTaskAccess(user: AuthUser, task: Pick<Task, 'assignedToId'>, project: Pick<Project, 'createdById'>) {
  if (user.role === Role.ADMIN) return;
  if (user.role === Role.PM) {
    if (project.createdById !== user.id) {
      throw ApiError.forbidden('You can only access tasks on projects you created');
    }
    return;
  }
  if (user.role === Role.DEVELOPER) {
    if (task.assignedToId !== user.id) {
      throw ApiError.forbidden('You can only access tasks assigned to you');
    }
    return;
  }
}

/** Returns a Prisma `where` fragment scoping a task/activity/notification query to what this user may see. */
export function projectScopeFilter(user: AuthUser) {
  if (user.role === Role.ADMIN) return {};
  if (user.role === Role.PM) return { project: { createdById: user.id } };
  return {}; // developer scope is applied at the task level (assignedToId), not project level
}
