from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.project import ProjectStatus


class ProjectBase(BaseModel):
    name: str = Field(..., max_length=120, description="Project name")
    description: Optional[str] = Field(default=None, max_length=10000, description="Project description")
    status: ProjectStatus = Field(default=ProjectStatus.ACTIVE, description="Project status")


class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=120, description="Project name")
    description: Optional[str] = Field(default=None, max_length=10000, description="Project description")
    status: ProjectStatus = Field(default=ProjectStatus.ACTIVE, description="Project status")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if v is None:
            raise ValueError("Project name is required")
        v_stripped = v.strip()
        if not v_stripped:
            raise ValueError("Project name cannot be empty or whitespace only")
        if len(v_stripped) > 120:
            raise ValueError("Project name cannot exceed 120 characters")
        return v_stripped


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120, description="Project name")
    description: Optional[str] = Field(default=None, max_length=10000, description="Project description")
    status: Optional[ProjectStatus] = Field(default=None, description="Project status")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_stripped = v.strip()
            if not v_stripped:
                raise ValueError("Project name cannot be empty or whitespace only")
            if len(v_stripped) > 120:
                raise ValueError("Project name cannot exceed 120 characters")
            return v_stripped
        return v


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

