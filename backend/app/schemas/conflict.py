from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ConflictResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    conflict_type: str
    severity: str
    title: str
    description: str
    source_entity_type: Optional[str] = None
    source_entity_id: Optional[UUID] = None
    target_entity_type: Optional[str] = None
    target_entity_id: Optional[UUID] = None
    evidence_snippet: Optional[str] = None
    status: str
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ConflictResolveRequest(BaseModel):
    status: str = Field(default="resolved", pattern="^(open|resolved|dismissed)$")
    resolution_notes: Optional[str] = Field(default=None, max_length=5000)
    resolved_by: Optional[str] = Field(default=None, max_length=120)


class ConflictDetectResponse(BaseModel):
    project_id: UUID
    detected_count: int
    open_count: int
    resolved_count: int
    conflicts: list[ConflictResponse]

