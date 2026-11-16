import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Uuid, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ConflictType(str, enum.Enum):
    SUPERSEDED_DECISION = "superseded_decision"
    CONFLICTING_DEADLINE = "conflicting_deadline"
    CONFLICTING_ASSIGNEE = "conflicting_assignee"
    CONTRADICTORY_CLAIM = "contradictory_claim"


class ConflictStatus(str, enum.Enum):
    OPEN = "open"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ConflictSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Conflict(Base):
    __tablename__ = "conflicts"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    project_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    conflict_type = Column(
        SAEnum(
            ConflictType,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        index=True,
    )
    severity = Column(
        SAEnum(
            ConflictSeverity,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=ConflictSeverity.MEDIUM,
        nullable=False,
    )
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    source_entity_type = Column(String(50), nullable=True)
    source_entity_id = Column(Uuid(as_uuid=True), nullable=True)
    target_entity_type = Column(String(50), nullable=True)
    target_entity_id = Column(Uuid(as_uuid=True), nullable=True)
    evidence_snippet = Column(Text, nullable=True)
    status = Column(
        SAEnum(
            ConflictStatus,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=ConflictStatus.OPEN,
        nullable=False,
        index=True,
    )
    resolved_by = Column(String(120), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    project = relationship("Project", back_populates="conflicts")

    def __repr__(self) -> str:
        return f"<Conflict(id={self.id}, type={self.conflict_type}, status={self.status})>"

