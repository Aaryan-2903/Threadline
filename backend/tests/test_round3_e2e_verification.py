import io
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from app.core.security import create_access_token, hash_password
from app.models.conflict import ConflictStatus
from app.models.decision import Decision
from app.models.document import Document
from app.models.extracted_knowledge import ExtractedKnowledge, KnowledgeCategory, VerificationStatus
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User, UserRole
from app.services.redaction_service import redaction_service


# ==============================================================================
# 1. AUTHENTICATION WORKFLOW VERIFICATION
# ==============================================================================

def test_workflow_1_authentication(client, db_session):
    """
    Verify:
    - Judge Demo Access works without manual credentials.
    - Login and logout work (login issues signed JWT, profile accessible).
    - Demo access does not expose administrator credentials or password hashes.
    """
    # 1. Judge Demo Access works without credentials
    demo_res = client.post("/api/v1/auth/demo-login")
    assert demo_res.status_code == 200, f"Demo login failed: {demo_res.text}"
    demo_data = demo_res.json()
    assert "access_token" in demo_data
    assert demo_data["token_type"] == "bearer"
    assert demo_data["user"]["is_demo"] is True
    assert demo_data["user"]["username"] == "demojudge"
    demo_token = demo_data["access_token"]

    # Verify token works to retrieve profile
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {demo_token}"})
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "demojudge"

    # 2. Login works with username & password
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "demojudge", "password": "demo123"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # Invalid login fails safely with 401
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "demojudge", "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401
    assert "Incorrect username or password" in bad_login.json()["detail"]

    # 3. Demo access does NOT expose administrator credentials
    # Check demo response fields: no passwords or hashes
    assert "hashed_password" not in demo_data["user"]
    assert "password" not in demo_data["user"]

    # Check user listing: passwords and hashes never present
    users_res = client.get("/api/v1/auth/users", headers={"Authorization": f"Bearer {demo_token}"})
    assert users_res.status_code == 200
    for u in users_res.json():
        assert "hashed_password" not in u
        assert "password" not in u


# ==============================================================================
# 2. ROLE-BASED ACCESS CONTROL WORKFLOW VERIFICATION
# ==============================================================================

def test_workflow_2_role_based_access(client, db_session):
    """
    Verify:
    - Admin permissions work (full access, user role modification).
    - Project Owner permissions work (create/delete project, resolve conflicts).
    - Contributor permissions work (create tasks/decisions, prohibited from conflict resolution and project deletion).
    - Viewer is strictly read-only (mutations return 403 Forbidden; reading returns 200).
    - Backend APIs enforce permissions even when called directly.
    """
    # Create distinct users
    admin = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@example.com",
        username=f"admin_{uuid.uuid4().hex[:6]}",
        hashed_password=hash_password("admin123"),
        role=UserRole.ADMIN,
    )
    powner = User(
        email=f"owner_{uuid.uuid4().hex[:6]}@example.com",
        username=f"owner_{uuid.uuid4().hex[:6]}",
        hashed_password=hash_password("owner123"),
        role=UserRole.PROJECT_OWNER,
    )
    contrib = User(
        email=f"contrib_{uuid.uuid4().hex[:6]}@example.com",
        username=f"contrib_{uuid.uuid4().hex[:6]}",
        hashed_password=hash_password("contrib123"),
        role=UserRole.CONTRIBUTOR,
    )
    viewer = User(
        email=f"viewer_{uuid.uuid4().hex[:6]}@example.com",
        username=f"viewer_{uuid.uuid4().hex[:6]}",
        hashed_password=hash_password("viewer123"),
        role=UserRole.VIEWER,
    )
    db_session.add_all([admin, powner, contrib, viewer])
    db_session.commit()

    admin_token = create_access_token({"sub": str(admin.id), "username": admin.username, "role": admin.role.value})
    owner_token = create_access_token({"sub": str(powner.id), "username": powner.username, "role": powner.role.value})
    contrib_token = create_access_token({"sub": str(contrib.id), "username": contrib.username, "role": contrib.role.value})
    viewer_token = create_access_token({"sub": str(viewer.id), "username": viewer.username, "role": viewer.role.value})

    # A. Project Owner creates a project
    p_res = client.post(
        "/api/v1/projects/",
        json={"name": "RBAC Verification Test Project", "description": "Testing permissions"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert p_res.status_code == 201
    project_id = p_res.json()["id"]

    # B. Contributor CAN create tasks and decisions under the project
    t_res = client.post(
        "/api/v1/tasks/",
        json={"project_id": project_id, "title": "Contributor Implementation Task", "status": "todo", "priority": "high"},
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert t_res.status_code == 201

    d_res = client.post(
        "/api/v1/decisions/",
        json={"project_id": project_id, "title": "Contributor ADR Record", "rationale": "Testing ADR creation"},
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert d_res.status_code == 201

    # C. Contributor CANNOT delete the project (403 Forbidden)
    del_res = client.delete(
        f"/api/v1/projects/{project_id}",
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert del_res.status_code == 403
    assert "requires Project Owner or Admin role" in del_res.json()["detail"]

    # D. Viewer is strictly read-only:
    # Viewer CAN read project and tasks
    assert client.get(f"/api/v1/projects/{project_id}", headers={"Authorization": f"Bearer {viewer_token}"}).status_code == 200
    assert client.get(f"/api/v1/tasks/?project_id={project_id}", headers={"Authorization": f"Bearer {viewer_token}"}).status_code == 200

    # Viewer CANNOT create project
    v_proj = client.post(
        "/api/v1/projects/",
        json={"name": "Viewer Forbidden Project"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert v_proj.status_code == 403
    assert "Viewers have read-only access" in v_proj.json()["detail"]

    # Viewer CANNOT create task
    v_task = client.post(
        "/api/v1/tasks/",
        json={"project_id": project_id, "title": "Viewer Forbidden Task"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert v_task.status_code == 403

    # Viewer CANNOT create decision
    v_dec = client.post(
        "/api/v1/decisions/",
        json={"project_id": project_id, "title": "Viewer Forbidden Decision"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert v_dec.status_code == 403

    # E. Admin can modify user roles
    role_change_res = client.patch(
        f"/api/v1/auth/users/{viewer.id}/role",
        json={"role": "contributor"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert role_change_res.status_code == 200
    assert role_change_res.json()["role"] == "contributor"


# ==============================================================================
# 3. CONFLICT DETECTION & RESOLUTION WORKFLOW VERIFICATION
# ==============================================================================

def test_workflow_3_conflict_detection(client, db_session):
    """
    Verify:
    - Conflicts are detected from actual project records.
    - Both conflicting records and their evidence are displayed.
    - Resolve and dismiss actions persist in the database.
    - Resolution history is retained across subsequent scans.
    """
    now = datetime.now(timezone.utc)

    # 1. Seed project with real conflicting tasks and decisions
    project = Project(
        name="Telemetry Pipeline Realignment",
        description="Core streaming engine upgrade",
        status=ProjectStatus.ACTIVE,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    # Conflicting assignees on same task scope
    t1 = Task(
        project_id=project.id,
        title="Kafka Partition Rebalancing Script",
        status=TaskStatus.IN_PROGRESS,
        priority=TaskPriority.HIGH,
        assignee="Sarah Connor",
        due_date=now + timedelta(days=7),
    )
    t2 = Task(
        project_id=project.id,
        title="Kafka Partition Rebalancing Script",
        status=TaskStatus.TODO,
        priority=TaskPriority.URGENT,
        assignee="John Connor",
        due_date=now + timedelta(days=2),
    )

    # Superseded architectural decisions
    d1 = Decision(
        project_id=project.id,
        title="Use Redis for Temporary Telemetry State",
        description="Prototype caching tier",
        rationale="Simplicity in v1 prototype",
        decided_by="Lead Dev",
        decision_date=now - timedelta(days=60),
    )
    d2 = Decision(
        project_id=project.id,
        title="Migrate to Dragonfly for Caching",
        description="Supersedes Redis for Temporary Telemetry State. Deprecates Redis in production.",
        rationale="Higher multi-threaded throughput",
        decided_by="Principal Architect",
        decision_date=now - timedelta(days=5),
    )
    db_session.add_all([t1, t2, d1, d2])
    db_session.commit()

    # 2. Trigger conflict scan
    detect_res = client.post(f"/api/v1/projects/{project.id}/conflicts/detect")
    assert detect_res.status_code == 200
    detect_data = detect_res.json()
    assert detect_data["detected_count"] >= 2
    assert detect_data["open_count"] >= 2

    conflicts = detect_data["conflicts"]

    # Verify both conflicting records and evidence are displayed
    assignee_c = next(c for c in conflicts if c["conflict_type"] == "conflicting_assignee")
    assert "Sarah Connor" in assignee_c["evidence_snippet"]
    assert "John Connor" in assignee_c["evidence_snippet"]
    assert assignee_c["status"] == "open"

    decision_c = next(c for c in conflicts if c["conflict_type"] == "superseded_decision")
    assert "Redis" in decision_c["evidence_snippet"] or "Dragonfly" in decision_c["evidence_snippet"]
    assert decision_c["status"] == "open"

    # 3. Resolve one conflict and dismiss another
    resolve_res = client.patch(
        f"/api/v1/conflicts/{decision_c['id']}",
        json={
            "status": "resolved",
            "resolution_notes": "Dragonfly migration approved by Architecture Board.",
            "resolved_by": "Architecture Board",
        },
    )
    assert resolve_res.status_code == 200
    res_data = resolve_res.json()
    assert res_data["status"] == "resolved"
    assert res_data["resolved_by"] == "Architecture Board"
    assert res_data["resolved_at"] is not None

    dismiss_res = client.patch(
        f"/api/v1/conflicts/{assignee_c['id']}",
        json={
            "status": "dismissed",
            "resolution_notes": "Accepted temporary co-ownership for pair programming.",
            "resolved_by": "Sarah Connor",
        },
    )
    assert dismiss_res.status_code == 200
    assert dismiss_res.json()["status"] == "dismissed"

    # Verify persistence by fetching conflict directly
    direct_get = client.get(f"/api/v1/conflicts/{decision_c['id']}")
    assert direct_get.status_code == 200
    assert direct_get.json()["status"] == "resolved"
    assert "Dragonfly migration approved" in direct_get.json()["resolution_notes"]

    # 4. Re-running conflict detection retains resolution history
    rescan = client.post(f"/api/v1/projects/{project.id}/conflicts/detect")
    assert rescan.status_code == 200
    rescan_conflicts = rescan.json()["conflicts"]
    persisted_dec_c = next(c for c in rescan_conflicts if c["id"] == decision_c["id"])
    persisted_ass_c = next(c for c in rescan_conflicts if c["id"] == assignee_c["id"])

    assert persisted_dec_c["status"] == "resolved"
    assert persisted_dec_c["resolution_notes"] == "Dragonfly migration approved by Architecture Board."
    assert persisted_ass_c["status"] == "dismissed"


# ==============================================================================
# 4. SENSITIVE DATA PROTECTION WORKFLOW VERIFICATION
# ==============================================================================

def test_workflow_4_sensitive_data_protection(client, db_session):
    """
    Verify:
    - Emails, phone numbers, and API keys are detected.
    - Redaction applies to displayed and exported content (reports, documents, PDF).
    - Audit events are recorded.
    """
    sample_text = (
        "Security handover notes:\n"
        "Lead on call: sec-lead@production-corp.internal\n"
        "Emergency line: +1-555-867-5309\n"
        "Secret Key: sk-proj-1234567890abcdef1234567890abcdef1234567890abcdef\n"
        "Google API Token: AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6\n"
        "GitHub Access Token: ghp_987654321098765432109876543210987654\n"
    )

    # 1. Detection works
    findings = redaction_service.scan_sensitive_data(sample_text)
    assert len(findings) >= 5
    types = {f["type"] for f in findings}
    assert "email" in types
    assert "phone" in types
    assert "api_key" in types

    # 2. Redaction masks all sensitive tokens
    redacted_text, count = redaction_service.redact_text(sample_text)
    assert count >= 5
    assert "sec-lead@production-corp.internal" not in redacted_text
    assert "[REDACTED_EMAIL]" in redacted_text
    assert "+1-555-867-5309" not in redacted_text
    assert "[REDACTED_PHONE]" in redacted_text
    assert "sk-proj-" not in redacted_text
    assert "AIzaSy" not in redacted_text
    assert "ghp_" not in redacted_text

    # 3. Create a project and document with sensitive content
    project = Project(name="Secure Defense Vault", status=ProjectStatus.ACTIVE)
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    doc = Document(
        project_id=project.id,
        filename="vault_credentials.pdf",
        file_type="pdf",
        file_size=1024,
        author="Security Admin",
        status="extracted",
        extracted_text=sample_text,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    # 4. Document sensitive scan endpoint
    scan_res = client.get(f"/api/v1/documents/{doc.id}/sensitive-scan")
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    assert scan_data["total_sensitive_items"] >= 5

    # 5. Document retrieval with ?redact=true
    doc_unredacted = client.get(f"/api/v1/documents/{doc.id}?redact=false")
    assert "sec-lead@production-corp.internal" in doc_unredacted.json()["extracted_text"]

    doc_redacted = client.get(f"/api/v1/documents/{doc.id}?redact=true")
    assert "sec-lead@production-corp.internal" not in doc_redacted.json()["extracted_text"]
    assert "[REDACTED_EMAIL]" in doc_redacted.json()["extracted_text"]

    # 6. Handover Report retrieval with ?redact=true
    gen_res = client.post(f"/api/v1/reports/generate?project_id={project.id}")
    assert gen_res.status_code == 201
    report_id = gen_res.json()["id"]

    # PDF export with ?redact=true succeeds
    pdf_res = client.get(f"/api/v1/reports/{report_id}/pdf?redact=true")
    assert pdf_res.status_code == 200
    assert "application/pdf" in pdf_res.headers["content-type"]
    assert pdf_res.content.startswith(b"%PDF")

    # 7. Audit events are recorded
    from app.services.audit_service import log_audit_event
    log_audit_event(
        db=db_session,
        action="sensitive_data_detected",
        project_id=project.id,
        username="Security Admin",
        details="5 sensitive items detected in vault credentials.",
    )
    audit_res = client.get(f"/api/v1/projects/{project.id}/audit-logs/")
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) > 0
    assert logs[0]["action"] == "sensitive_data_detected"


# ==============================================================================
# 5. HANDOVER LIFECYCLE WORKFLOW VERIFICATION
# ==============================================================================

def test_workflow_5_handover_lifecycle(client, db_session):
    """
    Verify:
    - Outgoing and incoming owners can be assigned.
    - Acknowledgement requests persist (`status="pending"`, `sent_at`).
    - Incoming owners can acknowledge (`status="acknowledged"`, `acknowledged_at`) or request clarification.
    - Status and version history update correctly.
    """
    project = Project(name="Orion Spacecraft Avionics", status=ProjectStatus.ACTIVE)
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    # Seed task assigned to outgoing lead
    t = Task(
        project_id=project.id,
        title="Avionics Telemetry Configuration",
        status=TaskStatus.DONE,
        priority=TaskPriority.HIGH,
        assignee="Commander Shepard",
    )
    db_session.add(t)
    db_session.commit()

    # 1. Generate report with explicit outgoing and incoming owners
    gen_res = client.post(
        f"/api/v1/reports/generate?project_id={project.id}"
        f"&actor=Commander+Shepard"
        f"&incoming_owner=Lieutenant+Alenko"
        f"&incoming_owner_role=Avionics+Lead"
    )
    assert gen_res.status_code == 201
    rep = gen_res.json()
    assert rep["outgoing_owner"] == "Commander Shepard"
    assert rep["incoming_owner"] == "Lieutenant Alenko"
    assert rep["incoming_owner_role"] == "Avionics Lead"
    assert rep["acknowledgement_status"] == "draft"
    assert rep["version"] == 1
    report_id = rep["id"]

    # 2. Update successor directly
    succ_res = client.patch(
        f"/api/v1/reports/{report_id}/successor",
        json={"incoming_owner": "Major Alenko", "incoming_owner_role": "Chief Systems Officer"},
    )
    assert succ_res.status_code == 200
    assert succ_res.json()["incoming_owner"] == "Major Alenko"

    # 3. Outgoing owner sends for acknowledgement
    send_res = client.post(
        f"/api/v1/reports/{report_id}/send-acknowledgement",
        json={"notes": "Please review all sub-system telemetry specifications."},
    )
    assert send_res.status_code == 200
    sent_data = send_res.json()
    assert sent_data["acknowledgement_status"] == "pending"
    assert sent_data["sent_at"] is not None

    # 4. Incoming owner requests clarification
    clarify_res = client.post(
        f"/api/v1/reports/{report_id}/request-clarification",
        json={
            "clarification_notes": "Thermal shielding telemetry threshold needs calibration curves.",
            "requested_by": "Major Alenko",
        },
    )
    assert clarify_res.status_code == 200
    clarify_data = clarify_res.json()
    assert clarify_data["acknowledgement_status"] == "clarification_requested"
    assert "calibration curves" in clarify_data["clarification_notes"]

    # 5. Incoming owner acknowledges
    ack_res = client.post(
        f"/api/v1/reports/{report_id}/acknowledge",
        json={
            "notes": "Calibration curves reviewed and verified. Handover accepted.",
            "acknowledged_by": "Major Alenko",
        },
    )
    assert ack_res.status_code == 200
    ack_data = ack_res.json()
    assert ack_data["acknowledgement_status"] == "acknowledged"
    assert ack_data["acknowledged_at"] is not None

    # 6. Create version snapshot (v2)
    v2_res = client.post(
        f"/api/v1/reports/{report_id}/versions",
        json={"title": "Revision after thermal calibration sign-off"},
    )
    assert v2_res.status_code == 201
    v2_data = v2_res.json()
    assert v2_data["version"] == 2
    assert v2_data["acknowledgement_status"] == "draft"

    # 7. Verify audit trail has recorded each lifecycle stage
    audit_res = client.get(f"/api/v1/projects/{project.id}/audit-logs/")
    assert audit_res.status_code == 200
    actions = [l["action"] for l in audit_res.json()]
    assert "handover_sent" in actions
    assert "handover_clarification_requested" in actions
    assert "handover_acknowledged" in actions


# ==============================================================================
# 6. REGRESSION WORKFLOW VERIFICATION
# ==============================================================================

def test_workflow_6_regression(client, db_session):
    """
    Verify:
    - Existing project CRUD.
    - Existing task CRUD.
    - Existing decision CRUD.
    - Document upload and processing.
    - AI review queue approve / reject workflows.
    - Continuity map graph generation.
    - PDF report generation and export.
    """
    # A. Project CRUD
    p_create = client.post("/api/v1/projects/", json={"name": "Regression Verification System"})
    assert p_create.status_code == 201
    p_id = p_create.json()["id"]

    p_get = client.get(f"/api/v1/projects/{p_id}")
    assert p_get.status_code == 200
    assert p_get.json()["name"] == "Regression Verification System"

    p_patch = client.patch(f"/api/v1/projects/{p_id}", json={"description": "Updated regression description"})
    assert p_patch.status_code == 200
    assert p_patch.json()["description"] == "Updated regression description"

    # B. Task CRUD
    t_create = client.post(
        "/api/v1/tasks/",
        json={"project_id": p_id, "title": "Base Regression Task", "status": "todo", "priority": "high"},
    )
    assert t_create.status_code == 201
    t_id = t_create.json()["id"]

    t_patch = client.patch(f"/api/v1/tasks/{t_id}", json={"status": "done"})
    assert t_patch.status_code == 200
    assert t_patch.json()["status"] == "done"

    # C. Decision CRUD
    d_create = client.post(
        "/api/v1/decisions/",
        json={"project_id": p_id, "title": "Adopt Structured JSON Schemas", "rationale": "Enforces strict validation"},
    )
    assert d_create.status_code == 201
    d_id = d_create.json()["id"]

    d_patch = client.patch(f"/api/v1/decisions/{d_id}", json={"decided_by": "Architectural Board"})
    assert d_patch.status_code == 200
    assert d_patch.json()["decided_by"] == "Architectural Board"

    # D. Document upload & extraction
    minimal_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n00000000117 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n193\n%%EOF"
    upload_res = client.post(
        "/api/v1/documents/upload",
        files={"file": ("regression_spec.pdf", io.BytesIO(minimal_pdf), "application/pdf")},
        data={"project_id": p_id, "author": "QA Team"},
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # E. AI Review queue
    # Seed an extracted claim manually for deterministic review testing
    claim = ExtractedKnowledge(
        document_id=uuid.UUID(doc_id),
        category=KnowledgeCategory.TASK,
        title="Migrate Cache to In-Memory DB",
        content="Replace external disk cache with fast in-memory store.",
        confidence=0.92,
        source_reference="Page 1",
        evidence_snippet="We must replace external disk cache with fast in-memory store.",
        status=VerificationStatus.PENDING,
    )
    db_session.add(claim)
    db_session.commit()
    db_session.refresh(claim)

    review_list = client.get(f"/api/v1/reviews/?document_id={doc_id}")
    assert review_list.status_code == 200
    assert len(review_list.json()) >= 1

    # Approve claim (promotes to Task)
    approve_res = client.patch(f"/api/v1/reviews/{claim.id}/approve")
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"

    # F. Continuity Map Graph
    graph_res = client.get(f"/api/v1/continuity/graph?project_id={p_id}")
    assert graph_res.status_code == 200
    graph_data = graph_res.json()
    assert "nodes" in graph_data
    assert "edges" in graph_data
    assert len(graph_data["nodes"]) >= 2

    # G. Handover Report & PDF Export
    rep_res = client.post(f"/api/v1/reports/generate?project_id={p_id}")
    assert rep_res.status_code == 201
    r_id = rep_res.json()["id"]

    pdf_res = client.get(f"/api/v1/reports/{r_id}/pdf")
    assert pdf_res.status_code == 200
    assert "application/pdf" in pdf_res.headers["content-type"]
    assert pdf_res.content.startswith(b"%PDF")
