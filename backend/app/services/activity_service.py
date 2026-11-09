from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.activity import Activity


def record_activity(
    db: Session,
    project_id: UUID,
    event_type: str,
    description: str,
    actor: Optional[str] = "system",
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
) -> Activity:
    """Record an activity event for a project within the current database transaction."""
    activity = Activity(
        project_id=project_id,
        event_type=event_type,
        description=description,
        actor=actor or "system",
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(activity)
    return activity


def get_project_activities(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
    order: str = "desc",
) -> List[Activity]:
    """Retrieve chronological activity records for a specific project."""
    query = db.query(Activity).filter(Activity.project_id == project_id)
    if order.lower() == "asc":
        query = query.order_by(Activity.timestamp.asc(), Activity.id.asc())
    else:
        query = query.order_by(Activity.timestamp.desc(), Activity.id.desc())
    return query.offset(skip).limit(limit).all()


def get_all_activities(
    db: Session,
    project_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    order: str = "desc",
) -> List[Activity]:
    """Retrieve activities with optional project filter."""
    query = db.query(Activity)
    if project_id is not None:
        query = query.filter(Activity.project_id == project_id)
    if order.lower() == "asc":
        query = query.order_by(Activity.timestamp.asc(), Activity.id.asc())
    else:
        query = query.order_by(Activity.timestamp.desc(), Activity.id.desc())
    return query.offset(skip).limit(limit).all()

