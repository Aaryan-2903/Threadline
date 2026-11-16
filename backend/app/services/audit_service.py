from typing import List, Optional
from uuid import UUID
from sqlalchemy import desc
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def log_audit_event(
    db: Session,
    action: str,
    username: Optional[str] = None,
    user_role: Optional[str] = None,
    user_id: Optional[UUID] = None,
    project_id: Optional[UUID] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[UUID] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Record an immutable audit log entry in the database."""
    log = AuditLog(
        action=action,
        username=username or "System",
        user_role=user_role,
        user_id=user_id,
        project_id=project_id,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_audit_logs(
    db: Session,
    project_id: Optional[UUID] = None,
    action_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[AuditLog]:
    """Retrieve audit logs ordered newest first, with optional project and action filtering."""
    query = db.query(AuditLog)
    if project_id:
        query = query.filter(AuditLog.project_id == project_id)
    if action_filter:
        query = query.filter(AuditLog.action == action_filter)
    return query.order_by(desc(AuditLog.timestamp)).offset(skip).limit(limit).all()

