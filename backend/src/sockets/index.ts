import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Role } from '@prisma/client';
import { env } from '../config/env';
import { verifyAccessToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { assertProjectAccess } from '../utils/authz';

interface SocketUser {
  id: string;
  role: Role;
}

let io: Server | null = null;

// userId -> set of socket ids. Used purely for live presence count; this is
// NOT where missed-event catchup data comes from (that's always the DB - see
// activity.controller.ts `GET /activity?catchup=true`), so a server restart
// only resets the presence count, never loses activity history.
const onlineUsers = new Map<string, Set<string>>();

function broadcastPresence() {
  if (!io) return;
  io.to('role:ADMIN').emit('presence:count', { count: onlineUsers.size });
}

export function initSockets(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
  });

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('Missing auth token'));
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return next(new Error('User not found'));
      (socket.data as { user: SocketUser }).user = { id: user.id, role: user.role };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket.data as { user: SocketUser }).user;

    // Every authenticated socket joins a personal room (notifications, and -
    // for PMs/Developers - their own scoped activity feed) and a role room
    // (admins' global feed + presence broadcasts).
    socket.join(`user:${user.id}`);
    socket.join(`role:${user.role}`);

    if (!onlineUsers.has(user.id)) onlineUsers.set(user.id, new Set());
    onlineUsers.get(user.id)!.add(socket.id);
    broadcastPresence();

    // A client viewing a specific project's page asks to join its room so it
    // gets every live update for that project, not just ones concerning the
    // viewer personally. Access is re-checked here server-side - a Developer
    // or another PM's socket cannot join a project room they don't own.
    socket.on('project:join', async (projectId: string, ack?: (ok: boolean, error?: string) => void) => {
      try {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return ack?.(false, 'Project not found');
        if (user.role === Role.DEVELOPER) {
          // Developers never get the full project feed, only their own tasks -
          // already covered by their personal user:{id} room.
          return ack?.(false, 'Developers cannot subscribe to project-wide feeds');
        }
        assertProjectAccess({ ...user, name: '', email: '' }, project);
        socket.join(`project:${projectId}`);
        ack?.(true);
      } catch (err) {
        ack?.(false, err instanceof Error ? err.message : 'Access denied');
      }
    });

    socket.on('project:leave', (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on('disconnect', () => {
      const set = onlineUsers.get(user.id);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) onlineUsers.delete(user.id);
      }
      broadcastPresence();
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized yet');
  return io;
}

export function getOnlineUserCount(): number {
  return onlineUsers.size;
}
