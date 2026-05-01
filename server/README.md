# Team Task Manager — Backend

Node.js + Express + PostgreSQL backend.

## Scripts
- `npm start`: Run the server in production.
- `npm run dev`: Run the server with nodemon for development.
- `npm run db:init`: Initialize/reset the database schema using `src/db/schema.sql`.

## API Documentation

### Auth
- `POST /api/auth/signup`: Create a new account.
- `POST /api/auth/login`: Login and receive a JWT.
- `POST /api/auth/verify`: Verify a JWT and get user info.

### Projects
- `GET /api/projects`: List projects (Admin: all, Member: assigned).
- `POST /api/projects`: Create a project (Admin only).
- `GET /api/projects/:id`: Get project details.
- `DELETE /api/projects/:id`: Delete a project (Admin only).
- `GET /api/projects/:id/members`: List project members.
- `POST /api/projects/:id/members`: Add a member to project (Admin only).
- `DELETE /api/projects/:id/members/:userId`: Remove a member (Admin only).

### Tasks
- `GET /api/tasks/dashboard`: Get dashboard statistics.
- `GET /api/tasks/mine`: Get tasks assigned to current user.
- `GET /api/tasks/project/:projectId`: Get tasks for a project.
- `POST /api/tasks`: Create a task (Admin only).
- `PUT /api/tasks/:id`: Update a task (Admin only).
- `PATCH /api/tasks/:id/status`: Update task status (Assignee or Admin).
- `DELETE /api/tasks/:id`: Delete a task (Admin only).

### Users
- `GET /api/users`: List all users (Admin only).
- `POST /api/users`: Create a new user with a specific role (Admin only).
- `PATCH /api/users/:id/role`: Update a user's role (Admin only).
