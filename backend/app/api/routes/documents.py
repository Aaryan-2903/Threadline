import logging
from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import check_write_permission, get_current_user_optional
from app.database import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.services.audit_service import log_audit_event
from app.services.document_service import DocumentService
from app.services.extraction_service import _sanitize_error_message
from app.services.redaction_service import redaction_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


def _format_doc_response(doc: Document, redact: bool = False) -> DocumentResponse:
    text = doc.extracted_text
    sensitive_findings = redaction_service.scan_sensitive_data(text or "")
    if redact and text:
        text, _ = redaction_service.redact_text(text)

    return DocumentResponse(
        id=doc.id,
        project_id=doc.project_id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        author=doc.author,
        status=doc.status,
        error_message=doc.error_message,
        extracted_claims_count=doc.extracted_claims_count,
        page_count=doc.page_count,
        extracted_text=text,
        sensitive_findings_count=len(sensitive_findings),
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and process a document",
)
async def upload_document(
    file: UploadFile = File(...),
    project_id: Optional[UUID] = Form(None),
    author: Optional[str] = Form(None, max_length=120),
    current_user: Optional[User] = Depends(check_write_permission),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """Upload PDF or DOCX file, extract text and citations, run AI knowledge extraction."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided in upload.",
        )
    if len(file.filename) > 255:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Filename cannot exceed 255 characters.",
        )

    try:
        content = await file.read()
    except Exception as e:
        logger.error(
            "Failed to read uploaded file payload [filename=%s, error_type=%s]: %s",
            file.filename,
            type(e).__name__,
            _sanitize_error_message(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read uploaded file data.",
        )

    doc = DocumentService.upload_and_process(
        db=db,
        filename=file.filename,
        content=content,
        project_id=project_id,
        author=current_user.username if current_user else author,
    )

    # Check for sensitive data scan in extracted content
    if doc.extracted_text:
        findings = redaction_service.scan_sensitive_data(doc.extracted_text)
        if findings:
            log_audit_event(
                db=db,
                action="sensitive_data_detected",
                username=current_user.username if current_user else (author or "System"),
                project_id=project_id,
                resource_type="document",
                resource_id=doc.id,
                details=f"Uploaded document '{doc.filename}' contains {len(findings)} sensitive items ({', '.join(set(f['type'] for f in findings))}).",
            )

    return _format_doc_response(doc)


@router.get(
    "/",
    response_model=List[DocumentResponse],
    status_code=status.HTTP_200_OK,
    summary="List documents",
)
def list_documents(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    redact: bool = Query(False, description="Redact sensitive emails, phone numbers, and keys"),
    db: Session = Depends(get_db),
) -> List[DocumentResponse]:
    """Retrieve all uploaded documents, optionally filtered by project ID."""
    docs = DocumentService.list_documents(db=db, project_id=project_id)
    return [_format_doc_response(d, redact=redact) for d in docs]


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get document by ID",
)
def get_document(
    document_id: UUID,
    redact: bool = Query(False, description="Redact sensitive data"),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """Retrieve details and processing status of a specific document."""
    doc = DocumentService.get_document(db=db, doc_id=document_id)
    return _format_doc_response(doc, redact=redact)


@router.get(
    "/{document_id}/sensitive-scan",
    status_code=status.HTTP_200_OK,
    summary="Scan document for sensitive data",
)
def scan_document_sensitive_data(
    document_id: UUID,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Scan document text for sensitive information (emails, phone numbers, API keys)."""
    doc = DocumentService.get_document(db=db, doc_id=document_id)
    findings = redaction_service.scan_sensitive_data(doc.extracted_text or "")
    return {
        "document_id": str(document_id),
        "filename": doc.filename,
        "total_sensitive_items": len(findings),
        "findings": findings,
    }


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a document",
)
def delete_document(
    document_id: UUID,
    current_user: Optional[User] = Depends(check_write_permission),
    db: Session = Depends(get_db),
) -> dict:
    """Delete a document and cascade delete all its extracted knowledge claims."""
    DocumentService.delete_document(db=db, doc_id=document_id)
    return {"message": "Document deleted successfully", "id": str(document_id)}


@router.post(
    "/{document_id}/process",
    response_model=DocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Reprocess a document",
)
def reprocess_document(
    document_id: UUID,
    current_user: Optional[User] = Depends(check_write_permission),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """Re-run text extraction and AI knowledge discovery on an existing document."""
    doc = DocumentService.reprocess_document(db=db, doc_id=document_id)
    return _format_doc_response(doc)
