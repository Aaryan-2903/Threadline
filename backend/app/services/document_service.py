import logging
from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentStatus
from app.models.extracted_knowledge import ExtractedKnowledge, VerificationStatus
from app.models.project import Project
from app.services.activity_service import record_activity
from app.services.ai_service import AIKnowledgeService
from app.services.extraction_service import DocumentExtractionService

logger = logging.getLogger(__name__)


class DocumentService:
    @classmethod
    def upload_and_process(
        cls,
        db: Session,
        filename: str,
        content: bytes,
        project_id: Optional[UUID] = None,
        author: Optional[str] = None,
    ) -> Document:
        # Validate project exists if specified
        if project_id:
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Project with ID '{project_id}' not found.",
                )

        file_type = DocumentExtractionService.validate_file(filename, content)

        # Create Document record
        doc = Document(
            project_id=project_id,
            filename=filename,
            file_type=file_type,
            file_size=len(content),
            author=author or "System",
            status=DocumentStatus.PROCESSING,
            raw_content=content,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        try:
            # 1. Extract text and chunks
            extraction = DocumentExtractionService.extract_text(filename, content)
            doc.page_count = extraction.page_count
            doc.extracted_text = extraction.full_text

            # 2. Extract AI knowledge claims
            ai_result = AIKnowledgeService.extract_knowledge(
                chunks=extraction.chunks, full_text=extraction.full_text
            )

            # 3. Save extracted knowledge claims
            saved_count = 0
            for item in ai_result.claims:
                claim = ExtractedKnowledge(
                    document_id=doc.id,
                    project_id=project_id,
                    category=item.category,
                    title=item.title,
                    content=item.content,
                    evidence_snippet=item.evidence_snippet,
                    source_reference=item.source_reference,
                    page_number=item.page_number,
                    confidence=item.confidence,
                    status=VerificationStatus.PENDING,
                    owner=item.owner,
                    impact_scope=item.impact_scope,
                )
                db.add(claim)
                saved_count += 1

            doc.extracted_claims_count = saved_count
            doc.status = DocumentStatus.EXTRACTED
            doc.error_message = None

            if project_id:
                record_activity(
                    db=db,
                    project_id=project_id,
                    event_type="document_uploaded",
                    description=f"Uploaded '{filename}' and extracted {saved_count} knowledge items",
                    actor=author or "System",
                    entity_type="document",
                    entity_id=doc.id,
                )

            db.commit()
            db.refresh(doc)
            return doc

        except Exception as e:
            logger.error("Document processing error for %s: %s", filename, e, exc_info=True)
            doc.status = DocumentStatus.ERROR
            doc.error_message = str(e)
            db.commit()
            db.refresh(doc)
            raise

    @classmethod
    def list_documents(
        cls, db: Session, project_id: Optional[UUID] = None
    ) -> List[Document]:
        query = db.query(Document)
        if project_id:
            query = query.filter(Document.project_id == project_id)
        return query.order_by(Document.created_at.desc()).all()

    @classmethod
    def get_document(cls, db: Session, doc_id: UUID) -> Document:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID '{doc_id}' not found.",
            )
        return doc

    @classmethod
    def delete_document(cls, db: Session, doc_id: UUID) -> bool:
        doc = cls.get_document(db, doc_id)
        project_id = doc.project_id
        filename = doc.filename

        db.delete(doc)

        if project_id:
            record_activity(
                db=db,
                project_id=project_id,
                event_type="document_deleted",
                description=f"Deleted document '{filename}'",
                actor="System",
                entity_type="document",
                entity_id=doc_id,
            )

        db.commit()
        return True

    @classmethod
    def reprocess_document(cls, db: Session, doc_id: UUID) -> Document:
        doc = cls.get_document(db, doc_id)
        if not doc.raw_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document raw content is not available for reprocessing.",
            )

        # Clear existing pending claims for this document
        db.query(ExtractedKnowledge).filter(
            ExtractedKnowledge.document_id == doc.id,
            ExtractedKnowledge.status == VerificationStatus.PENDING,
        ).delete()

        doc.status = DocumentStatus.PROCESSING
        db.commit()

        try:
            extraction = DocumentExtractionService.extract_text(doc.filename, doc.raw_content)
            doc.page_count = extraction.page_count
            doc.extracted_text = extraction.full_text

            ai_result = AIKnowledgeService.extract_knowledge(
                chunks=extraction.chunks, full_text=extraction.full_text
            )

            saved_count = 0
            for item in ai_result.claims:
                claim = ExtractedKnowledge(
                    document_id=doc.id,
                    project_id=doc.project_id,
                    category=item.category,
                    title=item.title,
                    content=item.content,
                    evidence_snippet=item.evidence_snippet,
                    source_reference=item.source_reference,
                    page_number=item.page_number,
                    confidence=item.confidence,
                    status=VerificationStatus.PENDING,
                    owner=item.owner,
                    impact_scope=item.impact_scope,
                )
                db.add(claim)
                saved_count += 1

            doc.extracted_claims_count = saved_count
            doc.status = DocumentStatus.EXTRACTED
            doc.error_message = None
            db.commit()
            db.refresh(doc)
            return doc
        except Exception as e:
            doc.status = DocumentStatus.ERROR
            doc.error_message = str(e)
            db.commit()
            db.refresh(doc)
            raise

