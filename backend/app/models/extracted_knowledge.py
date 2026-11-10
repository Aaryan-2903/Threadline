import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, Uuid, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class KnowledgeCategory(str, enum.Enum):
    DECISION = "decision"
    TASK = "task"
    RISK = "risk"
    QUESTION = "question"
    CONFLICT = "conflict"


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ExtractedKnowledge(Base):
    __tablename__ = "extracted_knowledge"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    document_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    category = Column(
        SAEnum(
            KnowledgeCategory,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    evidence_snippet = Column(Text, nullable=True)
    source_reference = Column(String(255), nullable=True)  # e.g., "Page 3" or "Section 2.1"
    page_number = Column(Integer, nullable=True)
    confidence = Column(Float, default=0.85, nullable=False)
    status = Column(
        SAEnum(
            VerificationStatus,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=VerificationStatus.PENDING,
        nullable=False,
        index=True,
    )
    owner = Column(String(120), nullable=True)
    impact_scope = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    document = relationship("Document", back_populates="extracted_knowledge")
    project = relationship("Project", back_populates="extracted_knowledge")

    def __repr__(self) -> str:
        return f"<ExtractedKnowledge(id={self.id}, category={self.category}, title={self.title}, status={self.status})>"

