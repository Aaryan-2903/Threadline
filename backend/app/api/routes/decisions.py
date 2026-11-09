from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.decision import DecisionCreate, DecisionResponse, DecisionUpdate
from app.services import decision_service

router = APIRouter(prefix="/decisions", tags=["decisions"])


@router.post(
    "/",
    response_model=DecisionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a decision",
)
def create_decision(
    decision_in: DecisionCreate,
    db: Session = Depends(get_db),
) -> DecisionResponse:
    """Create a new decision record with project validation."""
    if not decision_in.project_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="project_id is required",
        )
    try:
        return decision_service.create_decision(db=db, decision_in=decision_in)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/",
    response_model=List[DecisionResponse],
    status_code=status.HTTP_200_OK,
    summary="List decisions",
)
def list_decisions(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    skip: int = Query(0, ge=0, description="Items to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum items to return"),
    db: Session = Depends(get_db),
) -> List[DecisionResponse]:
    """List decisions, optionally filtered by project ID."""
    return decision_service.get_decisions(
        db=db,
        project_id=project_id,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{decision_id}",
    response_model=DecisionResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve a decision",
)
def get_decision(
    decision_id: UUID,
    db: Session = Depends(get_db),
) -> DecisionResponse:
    """Retrieve details of a decision by ID."""
    decision = decision_service.get_decision_by_id(db=db, decision_id=decision_id)
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Decision with ID '{decision_id}' not found",
        )
    return decision


@router.patch(
    "/{decision_id}",
    response_model=DecisionResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a decision",
)
def update_decision(
    decision_id: UUID,
    decision_in: DecisionUpdate,
    db: Session = Depends(get_db),
) -> DecisionResponse:
    """Update decision fields and record activity event."""
    decision = decision_service.get_decision_by_id(db=db, decision_id=decision_id)
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Decision with ID '{decision_id}' not found",
        )
    return decision_service.update_decision(db=db, decision=decision, decision_in=decision_in)


@router.delete(
    "/{decision_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a decision",
)
def delete_decision(
    decision_id: UUID,
    actor: Optional[str] = Query(None, description="Actor deleting the decision"),
    db: Session = Depends(get_db),
) -> Response:
    """Delete a decision by ID."""
    decision = decision_service.get_decision_by_id(db=db, decision_id=decision_id)
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Decision with ID '{decision_id}' not found",
        )
    decision_service.delete_decision(db=db, decision=decision, actor=actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

