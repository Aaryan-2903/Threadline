import type {
  Project,
  Task,
  Decision,
  Activity,
  TaskStatus,
  TaskPriority,
  DocumentItem,
  ExtractedClaim,
  ContinuityGraphData,
  NodeDetail,
  HandoverReport,
} from '../types';
import { isValidUUID } from '../utils/uuid';

const VITE_API_URL = import.meta.env.VITE_API_URL;
const API_BASE = VITE_API_URL
  ? `${VITE_API_URL.replace(/\/$/, '')}/api/v1`
  : '/api/v1';

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
    if (!isValidUUID(id)) return null;
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
      if (params?.project_id && isValidUUID(params.project_id)) {
        searchParams.append('project_id', params.project_id);
      }
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
    if (!isValidUUID(projectId)) return [];
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
    if (!isValidUUID(id)) return null;
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
      if (params?.project_id && isValidUUID(params.project_id)) {
        searchParams.append('project_id', params.project_id);
      }
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/decisions?${query}` : `${API_BASE}/decisions`;
      return await fetchJson<Decision[]>(url);
    } catch (e) {
      console.warn('Failed to fetch decisions from API:', e);
      return [];
    }
  },

  async getProjectDecisions(projectId: string): Promise<Decision[]> {
    if (!isValidUUID(projectId)) return [];
    try {
      return await fetchJson<Decision[]>(`${API_BASE}/projects/${projectId}/decisions`);
    } catch (e) {
      console.warn('Failed to fetch project decisions:', e);
      return [];
    }
  },

  async getDecision(id: string): Promise<Decision | null> {
    if (!isValidUUID(id)) return null;
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
      if (params?.project_id && isValidUUID(params.project_id)) {
        searchParams.append('project_id', params.project_id);
      }
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
    if (!isValidUUID(projectId)) return [];
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

  // Documents
  async uploadDocument(file: File, projectId?: string, author?: string): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId && isValidUUID(projectId)) formData.append('project_id', projectId);
    if (author) formData.append('author', author);

    const response = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Upload failed (${response.status}): ${err}`);
    }

    return response.json();
  },

  async getDocuments(projectId?: string): Promise<DocumentItem[]> {
    try {
      const url = projectId && isValidUUID(projectId)
        ? `${API_BASE}/documents?project_id=${projectId}`
        : `${API_BASE}/documents`;
      return await fetchJson<DocumentItem[]>(url);
    } catch (e) {
      console.warn('Failed to fetch documents from API:', e);
      return [];
    }
  },

  async getDocument(id: string): Promise<DocumentItem | null> {
    if (!isValidUUID(id)) return null;
    try {
      return await fetchJson<DocumentItem>(`${API_BASE}/documents/${id}`);
    } catch {
      return null;
    }
  },

  async deleteDocument(id: string): Promise<void> {
    await fetchJson<void>(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
    });
  },

  async reprocessDocument(id: string): Promise<DocumentItem> {
    return fetchJson<DocumentItem>(`${API_BASE}/documents/${id}/process`, {
      method: 'POST',
    });
  },

  // AI Reviews
  async getReviews(params?: {
    project_id?: string;
    document_id?: string;
    status?: string;
    category?: string;
  }): Promise<ExtractedClaim[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.project_id && isValidUUID(params.project_id)) {
        searchParams.append('project_id', params.project_id);
      }
      if (params?.document_id && isValidUUID(params.document_id)) {
        searchParams.append('document_id', params.document_id);
      }
      if (params?.status) searchParams.append('status', params.status);
      if (params?.category) searchParams.append('category', params.category);
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/reviews?${query}` : `${API_BASE}/reviews`;
      return await fetchJson<ExtractedClaim[]>(url);
    } catch (e) {
      console.warn('Failed to fetch reviews from API:', e);
      return [];
    }
  },

  async getReview(id: string): Promise<ExtractedClaim | null> {
    if (!isValidUUID(id)) return null;
    try {
      return await fetchJson<ExtractedClaim>(`${API_BASE}/reviews/${id}`);
    } catch {
      return null;
    }
  },

  async approveReview(id: string, actor?: string): Promise<ExtractedClaim> {
    const url = actor ? `${API_BASE}/reviews/${id}/approve?actor=${encodeURIComponent(actor)}` : `${API_BASE}/reviews/${id}/approve`;
    return fetchJson<ExtractedClaim>(url, {
      method: 'PATCH',
    });
  },

  async rejectReview(id: string, actor?: string): Promise<ExtractedClaim> {
    const url = actor ? `${API_BASE}/reviews/${id}/reject?actor=${encodeURIComponent(actor)}` : `${API_BASE}/reviews/${id}/reject`;
    return fetchJson<ExtractedClaim>(url, {
      method: 'PATCH',
    });
  },

  async updateReview(id: string, data: Partial<ExtractedClaim>, actor?: string): Promise<ExtractedClaim> {
    const url = actor ? `${API_BASE}/reviews/${id}?actor=${encodeURIComponent(actor)}` : `${API_BASE}/reviews/${id}`;
    return fetchJson<ExtractedClaim>(url, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async approveAllReviews(params?: {
    project_id?: string;
    document_id?: string;
    actor?: string;
  }): Promise<{ message: string; approved_count: number }> {
    const searchParams = new URLSearchParams();
    if (params?.project_id && isValidUUID(params.project_id)) {
      searchParams.append('project_id', params.project_id);
    }
    if (params?.document_id && isValidUUID(params.document_id)) {
      searchParams.append('document_id', params.document_id);
    }
    if (params?.actor) searchParams.append('actor', params.actor);
    const query = searchParams.toString();
    const url = query ? `${API_BASE}/reviews/approve-all?${query}` : `${API_BASE}/reviews/approve-all`;
    return fetchJson<{ message: string; approved_count: number }>(url, {
      method: 'POST',
    });
  },

  // Continuity Map
  async getContinuityGraph(projectId: string): Promise<ContinuityGraphData> {
    if (!isValidUUID(projectId)) {
      return {
        project_id: projectId,
        project_name: '',
        nodes: [],
        edges: [],
        entity_counts: {
          decisions: 0,
          tasks: 0,
          risks: 0,
          documents: 0,
          owners: 0,
          questions: 0,
          conflicts: 0,
        },
        orphan_count: 0,
        blocking_paths_count: 0,
      };
    }
    return fetchJson<ContinuityGraphData>(`${API_BASE}/continuity/graph?project_id=${projectId}`);
  },

  async getContinuityNodeDetail(projectId: string, nodeId: string): Promise<NodeDetail | null> {
    if (!isValidUUID(projectId)) return null;
    try {
      return await fetchJson<NodeDetail>(`${API_BASE}/continuity/nodes/${nodeId}?project_id=${projectId}`);
    } catch {
      return null;
    }
  },

  // Handover Reports
  async generateHandoverReport(
    projectId: string,
    actor?: string,
    incomingOwner?: string,
    incomingOwnerRole?: string
  ): Promise<HandoverReport> {
    if (!isValidUUID(projectId)) {
      throw new Error(`Invalid project ID: "${projectId}". A valid UUID is required.`);
    }
    const searchParams = new URLSearchParams();
    searchParams.append('project_id', projectId);
    if (actor) searchParams.append('actor', actor);
    if (incomingOwner) searchParams.append('incoming_owner', incomingOwner);
    if (incomingOwnerRole) searchParams.append('incoming_owner_role', incomingOwnerRole);
    return fetchJson<HandoverReport>(`${API_BASE}/reports/generate?${searchParams.toString()}`, {
      method: 'POST',
    });
  },

  async updateReportSuccessor(
    reportId: string,
    data: { incoming_owner?: string; incoming_owner_role?: string }
  ): Promise<HandoverReport> {
    if (!isValidUUID(reportId)) {
      throw new Error(`Invalid report ID: "${reportId}". A valid UUID is required.`);
    }
    return fetchJson<HandoverReport>(`${API_BASE}/reports/${reportId}/successor`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async getHandoverReports(projectId?: string): Promise<HandoverReport[]> {
    try {
      const url = projectId && isValidUUID(projectId)
        ? `${API_BASE}/reports?project_id=${projectId}`
        : `${API_BASE}/reports`;
      return await fetchJson<HandoverReport[]>(url);
    } catch (e) {
      console.warn('Failed to fetch handover reports:', e);
      return [];
    }
  },

  async getHandoverReport(reportId: string): Promise<HandoverReport | null> {
    if (!isValidUUID(reportId)) return null;
    try {
      return await fetchJson<HandoverReport>(`${API_BASE}/reports/${reportId}`);
    } catch {
      return null;
    }
  },

  getHandoverReportPdfUrl(reportId: string): string {
    return `${API_BASE}/reports/${reportId}/pdf`;
  },
};
