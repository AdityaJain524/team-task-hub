# Team Task Manager — Backend (Node + Express + PostgreSQL)

Standalone REST API. Deploy this anywhere that runs Node.js (Render, Railway, Fly.io, your own VPS). The Lovable frontend points at this server's URL.

## Stack

- Node.js + Express (REST)
- PostgreSQL (raw SQL via `pg`)
- JWT authentication (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- Input validation (`zod`)

## Folder structure

```
server/
├── src/
│   ├── controllers/    # request handlers
│   ├── models/         # SQL queries (data layer)
│   ├── routes/         # express routers
│   ├── middleware/     # auth, validation, error handler
│   ├── db/
│   │   ├── pool.js     # pg connection pool
│   │   ├── schema.sql  # full SQL schema
│   │   └── init.js     # runs schema.sql
│   └── index.js        # app entry
├── .env.example
└── package.json
```

## Setup

### 1. Install PostgreSQL and create a database

```bash
createdb team_task_manager
```

### 2. Install dependencies

```bash
cd server
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# edit DATABASE_URL and JWT_SECRET
```

### 4. Initialize the database schema

```bash
npm run db:init
```

### 5. Run the API

```bash
npm run dev      # nodemon, hot reload
# or
npm start
```

Server runs on `http://localhost:4000`.

## Roles

- The **first** user to sign up becomes `admin` automatically.
- All later signups become `member`.
- Admins manage projects, members, and tasks. Members view their projects and update the status of tasks assigned to them.

## REST API

All authenticated endpoints expect: `Authorization: Bearer <jwt>`.

### Auth
| Method | Path              | Access | Body |
|--------|-------------------|--------|------|
| POST   | `/api/auth/signup`| public | `{ email, password, fullName }` |
| POST   | `/api/auth/login` | public | `{ email, password }` |
| GET    | `/api/auth/me`    | auth   | — |

### Projects
| Method | Path                                  | Access | Notes |
|--------|---------------------------------------|--------|-------|
| GET    | `/api/projects`                       | auth   | admins see all, members see their own |
| GET    | `/api/projects/:id`                   | auth   | member of project or admin |
| POST   | `/api/projects`                       | admin  | `{ name, description? }` |
| PUT    | `/api/projects/:id`                   | admin  | `{ name, description? }` |
| DELETE | `/api/projects/:id`                   | admin  | |
| GET    | `/api/projects/:id/members`           | auth   | |
| POST   | `/api/projects/:id/members`           | admin  | `{ userId }` |
| DELETE | `/api/projects/:id/members/:userId`   | admin  | |

### Tasks
| Method | Path                              | Access | Notes |
|--------|-----------------------------------|--------|-------|
| GET    | `/api/tasks/dashboard`            | auth   | counts: total, pending, in_progress, completed, overdue |
| GET    | `/api/tasks/mine`                 | auth   | tasks assigned to current user |
| GET    | `/api/tasks/project/:projectId`   | auth   | tasks in a project (member or admin) |
| POST   | `/api/tasks`                      | admin  | `{ projectId, title, description?, deadline?, assignedTo? }` |
| PUT    | `/api/tasks/:id`                  | admin  | full update |
| PATCH  | `/api/tasks/:id/status`           | auth   | assignee or admin: `{ status }` |
| DELETE | `/api/tasks/:id`                  | admin  | |

### Users
| Method | Path          | Access |
|--------|---------------|--------|
| GET    | `/api/users`  | admin  |

## Database schema

See `src/db/schema.sql`. Tables: `users`, `projects`, `project_members`, `tasks`. Enums: `app_role` (admin, member), `task_status` (pending, in_progress, completed). Foreign keys cascade where appropriate.

## Connecting the frontend

Point your frontend `fetch`/`axios` calls at `http://localhost:4000/api/...`, store the JWT from `/api/auth/login` in `localStorage`, and send it as `Authorization: Bearer <token>` on every authenticated request.
