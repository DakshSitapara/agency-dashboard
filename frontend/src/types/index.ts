export type Role = 'ADMIN' | 'PM' | 'DEVELOPER';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  clientId: string;
  client?: { id: string; name: string };
  createdById: string;
  _count?: { tasks: number };
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  projectId: string;
  project?: { id: string; name: string };
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string } | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  isOverdue: boolean;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  message: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: 'TASK_ASSIGNED' | 'TASK_MOVED_TO_REVIEW' | 'TASK_OVERDUE';
  message: string;
  relatedTaskId?: string | null;
  isRead: boolean;
  createdAt: string;
}
