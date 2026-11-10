import json
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.report import HandoverReport
from app.schemas.report import HandoverReportContent, HandoverReportResponse, HandoverReportUpdateSuccessor
from app.services.report_service import HandoverReportService

router = APIRouter(prefix="/reports", tags=["reports"])


def _format_report_response(report: HandoverReport) -> HandoverReportResponse:
    content_dict = json.loads(report.content_json)
    return HandoverReportResponse(
        id=report.id,
        project_id=report.project_id,
        title=report.title,
        summary=report.summary,
        status=report.status,
        generated_by=report.generated_by,
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
    db: Session = Depends(get_db),
) -> HandoverReportResponse:
    """Compile verified project decisions, tasks, ownership matrix, risks, and references into a formal handover dossier."""
    report = HandoverReportService.generate_report(
        db=db,
        project_id=project_id,
        actor=actor,
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


@router.get(
    "/",
    response_model=List[HandoverReportResponse],
    status_code=status.HTTP_200_OK,
    summary="List generated handover reports",
)
def list_reports(
    project_id: Optional[UUID] = Query(None, description="Optional project ID filter"),
    db: Session = Depends(get_db),
) -> List[HandoverReportResponse]:
    """Retrieve all generated handover reports, optionally filtered by project ID."""
    reports = HandoverReportService.list_reports(db=db, project_id=project_id)
    return [_format_report_response(r) for r in reports]


@router.get(
    "/{report_id}",
    response_model=HandoverReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Get handover report details",
)
def get_report(
    report_id: UUID,
    db: Session = Depends(get_db),
) -> HandoverReportResponse:
    """Get full structured handover dossier for preview."""
    report = HandoverReportService.get_report(db=db, report_id=report_id)
    return _format_report_response(report)


@router.get(
    "/{report_id}/pdf",
    status_code=status.HTTP_200_OK,
    summary="Export handover report as PDF",
)
def export_report_pdf(
    report_id: UUID,
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

