from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.models.document import DocumentStatus


class DocumentBase(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    file_type: str = Field(..., min_length=1, max_length=50)
    file_size: int = Field(..., ge=0)
    author: Optional[str] = Field(default=None, max_length=120)


class DocumentCreate(BaseModel):
    project_id: Optional[UUID] = None
    filename: str = Field(..., min_length=1, max_length=255)
    file_type: str = Field(..., min_length=1, max_length=50)
    file_size: int = Field(..., ge=0)
    author: Optional[str] = Field(default=None, max_length=120)


class DocumentResponse(BaseModel):
    id: UUID
    project_id: Optional[UUID] = None
    filename: str
    file_type: str
    file_size: int
    author: Optional[str] = None
    status: DocumentStatus
    error_message: Optional[str] = None
    extracted_claims_count: int = 0
    page_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

