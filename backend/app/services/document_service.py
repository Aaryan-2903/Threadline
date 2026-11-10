import io
import logging
from typing import List, Optional, Tuple, Union
from uuid import UUID
import zipfile
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, defer
from app.models.document import Document, DocumentStatus
from app.models.extracted_knowledge import ExtractedKnowledge, VerificationStatus
from app.models.project import Project
from app.services.activity_service import record_activity
from app.services.ai_service import AIKnowledgeService
from app.services.extraction_service import (
    DocumentExtractionService,
    _sanitize_error_message,
    sanitize_exception,
)

logger = logging.getLogger(__name__)


def get_safe_document_error(error: Exception) -> Tuple[int, str]:
    """
    Categorize an error into a safe HTTP status code and clean user-facing error message.
    Ensures internal exception details, database connections, stack traces,
    or filesystem paths are NEVER exposed to API responses or stored error messages.
    """
    if isinstance(error, HTTPException):
        detail = str(error.detail) if error.detail else ""
        lower = detail.lower()

        # Categorize into safe standard messages
        if "empty" in lower:
            return error.status_code, "Uploaded file is empty."
        if "maximum allowed size" in lower or "too large" in lower:
            return error.status_code, detail
        if "unsupported" in lower:
            return error.status_code, "Unsupported file format. Only PDF and DOCX files are supported."
        if "pdf" in lower and ("signature" in lower or "missing" in lower):
            return error.status_code, "Invalid PDF document. File is missing required '%PDF-' signature or is corrupt."
        if detail.startswith("Invalid DOCX document."):
            return error.status_code, detail
        if "docx" in lower and ("zip" in lower or "header" in lower):
            return error.status_code, "Invalid DOCX document. File does not contain a valid ZIP header signature."
        if "docx" in lower and ("archive" in lower or "entries" in lower or "entry" in lower):
            return error.status_code, "Invalid DOCX document. Archive is missing required document entries."
        if "no pages" in lower:
            return error.status_code, "The PDF document contains no pages."
        if "corrupt" in lower or "encrypted" in lower or "parse" in lower:
            if "pdf" in lower:
                return error.status_code, "Failed to parse PDF document. The file may be corrupt, damaged, or encrypted."
            if "docx" in lower:
                return error.status_code, "Failed to parse DOCX document. The file may be corrupt, damaged, or encrypted."
            return error.status_code, "Failed to parse document. The file may be corrupt, damaged, or encrypted."
        if "not found" in lower:
            return error.status_code, detail
        if "filename" in lower:
            return error.status_code, detail

        # Safe 4xx errors without path/secret indicators
        if 400 <= error.status_code < 500:
            if not any(token in detail for token in ("\\", "/", "://", "key=", "SELECT", "INSERT", "Traceback", "Exception")):
                return error.status_code, detail

        return error.status_code, "Failed to process document due to an invalid request."

    err_type = type(error).__name__.lower()
    err_str = str(error).lower()

    if "badzipfile" in err_type or isinstance(error, (zipfile.BadZipFile, io.UnsupportedOperation)):
        return status.HTTP_400_BAD_REQUEST, "Failed to parse DOCX document. The archive is corrupt or invalid."

    if any(db_token in err_type for db_token in ("sqlalchemy", "operationalerror", "integrityerror", "databaseerror", "programmingerror")):
        return status.HTTP_500_INTERNAL_SERVER_ERROR, "Database error occurred while processing document."

    if isinstance(error, (OSError, IOError, PermissionError, FileNotFoundError)):
        return status.HTTP_500_INTERNAL_SERVER_ERROR, "Storage error occurred while processing document."

    if "ai" in err_type or "llm" in err_str or "gemini" in err_str or "openai" in err_str or "quota" in err_str or "token" in err_str:
        return status.HTTP_500_INTERNAL_SERVER_ERROR, "AI knowledge extraction failed."

    if "extract" in err_str or "parse" in err_str or "fitz" in err_str or "pymupdf" in err_str or "docx" in err_str:
        return status.HTTP_400_BAD_REQUEST, "Failed to parse document. The file may be corrupt, damaged, or encrypted."

    return status.HTTP_500_INTERNAL_SERVER_ERROR, "An error occurred while processing the document."


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
            # Rollback partial transaction (e.g. any partially added claims)
            try:
                db.rollback()
            except Exception:
                pass

            sanitized_e = sanitize_exception(e)
            sanitized_err = _sanitize_error_message(sanitized_e)
            logger.error(
                "Document processing failed [operation=upload_and_process, doc_id=%s, filename=%s, error_type=%s]: %s",
                doc.id,
                filename,
                type(e).__name__,
                sanitized_err,
                exc_info=True,
            )

            status_code, safe_error_message = get_safe_document_error(e)

            # Ensure document record is updated with safe error message and consistent ERROR status
            try:
                doc.status = DocumentStatus.ERROR
                doc.error_message = safe_error_message
                db.add(doc)
                db.commit()
                db.refresh(doc)
            except Exception as db_err:
                logger.error(
                    "Failed to record document error state in DB [doc_id=%s]: %s",
                    doc.id,
                    _sanitize_error_message(db_err),
                    exc_info=True,
                )
                try:
                    db.rollback()
                except Exception:
                    pass

            raise HTTPException(status_code=status_code, detail=safe_error_message)

    @classmethod
    def list_documents(
        cls, db: Session, project_id: Optional[Union[UUID, str]] = None
    ) -> List[Document]:
        query = db.query(Document).options(
            defer(Document.raw_content),
            defer(Document.extracted_text),
        )
        if project_id:
            pid = UUID(str(project_id)) if not isinstance(project_id, UUID) else project_id
            query = query.filter(Document.project_id == pid)
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

        try:
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
        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            sanitized_e = sanitize_exception(e)
            logger.error(
                "Failed to delete document [doc_id=%s, error_type=%s]: %s",
                doc_id,
                type(e).__name__,
                _sanitize_error_message(sanitized_e),
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error occurred while deleting document.",
            )

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
            try:
                db.rollback()
            except Exception:
                pass

            sanitized_e = sanitize_exception(e)
            sanitized_err = _sanitize_error_message(sanitized_e)
            logger.error(
                "Document reprocessing failed [operation=reprocess_document, doc_id=%s, filename=%s, error_type=%s]: %s",
                doc.id,
                doc.filename,
                type(e).__name__,
                sanitized_err,
                exc_info=True,
            )

            status_code, safe_error_message = get_safe_document_error(e)

            try:
                doc.status = DocumentStatus.ERROR
                doc.error_message = safe_error_message
                db.add(doc)
                db.commit()
                db.refresh(doc)
            except Exception as db_err:
                logger.error(
                    "Failed to record reprocess error state in DB [doc_id=%s]: %s",
                    doc.id,
                    _sanitize_error_message(db_err),
                    exc_info=True,
                )
                try:
                    db.rollback()
                except Exception:
                    pass

            raise HTTPException(status_code=status_code, detail=safe_error_message)

