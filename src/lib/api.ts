const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function fetcher(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  
  if (response.status === 204) return null;
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type AppRole = 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee_name?: string;
  assignee_email?: string;
  project_name?: string;
}

export interface DashboardStats {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
  overdue: number;
  tasksPerUser?: { full_name: string; count: number }[];
}

// ===== AUTH =====
export const authApi = {
  signup: async (email: string, password: string, fullName: string) => {
    const data = await fetcher('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    });
    localStorage.setItem('token', data.token);
    return data;
  },
  login: async (email: string, password: string) => {
    const data = await fetcher('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', data.token);
    return data;
  },
  logout: async () => {
    localStorage.removeItem('token');
  },
  me: async () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const data = await fetcher('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return data.user as User;
    } catch (e) {
      localStorage.removeItem('token');
      return null;
    }
  },
};

// ===== PROJECTS =====
export const projectsApi = {
  list: async () => {
    const data = await fetcher('/projects');
    return data.projects as Project[];
  },
  get: async (id: string) => {
    const data = await fetcher(`/projects/${id}`);
    return data.project as Project;
  },
  create: async (input: { name: string; description?: string }) => {
    const data = await fetcher('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.project as Project;
  },
  remove: async (id: string) => {
    await fetcher(`/projects/${id}`, { method: 'DELETE' });
  },
};

// ===== MEMBERS =====
export const membersApi = {
  listForProject: async (projectId: string) => {
    const data = await fetcher(`/projects/${projectId}/members`);
    return data.members;
  },
  add: async (projectId: string, userId: string) => {
    await fetcher(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },
  remove: async (projectId: string, userId: string) => {
    await fetcher(`/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    });
  },
  allProfiles: async () => {
    const data = await fetcher('/users');
    return data.users;
  },
  create: async (input: { email: string; password: string; fullName: string; role: AppRole }) => {
    const data = await fetcher('/users', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.user as User;
  },
  updateRole: async (userId: string, role: AppRole) => {
    const data = await fetcher(`/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    return data.user as User;
  },
};

// ===== TASKS =====
export const tasksApi = {
  listForProject: async (projectId: string) => {
    const data = await fetcher(`/tasks/project/${projectId}`);
    return data.tasks as Task[];
  },
  listMine: async () => {
    const data = await fetcher('/tasks/mine');
    return data.tasks as Task[];
  },
  create: async (input: {
    projectId: string; title: string; description?: string | null;
    deadline?: string | null; assignedTo?: string | null;
  }) => {
    const data = await fetcher('/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.task as Task;
  },
  update: async (id: string, input: Partial<Task>) => {
    const data = await fetcher(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    return data.task as Task;
  },
  updateStatus: async (id: string, status: TaskStatus) => {
    const data = await fetcher(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return data.task as Task;
  },
  remove: async (id: string) => {
    await fetcher(`/tasks/${id}`, { method: 'DELETE' });
  },
  getDashboardStats: async () => {
    const data = await fetcher('/tasks/dashboard');
    return data.stats as DashboardStats;
  }
};
