from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.activity import ActivityResponse
from app.services import activity_service

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get(
    "/",
    response_model=List[ActivityResponse],
    status_code=status.HTTP_200_OK,
    summary="List activity events",
)
def list_activities(
    project_id: Optional[UUID] = Query(None, description="Filter activities by project ID"),
    order: str = Query("desc", pattern="^(asc|desc)$", description="Sort order by timestamp ('asc' or 'desc')"),
    skip: int = Query(0, ge=0, description="Items to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum items to return"),
    db: Session = Depends(get_db),
) -> List[ActivityResponse]:
    """Retrieve activity events across projects or for a specific project."""
    return activity_service.get_all_activities(
        db=db,
        project_id=project_id,
        skip=skip,
        limit=limit,
        order=order,
    )
