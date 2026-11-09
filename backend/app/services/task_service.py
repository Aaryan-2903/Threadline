from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.project import Project
from app.models.task import Task, TaskPriority, TaskStatus
from app.schemas.task import TaskCreate, TaskUpdate
from app.services import activity_service


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_task(
    db: Session,
    task_in: TaskCreate,
    project_id: Optional[UUID] = None,
) -> Task:
    """Create a task and record the task_created event."""
    target_project_id = project_id or task_in.project_id
    if not target_project_id:
        raise ValueError("Project ID is required to create a task")

    # Verify project exists
    project = db.query(Project).filter(Project.id == target_project_id).first()
    if not project:
        raise LookupError(f"Project with ID '{target_project_id}' not found")

    task = Task(
        project_id=target_project_id,
        title=task_in.title,
        description=task_in.description,
        status=task_in.status,
        priority=task_in.priority,
        assignee=task_in.assignee,
        due_date=task_in.due_date,
    )
    db.add(task)
    db.flush()  # populate task.id before activity record

    # Record activity timeline event
    actor = task_in.actor or task_in.assignee or "system"
    activity_service.record_activity(
        db=db,
        project_id=target_project_id,
        event_type="task_created",
        description=f"Task '{task.title}' was created",
        actor=actor,
        entity_type="task",
        entity_id=task.id,
    )

    db.commit()
    db.refresh(task)
    return task


def get_tasks(
    db: Session,
    project_id: Optional[UUID] = None,
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Task]:
    """Retrieve tasks with optional filtering, ordered newest first."""
    query = db.query(Task)
    if project_id is not None:
        query = query.filter(Task.project_id == project_id)
    if status is not None:
        query = query.filter(Task.status == status)
    if priority is not None:
        query = query.filter(Task.priority == priority)
    return query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()


def get_task_by_id(db: Session, task_id: UUID) -> Optional[Task]:
    """Retrieve a single task by ID."""
    return db.query(Task).filter(Task.id == task_id).first()


def update_task(
    db: Session,
    task: Task,
    task_in: TaskUpdate,
) -> Task:
    """Update a task and record activity events for changes."""
    update_data = task_in.model_dump(exclude_unset=True)
    actor = update_data.pop("actor", None) or task.assignee or "system"

    status_changed = False
    old_status = task.status
    other_fields_changed = False

    for field, new_val in update_data.items():
        old_val = getattr(task, field)
        if old_val != new_val:
            if field == "status":
                status_changed = True
            else:
                other_fields_changed = True
            setattr(task, field, new_val)

    # Avoid duplicate activity records: only record if changes actually occurred
    if status_changed:
        activity_service.record_activity(
            db=db,
            project_id=task.project_id,
            event_type="task_status_changed",
            description=f"Task '{task.title}' status changed from '{old_status.value if hasattr(old_status, 'value') else old_status}' to '{task.status.value if hasattr(task.status, 'value') else task.status}'",
            actor=actor,
            entity_type="task",
            entity_id=task.id,
        )

    if other_fields_changed:
        activity_service.record_activity(
            db=db,
            project_id=task.project_id,
            event_type="task_updated",
            description=f"Task '{task.title}' was updated",
            actor=actor,
            entity_type="task",
            entity_id=task.id,
        )

    if status_changed or other_fields_changed:
        task.updated_at = utc_now()
        db.commit()
        db.refresh(task)

    return task


def delete_task(
    db: Session,
    task: Task,
    actor: Optional[str] = "system",
) -> None:
    """Delete a task and record the deletion activity event."""
    activity_service.record_activity(
        db=db,
        project_id=task.project_id,
        event_type="task_deleted",
        description=f"Task '{task.title}' was deleted",
        actor=actor or "system",
        entity_type="task",
        entity_id=task.id,
    )
    db.delete(task)
    db.commit()

