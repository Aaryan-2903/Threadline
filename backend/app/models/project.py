import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, Enum as SAEnum, Uuid
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(
        SAEnum(
            ProjectStatus,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=ProjectStatus.ACTIVE,
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name={self.name}, status={self.status})>"

