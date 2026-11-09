import type { Project, Task, Decision, Activity, TaskStatus, TaskPriority } from '../types';

const API_BASE = '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error ${response.status}: ${errorBody}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Projects
  async getProjects(): Promise<Project[]> {
    try {
      return await fetchJson<Project[]>(`${API_BASE}/projects`);
    } catch (e) {
      console.warn('Failed to fetch projects from API:', e);
      return [];
    }
  },

  async getProject(id: string): Promise<Project | null> {
    try {
      return await fetchJson<Project>(`${API_BASE}/projects/${id}`);
    } catch {
      return null;
    }
  },

  async createProject(data: { name: string; description?: string }): Promise<Project> {
    return fetchJson<Project>(`${API_BASE}/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProject(id: string, data: Partial<{ name: string; description?: string; status?: string }>): Promise<Project> {
    return fetchJson<Project>(`${API_BASE}/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteProject(id: string): Promise<void> {
    await fetchJson<void>(`${API_BASE}/projects/${id}`, {
      method: 'DELETE',
    });
  },

  // Tasks
  async getTasks(params?: { project_id?: string; status?: TaskStatus; priority?: TaskPriority }): Promise<Task[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.project_id) searchParams.append('project_id', params.project_id);
      if (params?.status) searchParams.append('status', params.status);
      if (params?.priority) searchParams.append('priority', params.priority);
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/tasks?${query}` : `${API_BASE}/tasks`;
      return await fetchJson<Task[]>(url);
    } catch (e) {
      console.warn('Failed to fetch tasks from API:', e);
      return [];
    }
  },

  async getProjectTasks(projectId: string, params?: { status?: TaskStatus; priority?: TaskPriority }): Promise<Task[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.append('status', params.status);
      if (params?.priority) searchParams.append('priority', params.priority);
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/projects/${projectId}/tasks?${query}` : `${API_BASE}/projects/${projectId}/tasks`;
      return await fetchJson<Task[]>(url);
    } catch (e) {
      console.warn('Failed to fetch project tasks:', e);
      return [];
    }
  },

  async getTask(id: string): Promise<Task | null> {
    try {
      return await fetchJson<Task>(`${API_BASE}/tasks/${id}`);
    } catch {
      return null;
    }
  },

  async createTask(data: {
    project_id: string;
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assignee?: string;
    due_date?: string;
    actor?: string;
  }): Promise<Task> {
    return fetchJson<Task>(`${API_BASE}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTask(
    id: string,
    data: Partial<{
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assignee?: string;
      due_date?: string;
      actor?: string;
    }>
  ): Promise<Task> {
    return fetchJson<Task>(`${API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteTask(id: string, actor?: string): Promise<void> {
    const url = actor ? `${API_BASE}/tasks/${id}?actor=${encodeURIComponent(actor)}` : `${API_BASE}/tasks/${id}`;
    await fetchJson<void>(url, {
      method: 'DELETE',
    });
  },

  // Decisions
  async getDecisions(params?: { project_id?: string }): Promise<Decision[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.project_id) searchParams.append('project_id', params.project_id);
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/decisions?${query}` : `${API_BASE}/decisions`;
      return await fetchJson<Decision[]>(url);
    } catch (e) {
      console.warn('Failed to fetch decisions from API:', e);
      return [];
    }
  },

  async getProjectDecisions(projectId: string): Promise<Decision[]> {
    try {
      return await fetchJson<Decision[]>(`${API_BASE}/projects/${projectId}/decisions`);
    } catch (e) {
      console.warn('Failed to fetch project decisions:', e);
      return [];
    }
  },

  async getDecision(id: string): Promise<Decision | null> {
    try {
      return await fetchJson<Decision>(`${API_BASE}/decisions/${id}`);
    } catch {
      return null;
    }
  },

  async createDecision(data: {
    project_id: string;
    title: string;
    description?: string;
    rationale?: string;
    decided_by?: string;
    decision_date?: string;
    actor?: string;
  }): Promise<Decision> {
    return fetchJson<Decision>(`${API_BASE}/decisions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateDecision(
    id: string,
    data: Partial<{
      title: string;
      description?: string;
      rationale?: string;
      decided_by?: string;
      decision_date?: string;
      actor?: string;
    }>
  ): Promise<Decision> {
    return fetchJson<Decision>(`${API_BASE}/decisions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteDecision(id: string, actor?: string): Promise<void> {
    const url = actor ? `${API_BASE}/decisions/${id}?actor=${encodeURIComponent(actor)}` : `${API_BASE}/decisions/${id}`;
    await fetchJson<void>(url, {
      method: 'DELETE',
    });
  },

  // Activities
  async getActivities(params?: { project_id?: string; order?: 'asc' | 'desc'; limit?: number }): Promise<Activity[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.project_id) searchParams.append('project_id', params.project_id);
      if (params?.order) searchParams.append('order', params.order);
      if (params?.limit) searchParams.append('limit', String(params.limit));
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/activities?${query}` : `${API_BASE}/activities`;
      return await fetchJson<Activity[]>(url);
    } catch (e) {
      console.warn('Failed to fetch activities from API:', e);
      return [];
    }
  },

  async getProjectActivities(projectId: string, params?: { order?: 'asc' | 'desc'; limit?: number }): Promise<Activity[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.order) searchParams.append('order', params.order);
      if (params?.limit) searchParams.append('limit', String(params.limit));
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/projects/${projectId}/activities?${query}` : `${API_BASE}/projects/${projectId}/activities`;
      return await fetchJson<Activity[]>(url);
    } catch (e) {
      console.warn('Failed to fetch project activities:', e);
      return [];
    }
  },
};


