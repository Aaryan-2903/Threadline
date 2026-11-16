from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.database import get_db
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse
from app.services import audit_service

router = APIRouter(tags=["audit_logs"])


@router.get(
    "/audit-logs/",
    response_model=List[AuditLogResponse],
    status_code=status.HTTP_200_OK,
    summary="List system audit logs",
)
def list_system_audit_logs(
    project_id: Optional[UUID] = Query(None, description="Filter logs by project"),
    action: Optional[str] = Query(None, description="Filter logs by action"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> List[AuditLogResponse]:
    """Retrieve immutable audit trail entries recording security events, resolutions, and handover transitions."""
    logs = audit_service.get_audit_logs(
        db=db,
        project_id=project_id,
        action_filter=action,
        skip=skip,
        limit=limit,
    )
    return [AuditLogResponse.model_validate(log) for log in logs]


@router.get(
    "/projects/{project_id}/audit-logs/",
    response_model=List[AuditLogResponse],
    status_code=status.HTTP_200_OK,
    summary="List project audit logs",
)
def list_project_audit_logs(
    project_id: UUID,
    action: Optional[str] = Query(None, description="Filter logs by action"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> List[AuditLogResponse]:
    """Retrieve audit trail entries specific to a given project."""
    logs = audit_service.get_audit_logs(
        db=db,
        project_id=project_id,
        action_filter=action,
        skip=skip,
        limit=limit,
    )
    return [AuditLogResponse.model_validate(log) for log in logs]

