from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.task import TaskPriority, TaskStatus


class TaskBase(BaseModel):
    title: str = Field(..., max_length=200, description="Task title")
    description: Optional[str] = Field(default=None, description="Task description")
    status: TaskStatus = Field(default=TaskStatus.TODO, description="Task status")
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, description="Task priority")
    assignee: Optional[str] = Field(default=None, max_length=120, description="Task assignee")
    due_date: Optional[datetime] = Field(default=None, description="Task due date")


class TaskCreate(BaseModel):
    project_id: Optional[UUID] = Field(default=None, description="Project ID (if not provided in route path)")
    title: str = Field(..., max_length=200, description="Task title")
    description: Optional[str] = Field(default=None, description="Task description")
    status: TaskStatus = Field(default=TaskStatus.TODO, description="Task status")
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, description="Task priority")
    assignee: Optional[str] = Field(default=None, max_length=120, description="Task assignee")
    due_date: Optional[datetime] = Field(default=None, description="Task due date")
    actor: Optional[str] = Field(default=None, max_length=120, description="Actor performing creation (for activity record)")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if v is None:
            raise ValueError("Task title is required")
        v_stripped = v.strip()
        if not v_stripped:
            raise ValueError("Task title cannot be empty or whitespace only")
        if len(v_stripped) > 200:
            raise ValueError("Task title cannot exceed 200 characters")
        return v_stripped


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200, description="Task title")
    description: Optional[str] = Field(default=None, description="Task description")
    status: Optional[TaskStatus] = Field(default=None, description="Task status")
    priority: Optional[TaskPriority] = Field(default=None, description="Task priority")
    assignee: Optional[str] = Field(default=None, max_length=120, description="Task assignee")
    due_date: Optional[datetime] = Field(default=None, description="Task due date")
    actor: Optional[str] = Field(default=None, max_length=120, description="Actor performing update (for activity record)")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_stripped = v.strip()
            if not v_stripped:
                raise ValueError("Task title cannot be empty or whitespace only")
            if len(v_stripped) > 200:
                raise ValueError("Task title cannot exceed 200 characters")
            return v_stripped
        return v


class TaskResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

