import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Uuid, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ReportAcknowledgementStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING = "pending"
    ACKNOWLEDGED = "acknowledged"
    CLARIFICATION_REQUESTED = "clarification_requested"


class HandoverReport(Base):
    __tablename__ = "handover_reports"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    project_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)
    status = Column(String(50), default="generated", nullable=False)
    content_json = Column(Text, nullable=False)  # JSON-encoded 11-section report structure
    generated_by = Column(String(120), nullable=True, default="System")

    # Round 3: Handover Lifecycle & Acknowledgement Tracking
    version = Column(Integer, default=1, nullable=False)
    outgoing_owner = Column(String(120), nullable=True)
    incoming_owner = Column(String(120), nullable=True)
    incoming_owner_role = Column(String(120), nullable=True)
    acknowledgement_status = Column(
        SAEnum(
            ReportAcknowledgementStatus,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=ReportAcknowledgementStatus.DRAFT,
        nullable=False,
        index=True,
    )
    clarification_notes = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    project = relationship("Project", back_populates="reports")

    def __repr__(self) -> str:
        return f"<HandoverReport(id={self.id}, title={self.title}, status={self.acknowledgement_status})>"
