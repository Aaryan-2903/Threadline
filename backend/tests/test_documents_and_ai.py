import io
import docx
import pymupdf
import pytest
from fastapi import status


def _create_sample_pdf() -> bytes:
    doc = pymupdf.open()
    page1 = doc.new_page()
    page1.insert_text(
        (50, 72),
        "Threadline Architecture Plan\n"
        "Decision: We decided to adopt PostgreSQL with psycopg3 for persistence.\n"
        "Decided by Sarah Chen on 2026-11-01.\n"
        "Task: Setup database connection pooling and Alembic migrations.\n"
        "Assigned to Marcus Vance.\n"
        "Risk: High write load during batch ingest may cause database latency bottlenecks.",
    )
    page2 = doc.new_page()
    page2.insert_text(
        (50, 72),
        "Threadline Handover Specifications\n"
        "Open Question: Should document uploads require virus scanning before parsing?\n"
        "Conflict: S3 direct upload conflicts with air-gapped deployment requirement.",
    )
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def _create_sample_docx() -> bytes:
    doc = docx.Document()
    doc.add_heading("Project Handover Note", level=1)
    doc.add_paragraph("Decision: Selected React 19 and Tailwind CSS 4 for frontend UI.")
    doc.add_paragraph("Decided by Elena Rostova.")
    doc.add_paragraph("Task: Implement AI Review Queue with source citation viewer.")
    doc.add_paragraph("Assigned to Aryan Sharma.")
    doc.add_paragraph("Risk: Browser memory exhaustion when displaying large PDF preview.")
    bio = io.BytesIO()
    doc.save(bio)
    return bio.getvalue()


def _create_project(client, name="Test Project"):
    resp = client.post("/api/v1/projects/", json={"name": name})
    assert resp.status_code == status.HTTP_201_CREATED
    return resp.json()["id"]


def test_upload_empty_file_fails(client):
    project_id = _create_project(client)
    files = {"file": ("empty.pdf", b"", "application/pdf")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "empty" in res.json()["detail"].lower()


def test_upload_unsupported_file_fails(client):
    project_id = _create_project(client)
    files = {"file": ("script.py", b"print('hello')", "text/plain")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "unsupported" in res.json()["detail"].lower()


def test_upload_corrupt_pdf_fails(client):
    project_id = _create_project(client)
    files = {"file": ("corrupt.pdf", b"NOT_A_REAL_PDF_HEADER", "application/pdf")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "failed to parse" in res.json()["detail"].lower()


def test_upload_valid_pdf_and_extract(client):
    project_id = _create_project(client)
    pdf_bytes = _create_sample_pdf()

    files = {"file": ("architecture_plan.pdf", pdf_bytes, "application/pdf")}
    data = {"project_id": project_id, "author": "Sarah Chen"}

    res = client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == status.HTTP_201_CREATED
    doc_data = res.json()
    assert doc_data["filename"] == "architecture_plan.pdf"
    assert doc_data["file_type"] == "pdf"
    assert doc_data["status"] == "extracted"
    assert doc_data["page_count"] == 2
    assert doc_data["extracted_claims_count"] >= 3
    doc_id = doc_data["id"]

    # Check reviews created
    reviews_res = client.get(f"/api/v1/reviews?document_id={doc_id}")
    assert reviews_res.status_code == status.HTTP_200_OK
    claims = reviews_res.json()
    assert len(claims) >= 3

    # Check that decisions, tasks, and risks are properly categorized
    categories = [c["category"] for c in claims]
    assert "decision" in categories
    assert "task" in categories
    assert "risk" in categories

    # Verify citation reference contains "Page"
    for claim in claims:
        assert claim["source_reference"] is not None
        assert "page" in claim["source_reference"].lower()
        assert claim["confidence"] > 0.5


def test_upload_valid_docx_and_extract(client):
    project_id = _create_project(client)
    docx_bytes = _create_sample_docx()

    files = {"file": ("handover_spec.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    data = {"project_id": project_id, "author": "Elena Rostova"}

    res = client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == status.HTTP_201_CREATED
    doc_data = res.json()
    assert doc_data["filename"] == "handover_spec.docx"
    assert doc_data["file_type"] == "docx"
    assert doc_data["status"] == "extracted"
    assert doc_data["extracted_claims_count"] >= 2


def test_review_approval_lifecycle(client):
    project_id = _create_project(client)
    pdf_bytes = _create_sample_pdf()

    files = {"file": ("architecture_plan.pdf", pdf_bytes, "application/pdf")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)
    doc_id = res.json()["id"]

    reviews_res = client.get(f"/api/v1/reviews?document_id={doc_id}")
    claims = reviews_res.json()
    assert len(claims) > 0

    first_claim = claims[0]
    claim_id = first_claim["id"]

    # Edit claim
    edit_res = client.patch(
        f"/api/v1/reviews/{claim_id}",
        json={"title": "Updated Architecture Decision", "owner": "Lead Architect"},
    )
    assert edit_res.status_code == status.HTTP_200_OK
    assert edit_res.json()["title"] == "Updated Architecture Decision"

    # Approve claim
    approve_res = client.patch(f"/api/v1/reviews/{claim_id}/approve?actor=LeadArchitect")
    assert approve_res.status_code == status.HTTP_200_OK
    assert approve_res.json()["status"] == "approved"

    # Reject another claim if present
    if len(claims) > 1:
        second_claim_id = claims[1]["id"]
        reject_res = client.patch(f"/api/v1/reviews/{second_claim_id}/reject?actor=LeadArchitect")
        assert reject_res.status_code == status.HTTP_200_OK
        assert reject_res.json()["status"] == "rejected"

    # Batch approve remaining
    batch_res = client.post(f"/api/v1/reviews/approve-all?project_id={project_id}")
    assert batch_res.status_code == status.HTTP_200_OK
    assert "approved_count" in batch_res.json()


def test_delete_document_cascades(client):
    project_id = _create_project(client)
    pdf_bytes = _create_sample_pdf()

    files = {"file": ("to_delete.pdf", pdf_bytes, "application/pdf")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)
    doc_id = res.json()["id"]

    # Delete doc
    del_res = client.delete(f"/api/v1/documents/{doc_id}")
    assert del_res.status_code == status.HTTP_200_OK

    # Verify not found
    get_res = client.get(f"/api/v1/documents/{doc_id}")
    assert get_res.status_code == status.HTTP_404_NOT_FOUND

    # Verify claims cascade deleted
    reviews_res = client.get(f"/api/v1/reviews?document_id={doc_id}")
    assert reviews_res.status_code == status.HTTP_200_OK
    assert len(reviews_res.json()) == 0

