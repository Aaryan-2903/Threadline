from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.models.extracted_knowledge import KnowledgeCategory, VerificationStatus


class ExtractedClaimItem(BaseModel):
    category: KnowledgeCategory
    title: str = Field(..., max_length=255)
    content: Optional[str] = None
    evidence_snippet: Optional[str] = None
    source_reference: Optional[str] = None
    page_number: Optional[int] = None
    confidence: float = Field(default=0.85, ge=0.0, le=1.0)
    owner: Optional[str] = None
    impact_scope: Optional[str] = None


class AIStructuredExtraction(BaseModel):
    claims: List[ExtractedClaimItem] = Field(default_factory=list)
    document_summary: Optional[str] = None


class ExtractedKnowledgeCreate(BaseModel):
    document_id: UUID
    project_id: Optional[UUID] = None
    category: KnowledgeCategory
    title: str
    content: Optional[str] = None
    evidence_snippet: Optional[str] = None
    source_reference: Optional[str] = None
    page_number: Optional[int] = None
    confidence: float = 0.85
    owner: Optional[str] = None
    impact_scope: Optional[str] = None


class ExtractedKnowledgeUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[KnowledgeCategory] = None
    owner: Optional[str] = None
    impact_scope: Optional[str] = None
    status: Optional[VerificationStatus] = None


class ExtractedKnowledgeResponse(BaseModel):
    id: UUID
    document_id: UUID
    project_id: Optional[UUID] = None
    category: KnowledgeCategory
    title: str
    content: Optional[str] = None
    evidence_snippet: Optional[str] = None
    source_reference: Optional[str] = None
    page_number: Optional[int] = None
    confidence: float
    status: VerificationStatus
    owner: Optional[str] = None
    impact_scope: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

