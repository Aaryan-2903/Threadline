from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.continuity import ContinuityGraphResponse, NodeDetailResponse
from app.services.continuity_service import ContinuityService

router = APIRouter(prefix="/continuity", tags=["continuity"])


@router.get(
    "/graph",
    response_model=ContinuityGraphResponse,
    status_code=status.HTTP_200_OK,
    summary="Get project continuity knowledge graph",
)
def get_continuity_graph(
    project_id: UUID = Query(..., description="Project ID for the continuity map"),
    db: Session = Depends(get_db),
) -> ContinuityGraphResponse:
    """Retrieve connected knowledge graph nodes and edges for a specific project."""
    return ContinuityService.get_continuity_graph(db=db, project_id=project_id)


@router.get(
    "/nodes/{node_id}",
    response_model=NodeDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get continuity node details and connections",
)
def get_node_detail(
    node_id: str,
    project_id: UUID = Query(..., description="Project ID containing the node"),
    db: Session = Depends(get_db),
) -> NodeDetailResponse:
    """Retrieve deep inspector details and direct connections for a specific graph node."""
    return ContinuityService.get_node_detail(db=db, project_id=project_id, node_id=node_id)

