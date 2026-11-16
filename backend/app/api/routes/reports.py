import json
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import check_write_permission, get_current_user_optional
from app.database import get_db
from app.models.report import HandoverReport
from app.models.user import User
from app.schemas.report import (
    HandoverAcknowledgeRequest,
    HandoverClarificationRequest,
    HandoverReportContent,
    HandoverReportResponse,
    HandoverReportUpdateSuccessor,
    HandoverSendRequest,
    HandoverVersionCreate,
)
from app.services.audit_service import log_audit_event
from app.services.redaction_service import redaction_service
from app.services.report_service import HandoverReportService

router = APIRouter(prefix="/reports", tags=["reports"])


def _format_report_response(report: HandoverReport, redact: bool = False) -> HandoverReportResponse:
    content_dict = json.loads(report.content_json)
    if redact:
        content_dict, _ = redaction_service.redact_data_structure(content_dict)

    summary = report.summary
    if redact and summary:
        summary, _ = redaction_service.redact_text(summary)

    ack_status_str = report.acknowledgement_status.value if hasattr(report.acknowledgement_status, "value") else str(report.acknowledgement_status or "draft")

    return HandoverReportResponse(
        id=report.id,
        project_id=report.project_id,
        title=report.title,
        summary=summary,
        status=report.status,
        generated_by=report.generated_by,
        version=report.version or 1,
        outgoing_owner=report.outgoing_owner,
        incoming_owner=report.incoming_owner,
        incoming_owner_role=report.incoming_owner_role,
        acknowledgement_status=ack_status_str,
        clarification_notes=report.clarification_notes,
        sent_at=report.sent_at,
        acknowledged_at=report.acknowledged_at,
        content=HandoverReportContent(**content_dict),
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.post(
    "/generate",
    response_model=HandoverReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a project handover report",
)
def generate_report(
    project_id: UUID = Query(..., description="Project ID to generate handover report for"),
    actor: Optional[str] = Query(None, max_length=120, description="Author or reviewer requesting generation"),
    incoming_owner: Optional[str] = Query(None, max_length=120, description="Explicitly designated incoming successor name"),
    incoming_owner_role: Optional[str] = Query(None, max_length=120, description="Optional role/title of designated incoming successor"),
    current_user: Optional[User] = Depends(check_write_permission),
    db: Session = Depends(get_db),
) -> HandoverReportResponse:
    """Compile verified project decisions, tasks, ownership matrix, risks, and references into a formal handover dossier."""
    acting_user = current_user.username if current_user else actor
    report = HandoverReportService.generate_report(
        db=db,
        project_id=project_id,
        actor=acting_user,
        incoming_owner=incoming_owner,
        incoming_owner_role=incoming_owner_role,
    )
    return _format_report_response(report)


@router.patch(
    "/{report_id}/successor",
    response_model=HandoverReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Update assigned incoming successor for a handover report",
)
def update_report_successor(
    report_id: UUID,
    payload: HandoverReportUpdateSuccessor,
    current_user: Optional[User] = Depends(check_write_permission),
    db: Session = Depends(get_db),
) -> HandoverReportResponse:
    """Explicitly assign or update the incoming successor name and role on an existing handover report."""
    report = HandoverReportService.update_report_successor(
        db=db,
        report_id=report_id,
        incoming_owner=payload.incoming_owner,
        incoming_owner_role=payload.incoming_owner_role,
    )
    return _format_report_response(report)


@router.patch(
    "/{report_id}",
    response_model=HandoverReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Update report details",
)
def update_report(
    report_id: UUID,
    payload: HandoverReportUpdateSuccessor,
    current_user: Optional[User] = Depends(check_write_permission),
    db: Session = Depends(get_db),
) -> HandoverReportResponse:
    """Update report successor details."""
    report = HandoverReportService.update_report_successor(
        db=db,
        report_id=report_id,
        incoming_owner=payload.incoming_owner,
        incoming_owner_role=payload.incoming_owner_role,
    )
    return _format_report_response(report)


@router.post(
    "/{report_id}/send-acknowledgement",
    response_model=HandoverReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Send handover for formal acknowledgement",
)
def send_report_acknowledgement(
    report_id: UUID,
    payload: Optional[HandoverSendRequest] = None,
    current_user: Optional[User] = Depends(check_write_permission),
    db: Session = Depends(get_db),
) -> HandoverReportResponse:
    """Transition handover report status to 'pending' and record transmission timestamp."""
    actor = current_user.username if current_user else ((payload.actor if payload and payload.actor else None) or "Outgoing Owner")
    notes = payload.notes if payload else None
    report = HandoverReportService.send_for_acknowledgement(
        db=db, report_id=report_id, actor=actor, notes=notes
    )

    log_audit_event(
        db=db,
        action="handover_sent",
        username=actor,
        project_id=report.project_id,
        resource_type="handover_report",
        resource_id=report.id,
        details=f"Handover report '{report.title}' v{report.version} sent for acknowledgement to {report.incoming_owner or 'Unassigned'}.",
    )
    return _format_report_response(report)


@router.post(
    "/{report_id}/acknowledge",
    response_model=HandoverReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Acknowledge and accept handover",
)
def acknowledge_report(
    report_id: UUID,
    payload: Optional[HandoverAcknowledgeRequest] = None,
    current_user: Optional[User] = Depends(check_write_permission),
    db: Session = Depends(get_db),
) -> HandoverReportResponse:
    """Incoming owner formally ratifies and acknowledges handover receipt."""
    actor = current_user.username if current_user else ((payload.acknowledged_by if payload and payload.acknowledged_by else None) or "Incoming Owner")
    notes = payload.notes if payload else None
    report = HandoverReportService.acknowledge_handover(
        db=db, report_id=report_id, actor=actor, notes=notes
    )

    log_audit_event(
        db=db,
        action="handover_acknowledged",
        username=actor,
        project_id=report.project_id,
        resource_type="handover_report",
        resource_id=report.id,
        details=f"Handover report '{report.title}' v{report.version} formally acknowledged by {actor}.",
    )
    return _format_report_response(report)


@router.post(
    "/{report_id}/request-clarification",
    response_model=HandoverReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Request clarification on handover",
)
def request_report_clarification(
    report_id: UUID,
    payload: HandoverClarificationRequest,
    current_user: Optional[User] = Depends(check_write_permission),
    db: Session = Depends(get_db),
) -> HandoverReportResponse:
    """Incoming owner requests clarification on specific items before sign-off."""
    actor = current_user.username if current_user else ((payload.requested_by if payload and payload.requested_by else None) or "Incoming Owner")
    report = HandoverReportService.request_clarification(
        db=db, report_id=report_id, notes=payload.clarification_notes, actor=actor
    )

    log_audit_event(
        db=db,
        action="handover_clarification_requested",
        username=actor,
        project_id=report.project_id,
        resource_type="handover_report",
        resource_id=report.id,
        details=f"Clarification requested on handover '{report.title}': {payload.clarification_notes[:200]}",
    )
    return _format_report_response(report)


@router.post(
    "/{report_id}/versions",
    response_model=HandoverReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new revision version of a handover report",
)
def create_report_version(
    report_id: UUID,
    payload: Optional[HandoverVersionCreate] = None,
    current_user: Optional[User] = Depends(check_write_permission),
    db: Session = Depends(get_db),
) -> HandoverReportResponse:
    """Generate a newer revision (e.g. v2, v3) of a handover dossier incorporating latest project progress."""
    actor = current_user.username if current_user else (payload.actor if payload else "System")
    title = payload.title if payload else None
    new_report = HandoverReportService.create_version(
        db=db, report_id=report_id, title=title, actor=actor
    )
    return _format_report_response(new_report)


@router.get(
    "/",
    response_model=List[HandoverReportResponse],
    status_code=status.HTTP_200_OK,
    summary="List generated handover reports",
)
def list_reports(
    project_id: Optional[UUID] = Query(None, description="Optional project ID filter"),
    redact: bool = Query(False, description="Redact sensitive data (emails, phones, API keys)"),
    db: Session = Depends(get_db),
) -> List[HandoverReportResponse]:
    """Retrieve all generated handover reports, optionally filtered by project ID."""
    reports = HandoverReportService.list_reports(db=db, project_id=project_id)
    return [_format_report_response(r, redact=redact) for r in reports]


@router.get(
    "/{report_id}",
    response_model=HandoverReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Get handover report details",
)
def get_report(
    report_id: UUID,
    redact: bool = Query(False, description="Redact sensitive data (emails, phones, API keys)"),
    db: Session = Depends(get_db),
) -> HandoverReportResponse:
    """Get full structured handover dossier for preview."""
    report = HandoverReportService.get_report(db=db, report_id=report_id)
    return _format_report_response(report, redact=redact)


@router.get(
    "/{report_id}/pdf",
    status_code=status.HTTP_200_OK,
    summary="Export handover report as PDF",
)
def export_report_pdf(
    report_id: UUID,
    redact: bool = Query(False, description="Redact sensitive data from PDF export"),
    db: Session = Depends(get_db),
) -> Response:
    """Generate and stream a publication-ready handover continuity PDF with title page, sections, tables, and page numbers."""
    pdf_bytes = HandoverReportService.export_pdf(db=db, report_id=report_id)
    report = HandoverReportService.get_report(db=db, report_id=report_id)

    safe_title = "".join(c for c in report.title if c.isalnum() or c in (" ", "-", "_")).rstrip()
    filename = f"{safe_title.replace(' ', '_')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
