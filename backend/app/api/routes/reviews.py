from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.extracted_knowledge import KnowledgeCategory, VerificationStatus
from app.schemas.extracted_knowledge import ExtractedKnowledgeResponse, ExtractedKnowledgeUpdate
from app.services.review_service import ReviewService

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get(
    "/",
    response_model=List[ExtractedKnowledgeResponse],
    status_code=status.HTTP_200_OK,
    summary="List extracted knowledge claims for review",
)
def list_reviews(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    document_id: Optional[UUID] = Query(None, description="Filter by document ID"),
    verification_status: Optional[VerificationStatus] = Query(
        None, alias="status", description="Filter by review status (pending/approved/rejected)"
    ),
    category: Optional[KnowledgeCategory] = Query(
        None, description="Filter by claim category (decision/task/risk/question/conflict)"
    ),
    db: Session = Depends(get_db),
) -> List[ExtractedKnowledgeResponse]:
    """List extracted claims for human review."""
    return ReviewService.list_reviews(
        db=db,
        project_id=project_id,
        document_id=document_id,
        verification_status=verification_status.value if verification_status else None,
        category=category.value if category else None,
    )


@router.get(
    "/{review_id}",
    response_model=ExtractedKnowledgeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get extracted claim detail",
)
def get_review(
    review_id: UUID,
    db: Session = Depends(get_db),
) -> ExtractedKnowledgeResponse:
    """Get single extracted claim detail."""
    return ReviewService.get_review(db=db, review_id=review_id)


@router.patch(
    "/{review_id}/approve",
    response_model=ExtractedKnowledgeResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve an extracted claim",
)
def approve_review(
    review_id: UUID,
    actor: Optional[str] = Query(None, max_length=120, description="Name or role of reviewer"),
    db: Session = Depends(get_db),
) -> ExtractedKnowledgeResponse:
    """Approve claim and promote to active project knowledge."""
    return ReviewService.approve_review(db=db, review_id=review_id, actor=actor)


@router.patch(
    "/{review_id}/reject",
    response_model=ExtractedKnowledgeResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject an extracted claim",
)
def reject_review(
    review_id: UUID,
    actor: Optional[str] = Query(None, max_length=120, description="Name or role of reviewer"),
    db: Session = Depends(get_db),
) -> ExtractedKnowledgeResponse:
    """Reject claim from project knowledge base."""
    return ReviewService.reject_review(db=db, review_id=review_id, actor=actor)


@router.patch(
    "/{review_id}",
    response_model=ExtractedKnowledgeResponse,
    status_code=status.HTTP_200_OK,
    summary="Edit an extracted claim",
)
def update_review(
    review_id: UUID,
    update_data: ExtractedKnowledgeUpdate,
    actor: Optional[str] = Query(None, max_length=120, description="Name or role of editor"),
    db: Session = Depends(get_db),
) -> ExtractedKnowledgeResponse:
    """Update title, content, owner or category of an extracted claim before approval."""
    return ReviewService.update_review(
        db=db, review_id=review_id, update_data=update_data, actor=actor
    )


@router.post(
    "/approve-all",
    status_code=status.HTTP_200_OK,
    summary="Batch approve all pending claims",
)
def approve_all_reviews(
    project_id: Optional[UUID] = Query(None, description="Project ID filter"),
    document_id: Optional[UUID] = Query(None, description="Document ID filter"),
    actor: Optional[str] = Query(None, max_length=120, description="Reviewer actor"),
    db: Session = Depends(get_db),
) -> dict:
    """Approve all pending claims in batch."""
    count = ReviewService.approve_all(
        db=db, project_id=project_id, document_id=document_id, actor=actor
    )
    return {"message": "Batch approved", "approved_count": count}

