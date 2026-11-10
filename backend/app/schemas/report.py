from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ReportOverview(BaseModel):
    project_id: str
    project_name: str
    description: Optional[str] = None
    generated_at: str
    project_status: str
    progress_percentage: int
    outgoing_owner: str
    incoming_owner: str
    incoming_owner_role: Optional[str] = None
    health_score: str
    executive_summary: str


class ReportStatusSection(BaseModel):
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    blocked_tasks: int
    decisions_count: int
    risks_count: int
    documents_count: int
    approved_claims_count: int = 0
    rejected_claims_count: int = 0
    pending_claims_count: int = 0


class ReportDecisionItem(BaseModel):
    id: str
    title: str
    rationale: Optional[str] = None
    decided_by: Optional[str] = None
    decision_date: Optional[str] = None
    source_reference: Optional[str] = None
    evidence_snippet: Optional[str] = None
    verified: bool = True


class ReportTaskItem(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    description: Optional[str] = None
    blocker_reason: Optional[str] = None


class ReportOwnerItem(BaseModel):
    name: str
    role: str
    assigned_tasks_count: int
    decisions_signed_count: int
    handover_status: str


class ReportRiskItem(BaseModel):
    id: str
    title: str
    impact_scope: Optional[str] = None
    severity: str
    evidence_snippet: Optional[str] = None
    source_reference: Optional[str] = None
    verified: bool = True


class ReportDependencyItem(BaseModel):
    from_entity: str
    to_entity: str
    relationship_type: str
    is_inferred: bool = False


class ReportQuestionItem(BaseModel):
    id: str
    title: str
    impact_scope: Optional[str] = None
    source_reference: Optional[str] = None
    evidence_snippet: Optional[str] = None
    verified: bool = True


class ReportActionItem(BaseModel):
    action: str
    priority: str
    target_owner: str
    suggested_timeframe: str
    is_inferred: bool = True


class ReportDocumentItem(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    author: Optional[str] = None
    page_count: int
    extracted_claims_count: int


class HandoverReportContent(BaseModel):
    overview: ReportOverview
    status: ReportStatusSection
    decisions: List[ReportDecisionItem] = Field(default_factory=list)
    completed_work: List[ReportTaskItem] = Field(default_factory=list)
    pending_and_blocked_tasks: List[ReportTaskItem] = Field(default_factory=list)
    ownership_matrix: List[ReportOwnerItem] = Field(default_factory=list)
    risks_and_blockers: List[ReportRiskItem] = Field(default_factory=list)
    dependencies: List[ReportDependencyItem] = Field(default_factory=list)
    open_questions: List[ReportQuestionItem] = Field(default_factory=list)
    recommended_next_actions: List[ReportActionItem] = Field(default_factory=list)
    source_documents: List[ReportDocumentItem] = Field(default_factory=list)


class HandoverReportCreate(BaseModel):
    project_id: UUID
    title: Optional[str] = Field(default=None, max_length=200)
    actor: Optional[str] = Field(default="System", max_length=120)


class HandoverReportUpdateSuccessor(BaseModel):
    incoming_owner: Optional[str] = Field(default=None, max_length=120)
    incoming_owner_role: Optional[str] = Field(default=None, max_length=120)


class HandoverReportResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    summary: Optional[str] = None
    status: str
    generated_by: Optional[str] = None
    content: HandoverReportContent
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

