import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    project_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=False)
    actor = Column(String(120), nullable=True, default="system")
    entity_type = Column(String(50), nullable=True, index=True)
    entity_id = Column(Uuid(as_uuid=True), nullable=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    project = relationship("Project", back_populates="activities")

    def __repr__(self) -> str:
        return f"<Activity(id={self.id}, event_type={self.event_type}, project_id={self.project_id})>"

