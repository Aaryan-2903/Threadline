from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post(
    "/",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project",
)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Create a new project."""
    return project_service.create_project(db=db, project_in=project_in)


@router.get(
    "/",
    response_model=List[ProjectResponse],
    status_code=status.HTTP_200_OK,
    summary="List all projects",
)
def list_projects(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of items to return"),
    db: Session = Depends(get_db),
) -> List[ProjectResponse]:
    """List all projects ordered newest first."""
    return project_service.get_projects(db=db, skip=skip, limit=limit)


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve a single project",
)
def get_project(
    project_id: UUID,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Retrieve details of a single project by its ID."""
    project = project_service.get_project_by_id(db=db, project_id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return project


@router.patch(
    "/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a project",
)
def update_project(
    project_id: UUID,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Update project name, description or status."""
    project = project_service.get_project_by_id(db=db, project_id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return project_service.update_project(db=db, project=project, project_in=project_in)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project",
)
def delete_project(
    project_id: UUID,
    db: Session = Depends(get_db),
) -> Response:
    """Delete a project by its ID."""
    project = project_service.get_project_by_id(db=db, project_id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    project_service.delete_project(db=db, project=project)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

