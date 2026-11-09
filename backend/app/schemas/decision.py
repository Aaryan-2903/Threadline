from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class DecisionBase(BaseModel):
    title: str = Field(..., max_length=200, description="Decision title")
    description: Optional[str] = Field(default=None, description="Decision description")
    rationale: Optional[str] = Field(default=None, description="Rationale behind the decision")
    decided_by: Optional[str] = Field(default=None, max_length=120, description="Person or team who made the decision")
    decision_date: Optional[datetime] = Field(default=None, description="Date decision was taken")


class DecisionCreate(BaseModel):
    project_id: Optional[UUID] = Field(default=None, description="Project ID (if not provided in route path)")
    title: str = Field(..., max_length=200, description="Decision title")
    description: Optional[str] = Field(default=None, description="Decision description")
    rationale: Optional[str] = Field(default=None, description="Rationale behind the decision")
    decided_by: Optional[str] = Field(default=None, max_length=120, description="Person or team who made the decision")
    decision_date: Optional[datetime] = Field(default=None, description="Date decision was taken (defaults to current time)")
    actor: Optional[str] = Field(default=None, max_length=120, description="Actor recording the decision")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if v is None:
            raise ValueError("Decision title is required")
        v_stripped = v.strip()
        if not v_stripped:
            raise ValueError("Decision title cannot be empty or whitespace only")
        if len(v_stripped) > 200:
            raise ValueError("Decision title cannot exceed 200 characters")
        return v_stripped


class DecisionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200, description="Decision title")
    description: Optional[str] = Field(default=None, description="Decision description")
    rationale: Optional[str] = Field(default=None, description="Rationale behind the decision")
    decided_by: Optional[str] = Field(default=None, max_length=120, description="Person or team who made the decision")
    decision_date: Optional[datetime] = Field(default=None, description="Date decision was taken")
    actor: Optional[str] = Field(default=None, max_length=120, description="Actor performing update")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_stripped = v.strip()
            if not v_stripped:
                raise ValueError("Decision title cannot be empty or whitespace only")
            if len(v_stripped) > 200:
                raise ValueError("Decision title cannot exceed 200 characters")
            return v_stripped
        return v


class DecisionResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: Optional[str] = None
    rationale: Optional[str] = None
    decided_by: Optional[str] = None
    decision_date: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

