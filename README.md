# Team Task Manager

A professional, full-stack collaborative task management application built with **React (TypeScript)**, **Node.js (Express)**, and **PostgreSQL**.

## 🚀 Features

- **Dual Portals:** Dedicated "Admin" and "Team Member" portals for specialized workflows.
- **Secure Authentication:** JWT-based auth with protected routes and role-based access control (RBAC).
- **Team Management:** Administrators can create new users, promote members to admins, and manage roles.
- **Project Management:** Create projects, describe goals, and manage dedicated project teams.
- **Task Management:** Create, assign, and track tasks with status updates (To Do, In Progress, Done), deadlines, priority levels, and assignees.
- **Dynamic Dashboard:** Real-time analytics, status breakdowns, overdue task alerts, and "Tasks per User" visualization for admins.
- **Modern UI:** Built with Tailwind CSS, Shadcn UI, and Lucide icons for a polished, responsive experience.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, React Query, Tailwind CSS, Shadcn UI, Recharts.
- **Backend:** Node.js, Express, PostgreSQL (pg), Zod (Validation), JWT (Auth), Bcrypt.
- **DevOps:** Docker Compose (Local Database), npm.

---

## 🏁 Getting Started

Follow these steps to get the application running on your local machine.

### Prerequisites
- **Node.js** (v18 or higher)
- **Docker & Docker Compose** (for the database)

### 1. Clone & Install
```bash
# Clone the repository
git clone <your-repo-url>
cd team-task-hub

# Install Frontend dependencies
npm install

# Install Backend dependencies
cd server
npm install
cd ..
```

### 2. Environment Configuration
You need to set up environment variables for both the frontend and the backend.

#### Backend (`server/.env`)
Create a file at `server/.env`:
```env
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/team_task_manager
JWT_SECRET=super-secret-dev-key-12345
CORS_ORIGIN=http://localhost:5173
```

#### Frontend (`.env`)
Create a file in the root directory `.env`:
```env
VITE_API_URL=http://localhost:4000/api
```

### 3. Database & Seeding
Start the PostgreSQL container and initialize the schema:

```bash
# 1. Start the database (from the root directory)
docker-compose up -d

# 2. Initialize schema and seed default admin (from the 'server' directory)
cd server
npm run db:init
```

> **Note:** `npm run db:init` will create the necessary tables and seed the default administrator account.

---

## 🔐 Default Admin Credentials

Once the database is initialized, you can log in to the **Admin Portal** using:

- **Email:** `adminmanager@gmail.com`
- **Password:** `admin123`

---

## 🏃‍♂️ Running the App

You will need two terminal windows open:

**Terminal 1: Backend**
```bash
cd server
npm run dev
```
*Server runs on `http://localhost:4000`*

**Terminal 2: Frontend**
```bash
# From the root directory
npm run dev
```
*App runs on `http://localhost:5173`*

---

## 📂 Project Structure

- `/server`: Node.js/Express backend.
  - `/src/controllers`: API logic.
  - `/src/models`: Database queries (PostgreSQL).
  - `/src/db`: Schema and initialization scripts.
- `/src`: React frontend.
  - `/pages`: Main application views.
  - `/components`: Reusable UI elements.
  - `/hooks`: Custom React hooks (Auth, etc.).
  - `/lib/api.ts`: Centralized API client.

---

## 🚀 Deployment (Railway)

1. **Database:** Create a PostgreSQL service on Railway.
2. **Backend:** 
   - Connect your GitHub repo.
   - Set the Root Directory to `server`.
   - Add variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (your frontend URL).
3. **Frontend:**
   - Connect the same repo.
   - Set the Root Directory to `/`.
   - Add variable: `VITE_API_URL` (your backend URL).
