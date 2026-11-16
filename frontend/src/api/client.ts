import type {
  Activity,
  AuditLogItem,
  ConflictItem,
  ContinuityGraphData,
  Decision,
  DocumentItem,
  ExtractedClaim,
  HandoverReport,
  NodeDetail,
  Project,
  Task,
  TaskPriority,
  TaskStatus,
  User,
  UserRole,
} from '../types';
import { isValidUUID } from '../utils/uuid.ts';

const VITE_API_URL = import.meta.env?.VITE_API_URL;
export const API_BASE = VITE_API_URL
  ? `${VITE_API_URL.replace(/\/$/, '')}/api/v1`
  : '/api/v1';

let currentAuthToken: string | null = null;

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
  try {
    if (token) {
      localStorage.setItem('threadline_auth_token_v1', token);
    } else {
      localStorage.removeItem('threadline_auth_token_v1');
    }
  } catch {
    // ignore localStorage errors in non-browser env
  }
}

export function getAuthToken(): string | null {
  if (!currentAuthToken) {
    try {
      currentAuthToken = typeof localStorage !== 'undefined' ? localStorage.getItem('threadline_auth_token_v1') : null;
    } catch {
      currentAuthToken = null;
    }
  }
  return currentAuthToken;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
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
  // -------------------------------------------------------------
  // Auth & RBAC
  // -------------------------------------------------------------
  async login(usernameOrEmail: string, password: string): Promise<{ access_token: string; token_type: string; user: User }> {
    const res = await fetchJson<{ access_token: string; token_type: string; user: User }>(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username_or_email: usernameOrEmail, password }),
    });
    setAuthToken(res.access_token);
    return res;
  },

  async demoLogin(): Promise<{ access_token: string; token_type: string; user: User }> {
    const res = await fetchJson<{ access_token: string; token_type: string; user: User }>(`${API_BASE}/auth/demo-login`, {
      method: 'POST',
    });
    setAuthToken(res.access_token);
    return res;
  },

  async getMe(): Promise<User | null> {
    try {
      return await fetchJson<User>(`${API_BASE}/auth/me`);
    } catch {
      return null;
    }
  },

  async getUsers(): Promise<User[]> {
    try {
      return await fetchJson<User[]>(`${API_BASE}/auth/users`);
    } catch {
      return [];
    }
  },

  async changeUserRole(userId: string, role: UserRole): Promise<User> {
    return fetchJson<User>(`${API_BASE}/auth/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  logout() {
    setAuthToken(null);
  },

  // -------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------
  async getProjects(): Promise<Project[]> {
    try {
      return await fetchJson<Project[]>(`${API_BASE}/projects/`);
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
    return fetchJson<Project>(`${API_BASE}/projects/`, {
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

  async getProjectTasks(projectId: string): Promise<Task[]> {
    if (!isValidUUID(projectId)) return [];
    try {
      return await fetchJson<Task[]>(`${API_BASE}/projects/${projectId}/tasks`);
    } catch {
      return [];
    }
  },

  async getProjectDecisions(projectId: string): Promise<Decision[]> {
    if (!isValidUUID(projectId)) return [];
    try {
      return await fetchJson<Decision[]>(`${API_BASE}/projects/${projectId}/decisions`);
    } catch {
      return [];
    }
  },

  async getProjectActivities(projectId: string): Promise<Activity[]> {
    if (!isValidUUID(projectId)) return [];
    try {
      return await fetchJson<Activity[]>(`${API_BASE}/projects/${projectId}/activities`);
    } catch {
      return [];
    }
  },

  // -------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------
  async getTasks(params?: { project_id?: string; status?: TaskStatus; priority?: TaskPriority }): Promise<Task[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.project_id && isValidUUID(params.project_id)) {
        searchParams.append('project_id', params.project_id);
      }
      if (params?.status) searchParams.append('status', params.status);
      if (params?.priority) searchParams.append('priority', params.priority);
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/tasks/?${query}` : `${API_BASE}/tasks/`;
      return await fetchJson<Task[]>(url);
    } catch (e) {
      console.warn('Failed to fetch tasks from API:', e);
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
  }, actor?: string): Promise<Task> {
    const url = actor ? `${API_BASE}/tasks/?actor=${encodeURIComponent(actor)}` : `${API_BASE}/tasks/`;
    return fetchJson<Task>(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTask(id: string, data: Partial<Task>, actor?: string): Promise<Task> {
    const url = actor ? `${API_BASE}/tasks/${id}?actor=${encodeURIComponent(actor)}` : `${API_BASE}/tasks/${id}`;
    return fetchJson<Task>(url, {
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

  // -------------------------------------------------------------
  // Decisions
  // -------------------------------------------------------------
  async getDecisions(params?: { project_id?: string; skip?: number; limit?: number }): Promise<Decision[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.project_id && isValidUUID(params.project_id)) {
        searchParams.append('project_id', params.project_id);
      }
      if (params?.skip !== undefined) searchParams.append('skip', String(params.skip));
      if (params?.limit !== undefined) searchParams.append('limit', String(params.limit));
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/decisions/?${query}` : `${API_BASE}/decisions/`;
      return await fetchJson<Decision[]>(url);
    } catch (e) {
      console.warn('Failed to fetch decisions from API:', e);
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
  }, actor?: string): Promise<Decision> {
    const url = actor ? `${API_BASE}/decisions/?actor=${encodeURIComponent(actor)}` : `${API_BASE}/decisions/`;
    return fetchJson<Decision>(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateDecision(id: string, data: Partial<Decision>, actor?: string): Promise<Decision> {
    const url = actor ? `${API_BASE}/decisions/${id}?actor=${encodeURIComponent(actor)}` : `${API_BASE}/decisions/${id}`;
    return fetchJson<Decision>(url, {
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

  // -------------------------------------------------------------
  // Conflicts (Round 3 Feature 1)
  // -------------------------------------------------------------
  async getConflicts(projectId: string, status?: string): Promise<ConflictItem[]> {
    if (!isValidUUID(projectId)) return [];
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      return await fetchJson<ConflictItem[]>(`${API_BASE}/projects/${projectId}/conflicts/${query}`);
    } catch (e) {
      console.warn('Failed to fetch conflicts:', e);
      return [];
    }
  },

  async detectConflicts(projectId: string): Promise<{
    project_id: string;
    detected_count: number;
    open_count: number;
    resolved_count: number;
    conflicts: ConflictItem[];
  }> {
    if (!isValidUUID(projectId)) {
      throw new Error(`Invalid project ID: "${projectId}".`);
    }
    return fetchJson<{
      project_id: string;
      detected_count: number;
      open_count: number;
      resolved_count: number;
      conflicts: ConflictItem[];
    }>(`${API_BASE}/projects/${projectId}/conflicts/detect`, {
      method: 'POST',
    });
  },

  async getConflict(conflictId: string): Promise<ConflictItem | null> {
    if (!isValidUUID(conflictId)) return null;
    try {
      return await fetchJson<ConflictItem>(`${API_BASE}/conflicts/${conflictId}`);
    } catch {
      return null;
    }
  },

  async resolveConflict(
    conflictId: string,
    data: { status: string; resolution_notes?: string; resolved_by?: string }
  ): Promise<ConflictItem> {
    if (!isValidUUID(conflictId)) {
      throw new Error(`Invalid conflict ID: "${conflictId}".`);
    }
    return fetchJson<ConflictItem>(`${API_BASE}/conflicts/${conflictId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // -------------------------------------------------------------
  // Activities
  // -------------------------------------------------------------
  async getActivities(params?: { project_id?: string; limit?: number; order?: string }): Promise<Activity[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.order) searchParams.append('order', params.order);
      if (params?.project_id && isValidUUID(params.project_id)) {
        searchParams.append('project_id', params.project_id);
      }
      if (params?.limit !== undefined) searchParams.append('limit', String(params.limit));
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/activities/?${query}` : `${API_BASE}/activities/`;
      return await fetchJson<Activity[]>(url);
    } catch (e) {
      console.warn('Failed to fetch activities from API:', e);
      return [];
    }
  },

  async getProjectTimeline(projectId: string, limit?: number): Promise<Activity[]> {
    if (!isValidUUID(projectId)) return [];
    try {
      const url = limit ? `${API_BASE}/projects/${projectId}/timeline?limit=${limit}` : `${API_BASE}/projects/${projectId}/timeline`;
      return await fetchJson<Activity[]>(url);
    } catch {
      return [];
    }
  },

  // -------------------------------------------------------------
  // Documents & Sensitive Data
  // -------------------------------------------------------------
  async getDocuments(projectId?: string, redact: boolean = false): Promise<DocumentItem[]> {
    try {
      const searchParams = new URLSearchParams();
      if (projectId && isValidUUID(projectId)) {
        searchParams.append('project_id', projectId);
      }
      if (redact) searchParams.append('redact', 'true');
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/documents/?${query}` : `${API_BASE}/documents/`;
      return await fetchJson<DocumentItem[]>(url);
    } catch (e) {
      console.warn('Failed to fetch documents from API:', e);
      return [];
    }
  },

  async getDocument(id: string, redact: boolean = false): Promise<DocumentItem | null> {
    if (!isValidUUID(id)) return null;
    try {
      const url = redact ? `${API_BASE}/documents/${id}?redact=true` : `${API_BASE}/documents/${id}`;
      return await fetchJson<DocumentItem>(url);
    } catch {
      return null;
    }
  },

  async scanDocumentSensitive(id: string): Promise<{
    document_id: string;
    filename: string;
    total_sensitive_items: number;
    findings: Array<{ type: string; preview: string; start: number; end: number }>;
  }> {
    if (!isValidUUID(id)) {
      return { document_id: id, filename: '', total_sensitive_items: 0, findings: [] };
    }
    return fetchJson<{
      document_id: string;
      filename: string;
      total_sensitive_items: number;
      findings: Array<{ type: string; preview: string; start: number; end: number }>;
    }>(`${API_BASE}/documents/${id}/sensitive-scan`);
  },

  async uploadDocument(file: File, projectId?: string, author?: string): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId && isValidUUID(projectId)) {
      formData.append('project_id', projectId);
    }
    if (author) {
      formData.append('author', author);
    }

    const token = getAuthToken();
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Upload Error ${response.status}: ${errorBody}`);
    }

    return response.json();
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

  // -------------------------------------------------------------
  // AI Reviews
  // -------------------------------------------------------------
  async getReviews(params?: {
    project_id?: string;
    document_id?: string;
    category?: string;
    status?: string;
  }): Promise<ExtractedClaim[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.project_id && isValidUUID(params.project_id)) {
        searchParams.append('project_id', params.project_id);
      }
      if (params?.document_id && isValidUUID(params.document_id)) {
        searchParams.append('document_id', params.document_id);
      }
      if (params?.category) searchParams.append('category', params.category);
      if (params?.status) searchParams.append('status', params.status);
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/reviews/?${query}` : `${API_BASE}/reviews/`;
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

  // -------------------------------------------------------------
  // Continuity Map
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // Handover Reports & Lifecycle (Round 3 Feature 3)
  // -------------------------------------------------------------
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

  async sendHandoverAcknowledgement(reportId: string, notes?: string): Promise<HandoverReport> {
    if (!isValidUUID(reportId)) {
      throw new Error(`Invalid report ID: "${reportId}".`);
    }
    return fetchJson<HandoverReport>(`${API_BASE}/reports/${reportId}/send-acknowledgement`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  async acknowledgeHandover(reportId: string, notes?: string, acknowledgedBy?: string): Promise<HandoverReport> {
    if (!isValidUUID(reportId)) {
      throw new Error(`Invalid report ID: "${reportId}".`);
    }
    return fetchJson<HandoverReport>(`${API_BASE}/reports/${reportId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ notes, acknowledged_by: acknowledgedBy }),
    });
  },

  async requestHandoverClarification(reportId: string, clarificationNotes: string, requestedBy?: string): Promise<HandoverReport> {
    if (!isValidUUID(reportId)) {
      throw new Error(`Invalid report ID: "${reportId}".`);
    }
    return fetchJson<HandoverReport>(`${API_BASE}/reports/${reportId}/request-clarification`, {
      method: 'POST',
      body: JSON.stringify({ clarification_notes: clarificationNotes, requested_by: requestedBy }),
    });
  },

  async createHandoverVersion(reportId: string, title?: string): Promise<HandoverReport> {
    if (!isValidUUID(reportId)) {
      throw new Error(`Invalid report ID: "${reportId}".`);
    }
    return fetchJson<HandoverReport>(`${API_BASE}/reports/${reportId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  async getHandoverReports(projectId?: string, redact: boolean = false): Promise<HandoverReport[]> {
    try {
      const searchParams = new URLSearchParams();
      if (projectId && isValidUUID(projectId)) {
        searchParams.append('project_id', projectId);
      }
      if (redact) searchParams.append('redact', 'true');
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/reports/?${query}` : `${API_BASE}/reports/`;
      return await fetchJson<HandoverReport[]>(url);
    } catch (e) {
      console.warn('Failed to fetch handover reports:', e);
      return [];
    }
  },

  async getHandoverReport(reportId: string, redact: boolean = false): Promise<HandoverReport | null> {
    if (!isValidUUID(reportId)) return null;
    try {
      const url = redact ? `${API_BASE}/reports/${reportId}?redact=true` : `${API_BASE}/reports/${reportId}`;
      return await fetchJson<HandoverReport>(url);
    } catch {
      return null;
    }
  },

  getHandoverReportPdfUrl(reportId: string, redact: boolean = false): string {
    return redact ? `${API_BASE}/reports/${reportId}/pdf?redact=true` : `${API_BASE}/reports/${reportId}/pdf`;
  },

  // -------------------------------------------------------------
  // Audit Logs (Round 3 Feature 2)
  // -------------------------------------------------------------
  async getAuditLogs(projectId?: string, action?: string): Promise<AuditLogItem[]> {
    try {
      const searchParams = new URLSearchParams();
      if (projectId && isValidUUID(projectId)) {
        searchParams.append('project_id', projectId);
      }
      if (action) searchParams.append('action', action);
      const query = searchParams.toString();
      const url = query ? `${API_BASE}/audit-logs/?${query}` : `${API_BASE}/audit-logs/`;
      return await fetchJson<AuditLogItem[]>(url);
    } catch (e) {
      console.warn('Failed to fetch audit logs:', e);
      return [];
    }
  },
};
