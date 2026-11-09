from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.task import TaskPriority, TaskStatus
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.services import task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post(
    "/",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a task",
)
def create_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
) -> TaskResponse:
    """Create a new task with project validation."""
    if not task_in.project_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="project_id is required",
        )
    try:
        return task_service.create_task(db=db, task_in=task_in)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/",
    response_model=List[TaskResponse],
    status_code=status.HTTP_200_OK,
    summary="List tasks",
)
def list_tasks(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    task_status: Optional[TaskStatus] = Query(None, alias="status", description="Filter by task status"),
    priority: Optional[TaskPriority] = Query(None, description="Filter by task priority"),
    skip: int = Query(0, ge=0, description="Items to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum items to return"),
    db: Session = Depends(get_db),
) -> List[TaskResponse]:
    """List tasks, optionally filtered by project, status or priority."""
    return task_service.get_tasks(
        db=db,
        project_id=project_id,
        status=task_status,
        priority=priority,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve a task",
)
def get_task(
    task_id: UUID,
    db: Session = Depends(get_db),
) -> TaskResponse:
    """Retrieve details of a task by ID."""
    task = task_service.get_task_by_id(db=db, task_id=task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID '{task_id}' not found",
        )
    return task


@router.patch(
    "/{task_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a task",
)
def update_task(
    task_id: UUID,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
) -> TaskResponse:
    """Update task fields and record activity event."""
    task = task_service.get_task_by_id(db=db, task_id=task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID '{task_id}' not found",
        )
    return task_service.update_task(db=db, task=task, task_in=task_in)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a task",
)
def delete_task(
    task_id: UUID,
    actor: Optional[str] = Query(None, description="Actor deleting the task"),
    db: Session = Depends(get_db),
) -> Response:
    """Delete a task by ID."""
    task = task_service.get_task_by_id(db=db, task_id=task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID '{task_id}' not found",
        )
    task_service.delete_task(db=db, task=task, actor=actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
