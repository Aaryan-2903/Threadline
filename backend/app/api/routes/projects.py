from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.task import TaskPriority, TaskStatus
from app.schemas.activity import ActivityResponse
from app.schemas.decision import DecisionCreate, DecisionResponse
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.schemas.task import TaskCreate, TaskResponse
from app.services import activity_service, decision_service, project_service, task_service

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


# ---------------------------------------------------------------------------
# Project Task Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a task under a project",
)
def create_project_task(
    project_id: UUID,
    task_in: TaskCreate,
    db: Session = Depends(get_db),
) -> TaskResponse:
    """Create a new task specifically associated with this project."""
    try:
        return task_service.create_task(db=db, task_in=task_in, project_id=project_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/{project_id}/tasks",
    response_model=List[TaskResponse],
    status_code=status.HTTP_200_OK,
    summary="List tasks for a project",
)
def list_project_tasks(
    project_id: UUID,
    task_status: Optional[TaskStatus] = Query(None, alias="status", description="Filter by task status"),
    priority: Optional[TaskPriority] = Query(None, description="Filter by task priority"),
    skip: int = Query(0, ge=0, description="Items to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum items to return"),
    db: Session = Depends(get_db),
) -> List[TaskResponse]:
    """List all tasks belonging to this project."""
    project = project_service.get_project_by_id(db=db, project_id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return task_service.get_tasks(
        db=db,
        project_id=project_id,
        status=task_status,
        priority=priority,
        skip=skip,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# Project Decision Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/decisions",
    response_model=DecisionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a decision under a project",
)
def create_project_decision(
    project_id: UUID,
    decision_in: DecisionCreate,
    db: Session = Depends(get_db),
) -> DecisionResponse:
    """Create a new decision record specifically for this project."""
    try:
        return decision_service.create_decision(db=db, decision_in=decision_in, project_id=project_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/{project_id}/decisions",
    response_model=List[DecisionResponse],
    status_code=status.HTTP_200_OK,
    summary="List decisions for a project",
)
def list_project_decisions(
    project_id: UUID,
    skip: int = Query(0, ge=0, description="Items to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum items to return"),
    db: Session = Depends(get_db),
) -> List[DecisionResponse]:
    """List all decision records belonging to this project."""
    project = project_service.get_project_by_id(db=db, project_id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return decision_service.get_decisions(
        db=db,
        project_id=project_id,
        skip=skip,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# Project Activity Timeline Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/{project_id}/activities",
    response_model=List[ActivityResponse],
    status_code=status.HTTP_200_OK,
    summary="Get project activity timeline",
)
def get_project_activities(
    project_id: UUID,
    order: str = Query("desc", pattern="^(asc|desc)$", description="Sort order ('asc' or 'desc')"),
    skip: int = Query(0, ge=0, description="Items to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum items to return"),
    db: Session = Depends(get_db),
) -> List[ActivityResponse]:
    """Retrieve chronological activity timeline for this project."""
    project = project_service.get_project_by_id(db=db, project_id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return activity_service.get_project_activities(
        db=db,
        project_id=project_id,
        skip=skip,
        limit=limit,
        order=order,
    )


@router.get(
    "/{project_id}/timeline",
    response_model=List[ActivityResponse],
    status_code=status.HTTP_200_OK,
    summary="Get project activity timeline (alias)",
)
def get_project_timeline(
    project_id: UUID,
    order: str = Query("desc", pattern="^(asc|desc)$", description="Sort order ('asc' or 'desc')"),
    skip: int = Query(0, ge=0, description="Items to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum items to return"),
    db: Session = Depends(get_db),
) -> List[ActivityResponse]:
    """Alias for retrieving chronological activity timeline for this project."""
    return get_project_activities(
        project_id=project_id,
        order=order,
        skip=skip,
        limit=limit,
        db=db,
    )
