from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.models.extracted_knowledge import KnowledgeCategory, VerificationStatus


class ExtractedClaimItem(BaseModel):
    category: KnowledgeCategory
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = Field(default=None, max_length=10000)
    evidence_snippet: Optional[str] = Field(default=None, max_length=10000)
    source_reference: Optional[str] = Field(default=None, max_length=255)
    page_number: Optional[int] = None
    confidence: float = Field(default=0.85, ge=0.0, le=1.0)
    owner: Optional[str] = Field(default=None, max_length=120)
    impact_scope: Optional[str] = Field(default=None, max_length=120)


class AIStructuredExtraction(BaseModel):
    claims: List[ExtractedClaimItem] = Field(default_factory=list)
    document_summary: Optional[str] = Field(default=None, max_length=10000)


class ExtractedKnowledgeCreate(BaseModel):
    document_id: UUID
    project_id: Optional[UUID] = None
    category: KnowledgeCategory
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = Field(default=None, max_length=10000)
    evidence_snippet: Optional[str] = Field(default=None, max_length=10000)
    source_reference: Optional[str] = Field(default=None, max_length=255)
    page_number: Optional[int] = None
    confidence: float = Field(default=0.85, ge=0.0, le=1.0)
    owner: Optional[str] = Field(default=None, max_length=120)
    impact_scope: Optional[str] = Field(default=None, max_length=120)


class ExtractedKnowledgeUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    content: Optional[str] = Field(default=None, max_length=10000)
    category: Optional[KnowledgeCategory] = None
    owner: Optional[str] = Field(default=None, max_length=120)
    impact_scope: Optional[str] = Field(default=None, max_length=120)
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

