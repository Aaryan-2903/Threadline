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
  metadata_json?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
}

export type DocumentStatus = 'uploaded' | 'processing' | 'extracted' | 'error';

export interface DocumentItem {
  id: string;
  project_id?: string;
  filename: string;
  file_type: 'pdf' | 'docx' | string;
  file_size: number;
  author?: string;
  status: DocumentStatus;
  error_message?: string;
  extracted_claims_count: number;
  page_count: number;
  created_at: string;
  updated_at: string;
  project_name?: string;
}

export type KnowledgeCategory = 'decision' | 'task' | 'risk' | 'question' | 'conflict';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface ExtractedClaim {
  id: string;
  document_id: string;
  project_id?: string;
  category: KnowledgeCategory;
  title: string;
  content?: string;
  evidence_snippet?: string;
  source_reference?: string;
  page_number?: number;
  confidence: number;
  status: VerificationStatus;
  owner?: string;
  impact_scope?: string;
  created_at: string;
  updated_at: string;
  document_name?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  entity_type: 'project' | 'document' | 'decision' | 'task' | 'owner' | 'risk' | 'question' | 'conflict';
  status?: string;
  subtitle?: string;
  source_doc?: string;
  evidence_quote?: string;
  citation?: string;
  owner?: string;
  impact_scope?: string;
  is_orphan?: boolean;
  metadata?: Record<string, unknown>;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  inferred?: boolean;
  status?: string;
}

export interface ContinuityGraphData {
  project_id: string;
  project_name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  entity_counts: {
    decisions: number;
    tasks: number;
    risks: number;
    documents: number;
    owners: number;
    questions: number;
    conflicts: number;
  };
  orphan_count: number;
  blocking_paths_count: number;
}

export interface NodeDetail {
  node: GraphNode;
  connected_nodes: GraphNode[];
  incoming_edges: GraphEdge[];
  outgoing_edges: GraphEdge[];
}

export interface HandoverReportContent {
  overview: {
    project_id: string;
    project_name: string;
    description?: string;
    generated_at: string;
    project_status: string;
    progress_percentage: number;
    outgoing_owner: string;
    incoming_owner: string;
    incoming_owner_role?: string | null;
    health_score: string;
    executive_summary: string;
  };
  status: {
    total_tasks: number;
    completed_tasks: number;
    pending_tasks: number;
    blocked_tasks: number;
    decisions_count: number;
    risks_count: number;
    documents_count: number;
    approved_claims_count?: number;
    rejected_claims_count?: number;
    pending_claims_count?: number;
  };
  decisions: Array<{
    id: string;
    title: string;
    rationale?: string;
    decided_by?: string;
    decision_date?: string;
    source_reference?: string;
    evidence_snippet?: string;
    verified: boolean;
  }>;
  completed_work: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assignee?: string;
    due_date?: string;
    description?: string;
  }>;
  pending_and_blocked_tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assignee?: string;
    due_date?: string;
    description?: string;
    blocker_reason?: string;
  }>;
  ownership_matrix: Array<{
    name: string;
    role: string;
    assigned_tasks_count: number;
    decisions_signed_count: number;
    handover_status: string;
  }>;
  risks_and_blockers: Array<{
    id: string;
    title: string;
    impact_scope?: string;
    severity: string;
    evidence_snippet?: string;
    source_reference?: string;
    verified: boolean;
  }>;
  dependencies: Array<{
    from_entity: string;
    to_entity: string;
    relationship_type: string;
    is_inferred: boolean;
  }>;
  open_questions: Array<{
    id: string;
    title: string;
    impact_scope?: string;
    source_reference?: string;
    evidence_snippet?: string;
    verified: boolean;
  }>;
  recommended_next_actions: Array<{
    action: string;
    priority: string;
    target_owner: string;
    suggested_timeframe: string;
    is_inferred: boolean;
  }>;
  source_documents: Array<{
    id: string;
    filename: string;
    file_type: string;
    file_size: number;
    author?: string;
    page_count: number;
    extracted_claims_count: number;
  }>;
}

export interface HandoverReport {
  id: string;
  project_id: string;
  title: string;
  summary?: string;
  status: string;
  generated_by?: string;
  content: HandoverReportContent;
  created_at: string;
  updated_at: string;
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

export interface UserProfile {
  displayName: string;
  role?: string;
}

