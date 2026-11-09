from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class ActivityResponse(BaseModel):
    id: UUID
    project_id: UUID
    event_type: str
    description: str
    actor: Optional[str] = "system"
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

