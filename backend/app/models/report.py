import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


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
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    project = relationship("Project", back_populates="reports")

    def __repr__(self) -> str:
        return f"<HandoverReport(id={self.id}, title={self.title}, project_id={self.project_id})>"

