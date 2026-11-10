import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.document import DocumentResponse
from app.services.document_service import DocumentService
from app.services.extraction_service import _sanitize_error_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


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
    return DocumentService.upload_and_process(
        db=db,
        filename=file.filename,
        content=content,
        project_id=project_id,
        author=author,
    )


@router.get(
    "/",
    response_model=List[DocumentResponse],
    status_code=status.HTTP_200_OK,
    summary="List documents",
)
def list_documents(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    db: Session = Depends(get_db),
) -> List[DocumentResponse]:
    """Retrieve all uploaded documents, optionally filtered by project ID."""
    return DocumentService.list_documents(db=db, project_id=project_id)


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get document by ID",
)
def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """Retrieve details and processing status of a specific document."""
    return DocumentService.get_document(db=db, doc_id=document_id)


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a document",
)
def delete_document(
    document_id: UUID,
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
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """Re-run text extraction and AI knowledge discovery on an existing document."""
    return DocumentService.reprocess_document(db=db, doc_id=document_id)

