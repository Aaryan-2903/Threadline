from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.decision import Decision
from app.models.project import Project
from app.schemas.decision import DecisionCreate, DecisionUpdate
from app.services import activity_service


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_decision(
    db: Session,
    decision_in: DecisionCreate,
    project_id: Optional[UUID] = None,
) -> Decision:
    """Create a decision record and record the decision_created event."""
    target_project_id = project_id or decision_in.project_id
    if not target_project_id:
        raise ValueError("Project ID is required to create a decision")

    # Verify project exists
    project = db.query(Project).filter(Project.id == target_project_id).first()
    if not project:
        raise LookupError(f"Project with ID '{target_project_id}' not found")

    decision = Decision(
        project_id=target_project_id,
        title=decision_in.title,
        description=decision_in.description,
        rationale=decision_in.rationale,
        decided_by=decision_in.decided_by,
        decision_date=decision_in.decision_date or utc_now(),
    )
    db.add(decision)
    db.flush()

    # Record activity timeline event
    actor = decision_in.actor or decision_in.decided_by or "system"
    activity_service.record_activity(
        db=db,
        project_id=target_project_id,
        event_type="decision_created",
        description=f"Decision '{decision.title}' was recorded",
        actor=actor,
        entity_type="decision",
        entity_id=decision.id,
    )

    db.commit()
    db.refresh(decision)
    return decision


def get_decisions(
    db: Session,
    project_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Decision]:
    """Retrieve decisions ordered newest decision_date first."""
    query = db.query(Decision)
    if project_id is not None:
        query = query.filter(Decision.project_id == project_id)
    return (
        query.order_by(Decision.decision_date.desc(), Decision.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_decision_by_id(db: Session, decision_id: UUID) -> Optional[Decision]:
    """Retrieve a single decision by ID."""
    return db.query(Decision).filter(Decision.id == decision_id).first()


def update_decision(
    db: Session,
    decision: Decision,
    decision_in: DecisionUpdate,
) -> Decision:
    """Update a decision and record activity event if fields changed."""
    update_data = decision_in.model_dump(exclude_unset=True)
    actor = update_data.pop("actor", None) or decision.decided_by or "system"

    changed = False
    for field, new_val in update_data.items():
        old_val = getattr(decision, field)
        if old_val != new_val:
            changed = True
            setattr(decision, field, new_val)

    # Avoid duplicate activity records: only record if changes actually occurred
    if changed:
        decision.updated_at = utc_now()
        activity_service.record_activity(
            db=db,
            project_id=decision.project_id,
            event_type="decision_updated",
            description=f"Decision '{decision.title}' was updated",
            actor=actor,
            entity_type="decision",
            entity_id=decision.id,
        )
        db.commit()
        db.refresh(decision)

    return decision


def delete_decision(
    db: Session,
    decision: Decision,
    actor: Optional[str] = "system",
) -> None:
    """Delete a decision and record deletion activity event."""
    activity_service.record_activity(
        db=db,
        project_id=decision.project_id,
        event_type="decision_deleted",
        description=f"Decision '{decision.title}' was deleted",
        actor=actor or "system",
        entity_type="decision",
        entity_id=decision.id,
    )
    db.delete(decision)
    db.commit()

