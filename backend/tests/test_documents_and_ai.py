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
    detail = res.json()["detail"].lower()
    assert "pdf" in detail or "signature" in detail or "failed to parse" in detail


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


def test_list_documents_defers_raw_content_and_extracted_text(client, db_session):
    """
    Regression test: Security Audit Fix 1.
    Verify that DocumentService.list_documents() defers loading of raw_content
    and extracted_text so large binary payloads are not loaded into memory unnecessarily.
    """
    from sqlalchemy import inspect
    from app.services.document_service import DocumentService

    project_id = _create_project(client, "Deferred Loading Project")
    pdf_bytes = _create_sample_pdf()

    files = {"file": ("large_spec.pdf", pdf_bytes, "application/pdf")}
    data = {"project_id": project_id, "author": "Security Auditor"}
    upload_res = client.post("/api/v1/documents/upload", files=files, data=data)
    assert upload_res.status_code == status.HTTP_201_CREATED

    # 1. Test via service layer directly with db_session
    db_session.expire_all()
    docs = DocumentService.list_documents(db=db_session, project_id=project_id)
    assert len(docs) == 1
    doc = docs[0]

    # Inspect SQLAlchemy instance state: raw_content and extracted_text must be in unloaded
    insp = inspect(doc)
    assert "raw_content" in insp.unloaded, "raw_content should be deferred and unloaded initially"
    assert "extracted_text" in insp.unloaded, "extracted_text should be deferred and unloaded initially"
    assert "raw_content" not in doc.__dict__, "raw_content should not be loaded into instance dict"
    assert "extracted_text" not in doc.__dict__, "extracted_text should not be loaded into instance dict"

    # Verify metadata is loaded
    assert doc.filename == "large_spec.pdf"
    assert doc.file_type == "pdf"
    assert doc.file_size == len(pdf_bytes)

    # 2. Verify on-demand lazy loading works if content is explicitly accessed
    lazy_loaded_content = doc.raw_content
    assert lazy_loaded_content == pdf_bytes
    assert "raw_content" not in inspect(doc).unloaded, "raw_content should be loaded after explicit access"

    # 3. Test via API route
    api_res = client.get(f"/api/v1/documents?project_id={project_id}")
    assert api_res.status_code == status.HTTP_200_OK
    doc_list = api_res.json()
    assert len(doc_list) == 1
    assert doc_list[0]["filename"] == "large_spec.pdf"
    assert doc_list[0]["file_size"] == len(pdf_bytes)


def test_approve_decision_claim_idempotent(client):
    """
    Regression test: Security Audit Fix 2.
    Verify that approving an already-approved decision claim twice is idempotent:
    only one Decision is created and activity events are not duplicated.
    """
    project_id = _create_project(client, "Idempotent Decision Project")
    pdf_bytes = _create_sample_pdf()

    files = {"file": ("decision_spec.pdf", pdf_bytes, "application/pdf")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == status.HTTP_201_CREATED
    doc_id = res.json()["id"]

    reviews_res = client.get(f"/api/v1/reviews?document_id={doc_id}&category=decision")
    dec_claims = reviews_res.json()
    assert len(dec_claims) > 0, "Expected at least one decision claim"
    claim_id = dec_claims[0]["id"]

    # First approval
    approve1 = client.patch(f"/api/v1/reviews/{claim_id}/approve?actor=LeadArchitect")
    assert approve1.status_code == status.HTTP_200_OK
    assert approve1.json()["status"] == "approved"

    # Verify 1 decision created
    decs_after_1 = client.get(f"/api/v1/projects/{project_id}/decisions").json()
    assert len(decs_after_1) == 1
    decision_id = decs_after_1[0]["id"]

    # Check activity events count
    acts_after_1 = client.get(f"/api/v1/activities?project_id={project_id}").json()
    act_count_1 = len(acts_after_1)

    # Second approval attempt on the already-approved claim
    approve2 = client.patch(f"/api/v1/reviews/{claim_id}/approve?actor=LeadArchitect")
    assert approve2.status_code == status.HTTP_200_OK
    assert approve2.json()["status"] == "approved"

    # Verify STILL exactly 1 decision exists (no duplicate created)
    decs_after_2 = client.get(f"/api/v1/projects/{project_id}/decisions").json()
    assert len(decs_after_2) == 1
    assert decs_after_2[0]["id"] == decision_id

    # Verify activity events count is unchanged (no duplicate claim_approved activity)
    acts_after_2 = client.get(f"/api/v1/activities?project_id={project_id}").json()
    assert len(acts_after_2) == act_count_1


def test_approve_task_claim_idempotent(client):
    """
    Regression test: Security Audit Fix 2.
    Verify that approving an already-approved task claim twice is idempotent:
    only one Task is created and activity events are not duplicated.
    """
    project_id = _create_project(client, "Idempotent Task Project")
    pdf_bytes = _create_sample_pdf()

    files = {"file": ("task_spec.pdf", pdf_bytes, "application/pdf")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == status.HTTP_201_CREATED
    doc_id = res.json()["id"]

    reviews_res = client.get(f"/api/v1/reviews?document_id={doc_id}&category=task")
    task_claims = reviews_res.json()
    assert len(task_claims) > 0, "Expected at least one task claim"
    claim_id = task_claims[0]["id"]

    # First approval
    approve1 = client.patch(f"/api/v1/reviews/{claim_id}/approve?actor=ProjectLead")
    assert approve1.status_code == status.HTTP_200_OK
    assert approve1.json()["status"] == "approved"

    # Verify 1 task created
    tasks_after_1 = client.get(f"/api/v1/projects/{project_id}/tasks").json()
    assert len(tasks_after_1) == 1
    task_id = tasks_after_1[0]["id"]

    # Check activity count
    acts_after_1 = client.get(f"/api/v1/activities?project_id={project_id}").json()
    act_count_1 = len(acts_after_1)

    # Second approval attempt on the already-approved claim
    approve2 = client.patch(f"/api/v1/reviews/{claim_id}/approve?actor=ProjectLead")
    assert approve2.status_code == status.HTTP_200_OK
    assert approve2.json()["status"] == "approved"

    # Verify STILL exactly 1 task exists (no duplicate created)
    tasks_after_2 = client.get(f"/api/v1/projects/{project_id}/tasks").json()
    assert len(tasks_after_2) == 1
    assert tasks_after_2[0]["id"] == task_id

    # Verify activity events count is unchanged (no duplicate activity)
    acts_after_2 = client.get(f"/api/v1/activities?project_id={project_id}").json()
    assert len(acts_after_2) == act_count_1


def test_approve_all_atomic_rollback_on_failure(client, db_session, monkeypatch):
    """
    Regression test: Security Audit Fix 2.
    Verify that ReviewService.approve_all() executes atomically:
    if any item in the batch fails, the entire transaction rolls back
    and NO claims remain in 'approved' status.
    """
    from uuid import UUID
    from app.models.activity import Activity
    from app.models.decision import Decision
    from app.models.extracted_knowledge import ExtractedKnowledge, VerificationStatus
    from app.models.task import Task
    from app.services.review_service import ReviewService

    project_id = _create_project(client, "Atomic Rollback Project")
    pdf_bytes = _create_sample_pdf()

    files = {"file": ("atomic_spec.pdf", pdf_bytes, "application/pdf")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == status.HTTP_201_CREATED

    proj_uuid = UUID(project_id)
    pending_before = (
        db_session.query(ExtractedKnowledge)
        .filter(
            ExtractedKnowledge.project_id == proj_uuid,
            ExtractedKnowledge.status == VerificationStatus.PENDING,
        )
        .all()
    )
    assert len(pending_before) >= 3, "Expected at least 3 pending claims"

    # Original promote method
    original_promote = ReviewService._promote_and_approve_claim
    call_count = [0]

    def faulty_promote(db, claim, actor="Reviewer"):
        call_count[0] += 1
        if call_count[0] >= 2:
            raise RuntimeError("Simulated failure during batch item processing")
        original_promote(db, claim, actor)

    monkeypatch.setattr(ReviewService, "_promote_and_approve_claim", faulty_promote)

    # Call approve_all which must fail and rollback
    with pytest.raises(RuntimeError, match="Simulated failure"):
        ReviewService.approve_all(db=db_session, project_id=proj_uuid)

    # Verify atomic rollback in database:
    db_session.expire_all()
    claims_after = (
        db_session.query(ExtractedKnowledge)
        .filter(ExtractedKnowledge.project_id == proj_uuid)
        .all()
    )
    # ALL claims must still be PENDING (none committed as APPROVED)
    for c in claims_after:
        assert c.status == VerificationStatus.PENDING, f"Claim {c.id} should have rolled back to pending"

    # Zero decisions committed
    decs = db_session.query(Decision).filter(Decision.project_id == proj_uuid).all()
    assert len(decs) == 0

    # Zero tasks committed
    tasks = db_session.query(Task).filter(Task.project_id == proj_uuid).all()
    assert len(tasks) == 0

    # Zero claim_approved activities committed
    acts = (
        db_session.query(Activity)
        .filter(Activity.project_id == proj_uuid, Activity.event_type == "claim_approved")
        .all()
    )
    assert len(acts) == 0


def test_gemini_request_uses_header_and_omits_key_from_url(monkeypatch):
    """
    Regression test: Security Audit Fix 4.
    Verify that Gemini requests send the API key via 'x-goog-api-key' header
    and strictly omit the key from the request URL.
    """
    import json
    import httpx
    from app.services.ai_service import AIKnowledgeService
    from app.services.extraction_service import TextChunk

    fake_api_key = "fake_gemini_test_token_xyz98765"
    captured_requests = []

    def mock_post(self, url, *args, **kwargs):
        captured_requests.append({"url": str(url), "headers": kwargs.get("headers", {})})
        mock_response_data = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps(
                                    {
                                        "claims": [
                                            {
                                                "category": "decision",
                                                "title": "Adopt Event Sourcing",
                                                "content": "We decided to adopt event sourcing for auditability.",
                                                "evidence_snippet": "Adopt event sourcing for auditability.",
                                                "source_reference": "Page 1",
                                                "page_number": 1,
                                                "confidence": 0.95,
                                                "owner": "Marcus Vance",
                                                "impact_scope": "Core Architecture",
                                            }
                                        ]
                                    }
                                )
                            }
                        ]
                    }
                }
            ]
        }
        return httpx.Response(200, json=mock_response_data)

    monkeypatch.setattr(httpx.Client, "post", mock_post)

    chunks = [
        TextChunk(
            text="Decision: We decided to adopt event sourcing.",
            source_reference="Page 1",
            page_number=1,
        )
    ]
    result = AIKnowledgeService._call_gemini_extraction(chunks, api_key=fake_api_key)

    assert result is not None
    assert len(result.claims) == 1
    assert result.claims[0].title == "Adopt Event Sourcing"

    # Verify request payload
    assert len(captured_requests) == 1
    req = captured_requests[0]

    # 1. Verify URL does NOT contain the API key
    assert fake_api_key not in req["url"]
    assert "key=" not in req["url"]
    assert (
        req["url"]
        == "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    )

    # 2. Verify header contains x-goog-api-key
    assert "x-goog-api-key" in req["headers"]
    assert req["headers"]["x-goog-api-key"] == fake_api_key
    assert req["headers"]["Content-Type"] == "application/json"


def test_gemini_exception_logging_sanitizes_credentials(monkeypatch, caplog):
    """
    Regression test: Security Audit Fix 4.
    Verify that if an exception containing an API key or bearer token occurs,
    the credentials are redacted before writing to application logs.
    """
    import logging
    import httpx
    from app.core.config import settings
    from app.services.ai_service import AIKnowledgeService
    from app.services.extraction_service import TextChunk

    fake_key = "sensitive_gemini_key_12345"
    fake_bearer = "Bearer sensitive_token_abcde"
    monkeypatch.setattr(settings, "GEMINI_API_KEY", fake_key)

    def faulty_post(self, url, *args, **kwargs):
        raise httpx.RequestError(
            f"Failed to connect to https://generativelanguage.googleapis.com?key={fake_key} with {fake_bearer}"
        )

    monkeypatch.setattr(httpx.Client, "post", faulty_post)

    chunks = [
        TextChunk(
            text="Decision: We decided to use React for frontend.",
            source_reference="Page 1",
            page_number=1,
        )
    ]

    with caplog.at_level(logging.WARNING):
        result = AIKnowledgeService.extract_knowledge(chunks)

    # Fallback to semantic rules succeeded
    assert result is not None
    assert len(result.claims) >= 1

    # Verify log output does NOT contain the raw credentials
    assert fake_key not in caplog.text, "Sensitive Gemini API key must not appear in logs"
    assert "sensitive_token_abcde" not in caplog.text, "Sensitive Bearer token must not appear in logs"
    assert "[REDACTED]" in caplog.text, "Redaction marker must appear in sanitized log message"


def test_missing_api_keys_safe_fallback(monkeypatch):
    """
    Regression test: Security Audit Fix 4.
    Verify that when no API keys are configured, extraction falls back smoothly
    to deterministic semantic rules without network calls or errors.
    """
    from app.core.config import settings
    from app.services.ai_service import AIKnowledgeService
    from app.services.extraction_service import TextChunk

    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)

    chunks = [
        TextChunk(
            text="Task: Configure Alembic migrations. Assigned to Marcus Vance.",
            source_reference="Page 2",
            page_number=2,
        )
    ]

    result = AIKnowledgeService.extract_knowledge(chunks)
    assert result is not None
    assert len(result.claims) >= 1
    assert result.claims[0].category.value == "task"
    assert "alembic" in result.claims[0].title.lower()


def test_invalid_pdf_renamed_rejected_no_db_record(client, db_session):
    """
    Regression test: Security Audit Fix 5.
    Verify that a file with a .pdf extension lacking %PDF- signature is rejected
    and leaves NO record in the database.
    """
    from app.models.document import Document

    project_id = _create_project(client, "Signature PDF Project")
    fake_exe = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00BinaryPayload"

    files = {"file": ("malicious_payload.pdf", fake_exe, "application/pdf")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "%pdf-" in res.json()["detail"].lower() or "signature" in res.json()["detail"].lower()

    # Verify no persistent record left in DB
    db_session.expire_all()
    docs = db_session.query(Document).filter(Document.filename == "malicious_payload.pdf").all()
    assert len(docs) == 0


def test_invalid_zip_renamed_with_docx_rejected_no_db_record(client, db_session):
    """
    Regression test: Security Audit Fix 5.
    Verify that a file with a .docx extension lacking PK\\x03\\x04 signature is rejected
    and leaves NO record in the database.
    """
    from app.models.document import Document

    project_id = _create_project(client, "Signature DOCX Project")
    plain_text = b"This is just plain text content with no ZIP header."

    files = {
        "file": (
            "plain_text.docx",
            plain_text,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "zip" in res.json()["detail"].lower() or "signature" in res.json()["detail"].lower()

    # Verify no persistent record left in DB
    db_session.expire_all()
    docs = db_session.query(Document).filter(Document.filename == "plain_text.docx").all()
    assert len(docs) == 0


def test_zip_missing_required_docx_entries_rejected_no_db_record(client, db_session):
    """
    Regression test: Security Audit Fix 5.
    Verify that a valid ZIP file missing required DOCX entries ([Content_Types].xml, word/document.xml)
    is rejected and leaves NO record in the database.
    """
    import zipfile
    from app.models.document import Document

    project_id = _create_project(client, "Missing Entries DOCX Project")

    # Construct an arbitrary ZIP missing DOCX structure
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w") as zf:
        zf.writestr("notes.txt", "Some random notes.")
        zf.writestr("config.json", '{"key": "value"}')
    fake_zip_bytes = bio.getvalue()

    files = {
        "file": (
            "fake_archive.docx",
            fake_zip_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert (
        "missing required document entries" in res.json()["detail"].lower()
        or "invalid docx" in res.json()["detail"].lower()
    )

    # Verify no persistent record left in DB
    db_session.expire_all()
    docs = db_session.query(Document).filter(Document.filename == "fake_archive.docx").all()
    assert len(docs) == 0


def test_malformed_corrupt_docx_archive_rejected(client, db_session):
    """
    Regression test: Security Audit Fix 5.
    Verify that a corrupted DOCX file (starts with PK\\x03\\x04 but truncated/corrupt)
    is rejected cleanly and leaves NO record in the database.
    """
    from app.models.document import Document

    project_id = _create_project(client, "Corrupt DOCX Project")
    corrupt_zip = b"PK\x03\x04\x14\x00\x00\x00\x08\x00CorruptZipStreamTruncated"

    files = {
        "file": (
            "corrupt.docx",
            corrupt_zip,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "corrupt" in res.json()["detail"].lower() or "invalid" in res.json()["detail"].lower()

    # Verify no persistent record left in DB
    db_session.expire_all()
    docs = db_session.query(Document).filter(Document.filename == "corrupt.docx").all()
    assert len(docs) == 0


def test_file_size_limit_enforced_no_db_record(client, db_session, monkeypatch):
    """
    Regression test: Security Audit Fix 5.
    Verify that an oversized file (> MAX_UPLOAD_SIZE_BYTES) is rejected with 413
    and leaves NO record in the database.
    """
    from app.core.config import settings
    from app.models.document import Document

    project_id = _create_project(client, "Oversized Project")
    pdf_bytes = _create_sample_pdf()

    # Restrict limit to smaller than sample PDF
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_BYTES", 200)

    files = {"file": ("oversized.pdf", pdf_bytes, "application/pdf")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    assert "exceeds maximum allowed size" in res.json()["detail"].lower()

    # Verify no persistent record left in DB
    db_session.expire_all()
    docs = db_session.query(Document).filter(Document.filename == "oversized.pdf").all()
    assert len(docs) == 0


def test_review_update_oversized_title_or_content_fails(client, db_session):
    """
    Regression test: Security Audit Fix 6.
    Verify review updates with title > 255 chars or content > 10,000 chars return 422.
    """
    from app.models.extracted_knowledge import ExtractedKnowledge, KnowledgeCategory, VerificationStatus
    import uuid

    project_id = _create_project(client, "Review Fix 6 Project")
    pdf_bytes = _create_sample_pdf()
    files = {"file": ("claim_fix6.pdf", pdf_bytes, "application/pdf")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == status.HTTP_201_CREATED
    doc_id = res.json()["id"]

    claim = ExtractedKnowledge(
        id=uuid.uuid4(),
        document_id=uuid.UUID(doc_id),
        project_id=uuid.UUID(project_id),
        category=KnowledgeCategory.TASK,
        title="Valid Initial Claim Title",
        content="Valid content",
        status=VerificationStatus.PENDING,
        confidence=0.9,
    )
    db_session.add(claim)
    db_session.commit()

    # Title exceeding 255 chars
    res_oversized_title = client.patch(
        f"/api/v1/reviews/{claim.id}",
        json={"title": "T" * 256},
    )
    assert res_oversized_title.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Content exceeding 10,000 chars
    res_oversized_content = client.patch(
        f"/api/v1/reviews/{claim.id}",
        json={"content": "C" * 10001},
    )
    assert res_oversized_content.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_upload_document_oversized_filename_or_author_fails(client):
    """
    Regression test: Security Audit Fix 6.
    Verify document upload with filename > 255 chars or author > 120 chars returns 422.
    """
    project_id = _create_project(client, "Upload Input Limit Project")
    pdf_bytes = _create_sample_pdf()

    # Oversized filename
    huge_filename = ("a" * 256) + ".pdf"
    files = {"file": (huge_filename, pdf_bytes, "application/pdf")}
    data = {"project_id": project_id}
    res_filename = client.post("/api/v1/documents/upload", files=files, data=data)
    assert res_filename.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Oversized author
    normal_files = {"file": ("author_limit.pdf", pdf_bytes, "application/pdf")}
    data_huge_author = {"project_id": project_id, "author": "X" * 121}
    res_author = client.post("/api/v1/documents/upload", files=normal_files, data=data_huge_author)
    assert res_author.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_pdf_extraction_exception_does_not_leak_local_path(client, monkeypatch, caplog):
    """
    Regression test: Security Audit Fix 7.
    Simulate PDF extraction raising an internal exception containing a local filesystem path.
    Verify response returns safe message without leaking the internal path.
    """
    import logging
    from app.models.document import Document, DocumentStatus

    project_id = _create_project(client, "PDF Error Project")
    pdf_bytes = _create_sample_pdf()

    leak_path = "C:\\Users\\InternalAdmin\\AppData\\Local\\Temp\\confidential_leak.pdf"

    def mock_open(*args, **kwargs):
        raise RuntimeError(f"MuPDF failed opening {leak_path}: corrupt stream header")

    monkeypatch.setattr("app.services.extraction_service.pymupdf.open", mock_open)

    with caplog.at_level(logging.ERROR):
        files = {"file": ("corrupt_internal.pdf", pdf_bytes, "application/pdf")}
        data = {"project_id": project_id}
        res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_400_BAD_REQUEST
    detail = res.json()["detail"]

    # Verify no local path in user-facing API response
    assert leak_path not in detail
    assert "InternalAdmin" not in detail
    assert "Failed to parse PDF document" in detail

    # Verify server-side log contains diagnostic info but no document binary content
    log_text = caplog.text
    assert "PDF extraction failed" in log_text or "Document processing failed" in log_text
    assert str(pdf_bytes) not in log_text


def test_docx_extraction_exception_does_not_leak_sensitive_path(client, monkeypatch):
    """
    Regression test: Security Audit Fix 7.
    Simulate DOCX extraction raising an internal exception containing a sensitive path.
    Verify response returns safe message without leaking internal path.
    """
    from app.models.document import Document, DocumentStatus

    project_id = _create_project(client, "DOCX Error Project")
    docx_bytes = _create_sample_docx()

    secret_docx_path = "/var/secrets/internal/confidential_report.docx"

    def mock_docx_init(*args, **kwargs):
        raise Exception(f"Failed to read package at {secret_docx_path}: bad CRC-32")

    monkeypatch.setattr("app.services.extraction_service.docx.Document", mock_docx_init)

    files = {"file": ("corrupt_internal.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_400_BAD_REQUEST
    detail = res.json()["detail"]

    # Verify no sensitive path in response
    assert secret_docx_path not in detail
    assert "var/secrets" not in detail
    assert "Failed to parse DOCX document" in detail


def test_ai_provider_exception_does_not_leak_api_credentials(client, monkeypatch, caplog):
    """
    Regression test: Security Audit Fix 7.
    Simulate AI provider raising an exception with fake API keys and bearer tokens.
    Verify response returns HTTP 500 with safe generic message, and credentials are redacted in logs.
    """
    import logging
    from app.models.document import Document, DocumentStatus
    from app.services.ai_service import AIKnowledgeService

    project_id = _create_project(client, "AI Error Project")
    pdf_bytes = _create_sample_pdf()

    fake_api_key = "AIzaSyFakeSecretToken123456789"
    fake_bearer = "sk-fake-bearer-token-abcxyz"

    def mock_ai_extract(*args, **kwargs):
        raise RuntimeError(
            f"Failed to connect to Gemini at https://generativelanguage.googleapis.com/v1beta?key={fake_api_key} "
            f"with Authorization: Bearer {fake_bearer}"
        )

    monkeypatch.setattr(AIKnowledgeService, "extract_knowledge", mock_ai_extract)

    with caplog.at_level(logging.ERROR):
        files = {"file": ("ai_leak_test.pdf", pdf_bytes, "application/pdf")}
        data = {"project_id": project_id}
        res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    detail = res.json()["detail"]

    # Verify credentials never leaked in API response
    assert fake_api_key not in detail
    assert fake_bearer not in detail
    assert detail == "AI knowledge extraction failed."

    # Verify credentials are redacted in logs
    log_text = caplog.text
    assert fake_api_key not in log_text
    assert fake_bearer not in log_text
    assert "[REDACTED]" in log_text


def test_database_error_during_processing_does_not_leak_connection_string(client, monkeypatch, db_session):
    """
    Regression test: Security Audit Fix 7.
    Simulate database error with database connection string credentials.
    Verify response returns safe database message without leaking credentials.
    """
    from app.models.document import Document, DocumentStatus
    from app.services.ai_service import AIKnowledgeService

    project_id = _create_project(client, "DB Error Project")
    pdf_bytes = _create_sample_pdf()

    secret_db_pass = "super_secret_db_pass_999"

    def mock_ai_with_db_error(*args, **kwargs):
        from sqlalchemy.exc import OperationalError
        raise OperationalError(
            f"could not connect to server: Connection refused (postgresql://dbuser:{secret_db_pass}@127.0.0.1:5432/threadline)",
            params={},
            orig=Exception("Connection refused"),
        )

    monkeypatch.setattr(AIKnowledgeService, "extract_knowledge", mock_ai_with_db_error)

    files = {"file": ("db_leak_test.pdf", pdf_bytes, "application/pdf")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    detail = res.json()["detail"]

    # Verify no database credentials leaked in API response
    assert secret_db_pass not in detail
    assert "postgresql://" not in detail
    assert detail == "Database error occurred while processing document."


def test_failed_processing_leaves_document_in_recoverable_state(client, monkeypatch, db_session):
    """
    Regression test: Security Audit Fix 7.
    Verify that failed document processing (e.g. transient AI error):
    1. Does NOT delete the document from the database.
    2. Leaves document in a consistent ERROR state with safe error message.
    3. Preserves raw_content so the user can reprocess the document once provider is restored.
    4. Reprocessing succeeds cleanly.
    """
    from app.models.document import Document, DocumentStatus
    from app.services.ai_service import AIKnowledgeService

    project_id = _create_project(client, "Recoverable Doc Project")
    pdf_bytes = _create_sample_pdf()

    # 1. Simulate temporary extraction error
    def mock_temporary_failure(*args, **kwargs):
        raise RuntimeError("Transient LLM quota rate limit exceeded")

    monkeypatch.setattr(AIKnowledgeService, "extract_knowledge", mock_temporary_failure)

    files = {"file": ("recoverable_doc.pdf", pdf_bytes, "application/pdf")}
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert res.json()["detail"] == "AI knowledge extraction failed."

    # 2. Verify document exists in DB with ERROR status and non-empty raw_content
    db_session.expire_all()
    doc = db_session.query(Document).filter(Document.filename == "recoverable_doc.pdf").first()
    assert doc is not None, "Failed document must NOT be silently deleted"
    assert doc.status == DocumentStatus.ERROR
    assert doc.error_message == "AI knowledge extraction failed."
    assert doc.raw_content == pdf_bytes

    # 3. Restore normal AI extraction and trigger reprocessing
    monkeypatch.undo()

    reprocess_res = client.post(f"/api/v1/documents/{doc.id}/process")
    assert reprocess_res.status_code == status.HTTP_200_OK
    reprocess_data = reprocess_res.json()

    assert reprocess_data["status"] == "extracted"
    assert reprocess_data["error_message"] is None
    assert reprocess_data["extracted_claims_count"] > 0


def test_docx_too_many_entries_rejected_no_db_record(client, db_session):
    """
    Regression test: Security Audit Fix - DOCX ZIP-Bomb Protection.
    Verify that an archive with > MAX_DOCX_ENTRIES entries is rejected with HTTP 400
    and creates NO record in the database.
    """
    import zipfile
    from app.models.document import Document

    project_id = _create_project(client, "Too Many Entries DOCX Project")

    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr("word/document.xml", "<w:document/>")
        for i in range(1005):
            zf.writestr(f"entry_{i}.xml", "<item/>")
    bomb_bytes = bio.getvalue()

    files = {
        "file": (
            "entry_bomb.docx",
            bomb_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "too many entries" in res.json()["detail"].lower()

    db_session.expire_all()
    docs = db_session.query(Document).filter(Document.filename == "entry_bomb.docx").all()
    assert len(docs) == 0


def test_docx_total_uncompressed_size_exceeded_rejected_no_db_record(client, db_session, monkeypatch):
    """
    Regression test: Security Audit Fix - DOCX ZIP-Bomb Protection.
    Verify that an archive whose total uncompressed content exceeds safety limits
    is rejected with HTTP 400 and creates NO record in the database.
    """
    import zipfile
    from app.core.config import settings
    from app.models.document import Document

    project_id = _create_project(client, "Total Uncompressed Size DOCX Project")
    monkeypatch.setattr(settings, "MAX_DOCX_TOTAL_UNCOMPRESSED_BYTES", 200 * 1024)

    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w", compression=zipfile.ZIP_STORED) as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr("word/document.xml", "<w:document/>")
        # Write two distinct stored blocks totaling 250KB uncompressed, ratio 1.0 (no ratio trigger)
        zf.writestr("word/part1.xml", b"A" * (125 * 1024))
        zf.writestr("word/part2.xml", b"B" * (125 * 1024))
    oversized_bytes = bio.getvalue()

    files = {
        "file": (
            "total_size_bomb.docx",
            oversized_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "total uncompressed" in res.json()["detail"].lower() or "safety limit" in res.json()["detail"].lower()

    db_session.expire_all()
    docs = db_session.query(Document).filter(Document.filename == "total_size_bomb.docx").all()
    assert len(docs) == 0


def test_docx_single_file_size_exceeded_rejected_no_db_record(client, db_session, monkeypatch):
    """
    Regression test: Security Audit Fix - DOCX ZIP-Bomb Protection.
    Verify that an archive with an individual uncompressed file exceeding the size limit
    is rejected with HTTP 400 and creates NO record in the database.
    """
    import zipfile
    from app.core.config import settings
    from app.models.document import Document

    project_id = _create_project(client, "Single File Size DOCX Project")
    monkeypatch.setattr(settings, "MAX_DOCX_SINGLE_FILE_BYTES", 150 * 1024)

    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w", compression=zipfile.ZIP_STORED) as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr("word/document.xml", "<w:document/>")
        # Write single stored file 200KB uncompressed, ratio 1.0 (no ratio trigger)
        zf.writestr("word/large_part.xml", b"C" * (200 * 1024))
    oversized_bytes = bio.getvalue()

    files = {
        "file": (
            "single_file_bomb.docx",
            oversized_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "individual file" in res.json()["detail"].lower() or "exceeds size limit" in res.json()["detail"].lower()

    db_session.expire_all()
    docs = db_session.query(Document).filter(Document.filename == "single_file_bomb.docx").all()
    assert len(docs) == 0


def test_docx_excessive_compression_ratio_rejected_no_db_record(client, db_session):
    """
    Regression test: Security Audit Fix - DOCX ZIP-Bomb Protection.
    Verify that an archive with suspicious compression ratio (> 100:1, classic decompression bomb)
    is rejected with HTTP 400 and creates NO record in the database.
    """
    import zipfile
    from app.models.document import Document

    project_id = _create_project(client, "Decompression Bomb DOCX Project")

    # 500 KB of zeros compresses to ~500 bytes (ratio ~1000:1)
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr("word/document.xml", "<w:document/>")
        zf.writestr("word/zero_bomb.xml", b"\x00" * (500 * 1024))
    bomb_bytes = bio.getvalue()

    files = {
        "file": (
            "ratio_bomb.docx",
            bomb_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "compression ratio" in res.json()["detail"].lower() or "decompression bomb" in res.json()["detail"].lower()

    db_session.expire_all()
    docs = db_session.query(Document).filter(Document.filename == "ratio_bomb.docx").all()
    assert len(docs) == 0


def test_docx_encrypted_archive_rejected_no_db_record(client, db_session):
    """
    Regression test: Security Audit Fix - DOCX ZIP-Bomb Protection.
    Verify that an archive with encrypted/password-protected entries is rejected with HTTP 400
    and creates NO record in the database.
    """
    import zipfile
    from app.models.document import Document

    project_id = _create_project(client, "Encrypted DOCX Project")

    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr("word/document.xml", "<w:document/>")
        zf.writestr("word/secret.xml", b"encrypted password-protected content")

    raw_zip = bytearray(bio.getvalue())
    # Set the PKZIP encryption bit (bit 0 of general purpose bit flag) in the central directory header for word/secret.xml
    cd_sig = b"PK\x01\x02"
    idx = 0
    while True:
        cd_pos = raw_zip.find(cd_sig, idx)
        if cd_pos == -1:
            break
        fn_len = int.from_bytes(raw_zip[cd_pos + 28 : cd_pos + 30], "little")
        fn = raw_zip[cd_pos + 46 : cd_pos + 46 + fn_len].decode("utf-8", errors="ignore")
        if fn == "word/secret.xml":
            raw_zip[cd_pos + 8] |= 0x01
        idx = cd_pos + 4

    encrypted_bytes = bytes(raw_zip)

    files = {
        "file": (
            "encrypted.docx",
            encrypted_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    data = {"project_id": project_id}
    res = client.post("/api/v1/documents/upload", files=files, data=data)

    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "encrypted" in res.json()["detail"].lower()

    db_session.expire_all()
    docs = db_session.query(Document).filter(Document.filename == "encrypted.docx").all()
    assert len(docs) == 0





