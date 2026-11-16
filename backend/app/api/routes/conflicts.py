from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import check_write_permission, get_current_user_optional, require_role
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.conflict import ConflictDetectResponse, ConflictResolveRequest, ConflictResponse
from app.services import conflict_service

router = APIRouter(tags=["conflicts"])


@router.get(
    "/projects/{project_id}/conflicts/",
    response_model=List[ConflictResponse],
    status_code=status.HTTP_200_OK,
    summary="List project conflicts",
)
def list_conflicts(
    project_id: UUID,
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(open|resolved|dismissed)$"),
    db: Session = Depends(get_db),
) -> List[ConflictResponse]:
    """List detected conflicts for a project with optional status filtering."""
    conflicts = conflict_service.get_project_conflicts(
        db=db, project_id=project_id, status_filter=status_filter
    )
    return [ConflictResponse.model_validate(c) for c in conflicts]


@router.post(
    "/projects/{project_id}/conflicts/detect",
    response_model=ConflictDetectResponse,
    status_code=status.HTTP_200_OK,
    summary="Run conflict detection scan",
)
def detect_conflicts(
    project_id: UUID,
    actor: Optional[str] = Query("System"),
    current_user: Optional[User] = Depends(check_write_permission),
    db: Session = Depends(get_db),
) -> ConflictDetectResponse:
    """
    Run the deterministic conflict detection engine across project records,
    identifying contradictory claims, superseded decisions, and clashing task deadlines/assignees.
    """
    acting_user = current_user.username if current_user else actor
    conflicts = conflict_service.detect_project_conflicts(
        db=db, project_id=project_id, actor=acting_user or "System"
    )

    open_c = [c for c in conflicts if c.status.value == "open"]
    resolved_c = [c for c in conflicts if c.status.value in ("resolved", "dismissed")]

    return ConflictDetectResponse(
        project_id=project_id,
        detected_count=len(conflicts),
        open_count=len(open_c),
        resolved_count=len(resolved_c),
        conflicts=[ConflictResponse.model_validate(c) for c in conflicts],
    )


@router.get(
    "/conflicts/{conflict_id}",
    response_model=ConflictResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve conflict details",
)
def get_conflict(
    conflict_id: UUID,
    db: Session = Depends(get_db),
) -> ConflictResponse:
    """Retrieve full details of a specific conflict record."""
    conflict = conflict_service.get_conflict_by_id(db=db, conflict_id=conflict_id)
    if not conflict:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conflict not found.",
        )
    return ConflictResponse.model_validate(conflict)


@router.patch(
    "/conflicts/{conflict_id}",
    response_model=ConflictResponse,
    status_code=status.HTTP_200_OK,
    summary="Resolve or dismiss a conflict",
)
def resolve_or_dismiss_conflict(
    conflict_id: UUID,
    resolve_in: ConflictResolveRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> ConflictResponse:
    """
    Resolve, dismiss, or reopen a conflict with resolution notes and attribution.
    Enforces Role-Based Access: Viewers and regular Contributors cannot resolve conflicts;
    requires Project Owner or Admin.
    """
    if current_user is not None:
        role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        if role_val in (UserRole.VIEWER.value, UserRole.CONTRIBUTOR.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Resolving conflicts requires 'project_owner' or 'admin' privileges. Your role is '{role_val}'.",
            )
        resolved_by = current_user.username
    else:
        resolved_by = resolve_in.resolved_by or "Project Owner"

    updated = conflict_service.resolve_conflict(
        db=db,
        conflict_id=conflict_id,
        status=resolve_in.status,
        resolution_notes=resolve_in.resolution_notes,
        resolved_by=resolved_by,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conflict not found.",
        )

    return ConflictResponse.model_validate(updated)

