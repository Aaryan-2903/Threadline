import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, LargeBinary, String, Text, Uuid, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DocumentStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    EXTRACTED = "extracted"
    ERROR = "error"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    project_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # "pdf" or "docx"
    file_size = Column(Integer, nullable=False)  # bytes
    author = Column(String(120), nullable=True)
    status = Column(
        SAEnum(
            DocumentStatus,
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=DocumentStatus.UPLOADED,
        nullable=False,
        index=True,
    )
    error_message = Column(Text, nullable=True)
    extracted_claims_count = Column(Integer, default=0, nullable=False)
    page_count = Column(Integer, default=0, nullable=False)
    raw_content = Column(LargeBinary, nullable=True)  # Persistent storage in database
    extracted_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    project = relationship("Project", back_populates="documents")
    extracted_knowledge = relationship(
        "ExtractedKnowledge",
        back_populates="document",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, filename={self.filename}, status={self.status})>"

