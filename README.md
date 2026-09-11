# Agency Client Project Dashboard

A full-stack internal tool for a small agency to manage client projects, assign and track tasks, and watch team activity live — with real role-based access enforced at the API, not just hidden in the UI.

## Stack

| Layer           | Choice                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| Frontend        | React 18 + TypeScript (Vite)                                            |
| Backend         | Node.js + Express + TypeScript                                          |
| Database        | PostgreSQL                                                              |
| ORM             | Prisma                                                                  |
| Real-time       | Socket.io                                                               |
| Background jobs | node-cron                                                               |
| Auth            | JWT access token (in-memory) + rotating refresh token (HttpOnly cookie) |
| Validation      | Zod, server-side on every mutating route                                |

## Repository layout

```
backend/    Express API, Prisma schema + migrations, Socket.io server, cron job, seed script
frontend/   React + TypeScript client
docker-compose.yml   Postgres + backend + frontend for one-command local dev
```

## Local setup (Docker — preferred)

Requirements: Docker + Docker Compose.

```bash
git clone <your-repo-url>
cd agency-dashboard
docker compose up --build
```

This starts:

- Postgres on `localhost:5432`
- API + WebSocket server on `http://localhost:4000` (runs `prisma migrate deploy` automatically on boot)
- Frontend on `http://localhost:5173`

Then seed the database (one-time, from your host machine):

```bash
docker compose exec backend npm run seed
```

Open `http://localhost:5173` and sign in with any seeded account — password `Password123!` for all of them:

| Role      | Email                               | Notes                                                         |
| --------- | ----------------------------------- | ------------------------------------------------------------- |
| Admin     | admin@agency.test                   | Sees everything                                               |
| PM        | pm1@agency.test                     | Owns "Northwind Storefront Revamp" + "Bluepeak Client Portal" |
| PM        | pm2@agency.test                     | Owns "Verde Health Patient App"                               |
| Developer | dev1@agency.test … dev4@agency.test | Each has tasks assigned across the seeded projects            |

## Local setup (without Docker)

```bash
# 1. Postgres running locally, then:
cd backend
cp .env.example .env        # edit DATABASE_URL if needed
npm install
npx prisma generate
npx prisma migrate deploy   # applies the committed migration
npm run seed
npm run dev                 # http://localhost:4000

# in a second terminal
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

## Deploying

Vercel's serverless functions do not hold a persistent WebSocket connection, so deploy the frontend and backend separately:

### Backend (Railway, Render, or Fly.io)

Use a long-lived Node process with a managed PostgreSQL database. From the `backend` directory:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

The compiled backend entrypoint is emitted at `dist/src/index.js` because the TypeScript project also compiles the Prisma seed source.

Set these backend environment variables in the host dashboard. Generate long random values for both JWT secrets:

```text
NODE_ENV=production
DATABASE_URL=<managed PostgreSQL connection string>
CLIENT_ORIGIN=https://app.example.com
JWT_ACCESS_SECRET=<random 32+ character secret>
JWT_REFRESH_SECRET=<random 32+ character secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REFRESH_COOKIE_NAME=adb_refresh_token
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

Run `npx prisma migrate deploy` as the platform's release/pre-deploy command, not on every application restart. Run `npm run seed` only once against a new database; never run it against production data because it clears all rows first.

### Frontend (Vercel)

Create a Vercel project with `frontend` as the root directory:

```text
Build command: npm run build
Output directory: dist
```

Set `VITE_API_URL=https://api.example.com` in Vercel, redeploy, and configure the backend `CLIENT_ORIGIN` to the exact frontend origin. Socket.io connects to the same backend URL.

For reliable HttpOnly cookies, use frontend and backend subdomains under the same parent domain, such as `app.example.com` and `api.example.com`; `SameSite=lax` then remains valid. If the hosts are unrelated sites, do not simply switch to `SameSite=None`: add CSRF protection first, then use `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true`.

Production container entrypoints are also provided as `backend/Dockerfile.production` and `frontend/Dockerfile.production`. Build the frontend image with `--build-arg VITE_API_URL=https://api.example.com`. The backend container expects migrations to be run by the platform release command before starting `node dist/index.js`.

## Database schema

```
User (id, name, email, password[hashed], role, timestamps)
Client (id, name, email, timestamps)
Project (id, name, description, clientId → Client, createdById → User, timestamps)
Task (id, title, description, projectId → Project, assignedToId → User?, status, priority, dueDate, isOverdue, timestamps)
TaskActivityLog (id, taskId → Task, projectId → Project [denormalized], userId → User, fromStatus, toStatus, message, createdAt)
Notification (id, userId → User, type, message, relatedTaskId → Task?, isRead, createdAt)
RefreshToken (id, tokenHash[unique], userId → User, expiresAt, revoked, createdAt)
```

Full definitions live in `backend/prisma/schema.prisma`; the committed migration is in `backend/prisma/migrations/20260101000000_init/`.

### Indexing decisions

- `Task(projectId)`, `Task(assignedToId)`, `Task(status)`, `Task(priority)`, `Task(dueDate)` — each is an independent filter on the "all task lists support filtering by status/priority/due date" requirement, and each also backs a dashboard query (overdue count, tasks-by-status, tasks-by-priority).
- `Task(assignedToId, status)` composite — the Developer dashboard's single most common query is "my tasks, optionally by status"; a composite avoids a second lookup once the assignee is narrowed.
- `TaskActivityLog(projectId, createdAt)` — the live feed and its catchup endpoint always ask "events for this project (or scope), newest first," so this composite index directly matches that access pattern instead of relying on a full scan + sort.
- `Notification(userId, isRead, createdAt)` — the bell's only query is "my unread notifications, newest first."
- `Project(createdById)` — the PM ownership check (`WHERE createdById = me`) runs on nearly every PM-facing request.
- `User.email` unique index — login lookup and the "email already exists" check on user creation.
- `RefreshToken.tokenHash` unique index — refresh lookups are by hash, not by id, to support the rotation logic in `auth.controller.ts`.

`TaskActivityLog.projectId` is intentionally denormalized (it's derivable via `taskId → Task.projectId`) so the feed's hottest query never needs to join through Task just to filter by project.

## Architectural decisions

**WebSocket library: Socket.io**, not a raw `ws` server. The app needs rooms (per-project feed subscriptions, personal per-user channels, a role-wide admin channel), presence tracking, and automatic reconnection/backoff on the client — all built into Socket.io. Native WebSocket would mean re-implementing a room/broadcast layer by hand for no real benefit here, since this isn't a latency-critical binary-protocol use case. Long-polling and SSE were both explicitly out of scope for this task, and neither would fit the bidirectional `project:join`/`project:leave` subscription model anyway.

**Job scheduler: node-cron**, not Bull/BullMQ. The overdue-flagging job is a single periodic `UPDATE ... WHERE dueDate < now()` statement — no per-item retries, no external side effects, no need for a distributed worker pool. Bull would add a mandatory Redis dependency to run something `node-cron` already does correctly in a few lines. If this evolved into "send an email/webhook per newly-overdue task, with retries and backoff," Bull (or BullMQ) would become the right tool — see Known Limitations.

**Refresh token storage: HttpOnly cookie, not localStorage.** The access token is short-lived (15 min) and kept in memory only on the client — never persisted, so a page refresh always re-derives it via a silent `/auth/refresh` call. The refresh token is a JWT whose `jti`-equivalent (a `RefreshToken.id`) is looked up in Postgres on every refresh; it's hashed at rest, and rotated (revoked + reissued) on every use, so a stolen refresh token is only replayable exactly once before rotation invalidates it. Neither token is ever reachable by JavaScript running on the page, which is the actual point of `HttpOnly` — it closes the XSS-token-theft path that plain localStorage storage leaves open.

**Role enforcement is layered, not single-point.** `requireRole()` middleware rejects requests before they reach a handler at all. But role alone isn't sufficient — a PM calling a "PM-allowed" route with someone _else's_ project id in the URL is still a PM, just not the _right_ PM. So every controller that loads a specific project/task additionally calls `assertProjectAccess` / `assertTaskAccess` (`backend/src/utils/authz.ts`) against the row it just fetched, and throws `403` rather than silently filtering. The same split exists on the socket side: `project:join` re-runs the ownership check before letting a socket into a project's room.

**Real-time role-filtered feed.** Rather than one global "activity" broadcast channel that clients filter after receiving, the _server_ decides who receives each event at emit time (`sockets/activityEmitter.ts`): every status change is pushed to the admin role-room, the owning PM's personal room, the assigned developer's personal room, and the specific `project:{id}` room (which only admins/that project's PM can have joined). No client ever receives an event it isn't authorized to see, so there's no "hide it in the UI" step to get wrong.

## Known limitations

- No test suite is included; given the scope of this task, effort went into correctness of the access-control and real-time paths first. E2E and integration tests (Supertest + a test Postgres instance for the API, Playwright for the socket-driven UI) would be the next investment.
- No rate limiting on `/auth/login` — a brute-force lockout (or a library like `express-rate-limit`) belongs here before production use.
- File attachments on tasks are out of scope.
- The overdue job runs every 5 minutes; for a real deployment this interval and the "isOverdue" semantics on task deletion/reassignment edge cases would need a closer look.
- Notification types are limited to the two the spec calls for (assignment, moved-to-review); an overdue-task notification type exists in the schema but isn't wired up to avoid duplicate-notification churn from the 5-minute cron loop firing repeatedly.
- Socket auth uses the same short-lived access token as REST; a client whose access token expires mid-session will have its socket reject on reconnect until the app's silent refresh flow re-authenticates it — there's a small window where a stale socket could receive a 401-equivalent handshake failure that the client should retry, which today happens on the next natural reconnect rather than being proactively triggered by token refresh.
