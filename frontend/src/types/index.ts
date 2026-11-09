export type ProjectStatus = 'active' | 'in_handover' | 'review' | 'completed' | 'archived';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus | string;
  created_at: string;
  updated_at: string;
  // UI enrichment fields from Stitch designs
  code?: string;
  progress?: number;
  total_tasks?: number;
  completed_tasks?: number;
  decisions_count?: number;
  documents_count?: number;
  health_status?: 'verified' | 'review_required' | 'high_risk' | 'pending';
  health_label?: string;
  outgoing_owner?: { name: string; avatar: string; role: string };
  incoming_owner?: { name: string; avatar: string; role: string };
  last_activity?: string;
  handover_days_left?: number;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  identifier?: string;
  handover_impact?: string;
}

export interface Decision {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  rationale?: string;
  decided_by?: string;
  decision_date?: string;
  created_at: string;
  updated_at: string;
  identifier?: string;
  category?: string;
  status?: 'approved' | 'pending_review' | 'ratified';
  link?: string;
}

export interface Activity {
  id: string;
  project_id: string;
  event_type: string;
  description: string;
  actor?: string;
  entity_type?: string;
  entity_id?: string;
  timestamp: string;
}

export type ScreenId =
  | 'overview'
  | 'my-projects'
  | 'project-workspace'
  | 'my-tasks'
  | 'decisions'
  | 'activity'
  | 'documents'
  | 'handover-reports'
  | 'ai-review-queue'
  | 'continuity-map'
  | 'settings'
  | 'help-docs';

