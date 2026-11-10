import json
from uuid import UUID, uuid4
from fastapi import status
import pymupdf
from app.models.document import Document
from app.models.extracted_knowledge import ExtractedKnowledge, KnowledgeCategory, VerificationStatus


def _create_project(client, name="Continuity Project"):
    resp = client.post("/api/v1/projects/", json={"name": name, "description": "Project for continuity testing"})
    assert resp.status_code == status.HTTP_201_CREATED
    return resp.json()["id"]


def test_continuity_graph_empty_project(client):
    project_id = _create_project(client, "Empty Continuity Project")

    res = client.get(f"/api/v1/continuity/graph?project_id={project_id}")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["project_id"] == project_id
    assert len(data["nodes"]) == 1  # root project node
    assert data["nodes"][0]["entity_type"] == "project"
    assert len(data["edges"]) == 0
    assert data["orphan_count"] == 0
    assert data["blocking_paths_count"] == 0


def test_continuity_graph_with_entities(client):
    project_id = _create_project(client, "Nexus Migration")

    # Add a task
    task_res = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "VPC Peering MTU Adjustment", "priority": "high", "assignee": "Marcus Vance", "status": "blocked"},
    )
    assert task_res.status_code == status.HTTP_201_CREATED
    task_id = task_res.json()["id"]

    # Add a decision
    dec_res = client.post(
        f"/api/v1/projects/{project_id}/decisions",
        json={"title": "Kafka KRaft Consensus Mode", "decided_by": "Elena Rostova", "rationale": "Decommission Zookeeper"},
    )
    assert dec_res.status_code == status.HTTP_201_CREATED

    # Fetch graph
    res = client.get(f"/api/v1/continuity/graph?project_id={project_id}")
    assert res.status_code == status.HTTP_200_OK
    graph = res.json()

    assert graph["entity_counts"]["tasks"] >= 1
    assert graph["entity_counts"]["decisions"] >= 1
    assert graph["entity_counts"]["owners"] >= 2  # Marcus Vance & Elena Rostova
    assert graph["blocking_paths_count"] >= 1  # 1 blocked task

    # Check node details
    task_node_id = f"task-{task_id}"
    node_detail_res = client.get(f"/api/v1/continuity/nodes/{task_node_id}?project_id={project_id}")
    assert node_detail_res.status_code == status.HTTP_200_OK
    node_data = node_detail_res.json()
    assert node_data["node"]["id"] == task_node_id
    assert len(node_data["incoming_edges"]) >= 1


def test_continuity_graph_nonexistent_project_fails(client):
    fake_id = str(uuid4())
    res = client.get(f"/api/v1/continuity/graph?project_id={fake_id}")
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_handover_report_generation_and_integrity(client):
    project_id = _create_project(client, "Core Platform Handover")

    # 1. Add tasks (1 done, 1 blocked, 1 todo)
    client.post(f"/api/v1/projects/{project_id}/tasks", json={"title": "Migrate DB", "status": "done", "assignee": "Alice"})
    client.post(f"/api/v1/projects/{project_id}/tasks", json={"title": "Setup DNS", "status": "blocked", "assignee": "Bob"})
    client.post(f"/api/v1/projects/{project_id}/tasks", json={"title": "Configure Auth", "status": "todo", "assignee": "Charlie"})

    # 2. Add decision
    client.post(
        f"/api/v1/projects/{project_id}/decisions",
        json={"title": "Adopt PostgreSQL", "decided_by": "Alice", "rationale": "High reliability and JSON support"},
    )

    # 3. Generate report
    gen_res = client.post(f"/api/v1/reports/generate?project_id={project_id}&actor=LeadAuditor")
    assert gen_res.status_code == status.HTTP_201_CREATED
    report = gen_res.json()

    assert report["project_id"] == project_id
    assert "Handover Continuity Dossier" in report["title"]
    assert report["status"] == "generated"

    content = report["content"]
    # Check Section 1: Overview
    assert content["overview"]["project_name"] == "Core Platform Handover"
    assert content["overview"]["progress_percentage"] == 33  # 1 of 3 tasks done
    assert "Alice" in content["overview"]["outgoing_owner"] or "Alice" in content["overview"]["incoming_owner"]

    # Check Section 2: Status
    assert content["status"]["total_tasks"] == 3
    assert content["status"]["completed_tasks"] == 1
    assert content["status"]["blocked_tasks"] == 1
    assert content["status"]["decisions_count"] == 1

    # Check Section 3: Decisions
    assert len(content["decisions"]) == 1
    assert content["decisions"][0]["title"] == "Adopt PostgreSQL"

    # Check Section 4: Completed Work
    assert len(content["completed_work"]) == 1
    assert content["completed_work"][0]["title"] == "Migrate DB"

    # Check Section 5: Pending & Blocked
    assert len(content["pending_and_blocked_tasks"]) == 2
    titles = [t["title"] for t in content["pending_and_blocked_tasks"]]
    assert "Setup DNS" in titles
    assert "Configure Auth" in titles

    # Check Section 6: Ownership Matrix
    assert len(content["ownership_matrix"]) >= 2

    # Check Section 7: Risks & Blockers
    assert len(content["risks_and_blockers"]) >= 1  # Setup DNS is a blocked task

    # Check Section 8: Dependencies
    assert len(content["dependencies"]) >= 1

    # Check Section 10: Recommended Actions
    assert len(content["recommended_next_actions"]) >= 1
    assert any("Setup DNS" in a["action"] for a in content["recommended_next_actions"])

    # 4. Fetch report by ID
    report_id = report["id"]
    get_res = client.get(f"/api/v1/reports/{report_id}")
    assert get_res.status_code == status.HTTP_200_OK

    # 5. List reports
    list_res = client.get(f"/api/v1/reports?project_id={project_id}")
    assert list_res.status_code == status.HTTP_200_OK
    assert len(list_res.json()) >= 1


def test_handover_report_pdf_export(client):
    project_id = _create_project(client, "PDF Export Project")

    # Generate report
    gen_res = client.post(f"/api/v1/reports/generate?project_id={project_id}")
    report_id = gen_res.json()["id"]

    # Export PDF
    pdf_res = client.get(f"/api/v1/reports/{report_id}/pdf")
    assert pdf_res.status_code == status.HTTP_200_OK
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in pdf_res.headers["content-disposition"]

    # Check PDF magic bytes (%PDF-)
    pdf_content = pdf_res.content
    assert pdf_content.startswith(b"%PDF-")
    assert len(pdf_content) > 1000  # Valid multi-page PDF


def test_handover_report_nonexistent_project_fails(client):
    fake_id = str(uuid4())
    res = client.post(f"/api/v1/reports/generate?project_id={fake_id}")
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_handover_report_with_rejected_claims_and_accurate_counts(client, db_session):
    project_id = _create_project(client, "Verification Integrity Project")

    doc = Document(
        project_id=UUID(project_id),
        filename="system-arch.pdf",
        file_type="pdf",
        file_size=2048,
        page_count=6,
        extracted_claims_count=3,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    c1 = ExtractedKnowledge(
        document_id=doc.id,
        project_id=UUID(project_id),
        category=KnowledgeCategory.RISK,
        title="High Latency Cross-Region Mesh",
        status=VerificationStatus.APPROVED,
        confidence=0.95,
        evidence_snippet="Mesh latency exceeds 200ms",
    )
    c2 = ExtractedKnowledge(
        document_id=doc.id,
        project_id=UUID(project_id),
        category=KnowledgeCategory.RISK,
        title="Unverified Vendor Outage Risk",
        status=VerificationStatus.REJECTED,
        confidence=0.3,
        evidence_snippet="Fictional vendor outage",
    )
    c3 = ExtractedKnowledge(
        document_id=doc.id,
        project_id=UUID(project_id),
        category=KnowledgeCategory.QUESTION,
        title="TLS 1.3 Cipher Suite Support",
        status=VerificationStatus.PENDING,
        confidence=0.8,
        evidence_snippet="Awaiting sec ops clarification",
    )
    db_session.add_all([c1, c2, c3])
    db_session.commit()

    # Generate report
    gen_res = client.post(f"/api/v1/reports/generate?project_id={project_id}&actor=Auditor")
    assert gen_res.status_code == status.HTTP_201_CREATED
    data = gen_res.json()
    content = data["content"]

    # 1. Verify accurate claim counts
    assert content["status"]["approved_claims_count"] == 1
    assert content["status"]["rejected_claims_count"] == 1
    assert content["status"]["pending_claims_count"] == 1

    # 2. Executive summary wording MUST NOT claim all passed
    exec_summary = content["overview"]["executive_summary"]
    assert "All reported claims have passed verification guardrails" not in exec_summary
    assert "1 approved, 1 rejected, and 1 pending review" in exec_summary
    assert "rejected claims have been excluded" in exec_summary

    # 3. Verified sections MUST contain approved claim and MUST NOT contain rejected claim
    risk_titles = [r["title"] for r in content["risks_and_blockers"]]
    assert "High Latency Cross-Region Mesh" in risk_titles
    assert "Unverified Vendor Outage Risk" not in risk_titles

    # 4. Inferred recommendations must be explicitly labelled
    for action in content["recommended_next_actions"]:
        assert action["is_inferred"] is True
        assert "[Inferred Recommendation]" in action["action"]


def test_handover_report_missing_incoming_owner(client):
    project_id = _create_project(client, "Solo Project")

    # Only 1 owner
    client.post(f"/api/v1/projects/{project_id}/tasks", json={"title": "Single Task", "assignee": "Solo Engineer"})

    gen_res = client.post(f"/api/v1/reports/generate?project_id={project_id}")
    assert gen_res.status_code == status.HTTP_201_CREATED
    content = gen_res.json()["content"]

    assert content["overview"]["outgoing_owner"] == "Solo Engineer"
    assert content["overview"]["incoming_owner"] == "Not assigned"
    assert "Marcus Vance" not in content["overview"]["incoming_owner"]
    assert "Marcus Vance" not in json.dumps(content)

    # 0 owners
    empty_project_id = _create_project(client, "Zero Owners Project")
    gen_res2 = client.post(f"/api/v1/reports/generate?project_id={empty_project_id}")
    content2 = gen_res2.json()["content"]
    assert content2["overview"]["outgoing_owner"] == "Not assigned"
    assert content2["overview"]["incoming_owner"] == "Not assigned"
    assert "Elena Rostova" not in content2["overview"]["outgoing_owner"]


def test_pdf_export_with_no_assigned_incoming_owner(client):
    project_id = _create_project(client, "Unassigned Owners PDF Project")

    gen_res = client.post(f"/api/v1/reports/generate?project_id={project_id}")
    report_id = gen_res.json()["id"]

    pdf_res = client.get(f"/api/v1/reports/{report_id}/pdf")
    assert pdf_res.status_code == status.HTTP_200_OK

    doc = pymupdf.open(stream=pdf_res.content, filetype="pdf")
    assert len(doc) >= 1
    page1_text = doc[0].get_text()

    assert "Outgoing Owner / Lead: Not assigned" in page1_text
    assert "Incoming Successor: Not assigned" in page1_text
    assert "Marcus Vance" not in page1_text
    assert "Elena Rostova" not in page1_text
    doc.close()


def test_continuity_map_without_fabricated_owner_node(client):
    project_id = _create_project(client, "No Owners Graph Project")

    # Tasks and decisions with NO assignee/decided_by
    client.post(f"/api/v1/projects/{project_id}/tasks", json={"title": "Anonymous Task"})
    client.post(f"/api/v1/projects/{project_id}/decisions", json={"title": "Anonymous Decision", "rationale": "Testing"})

    res = client.get(f"/api/v1/continuity/graph?project_id={project_id}")
    assert res.status_code == status.HTTP_200_OK
    graph = res.json()

    assert graph["entity_counts"]["owners"] == 0
    assert not any(n["entity_type"] == "owner" for n in graph["nodes"])
    assert not any(e["relationship"] == "relay transfer" for e in graph["edges"])


def test_continuity_map_excludes_rejected_claims(client, db_session):
    project_id = _create_project(client, "Continuity Rejection Test Project")

    doc = Document(
        project_id=UUID(project_id),
        filename="rfc-spec.pdf",
        file_type="pdf",
        file_size=1024,
        page_count=2,
        extracted_claims_count=2,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    approved_claim = ExtractedKnowledge(
        document_id=doc.id,
        project_id=UUID(project_id),
        category=KnowledgeCategory.RISK,
        title="Approved Cluster Risk",
        status=VerificationStatus.APPROVED,
        confidence=0.9,
    )
    rejected_claim = ExtractedKnowledge(
        document_id=doc.id,
        project_id=UUID(project_id),
        category=KnowledgeCategory.RISK,
        title="Spurious Rejected Claim",
        status=VerificationStatus.REJECTED,
        confidence=0.2,
    )
    db_session.add_all([approved_claim, rejected_claim])
    db_session.commit()

    res = client.get(f"/api/v1/continuity/graph?project_id={project_id}")
    assert res.status_code == status.HTTP_200_OK
    graph = res.json()

    node_labels = [n["label"] for n in graph["nodes"]]
    assert "Approved Cluster Risk" in node_labels
    assert "Spurious Rejected Claim" not in node_labels


def test_human_readable_project_id_rejected_with_422(client):
    """
    Regression test: verify that human-readable project identifiers (such as 'INF-109')
    are strictly rejected with HTTP 422 across all endpoints expecting a UUID.
    """
    human_id = "INF-109"

    # 1. GET /api/v1/reviews/
    resp_reviews = client.get(f"/api/v1/reviews/?project_id={human_id}")
    assert resp_reviews.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 2. GET /api/v1/reports/
    resp_reports = client.get(f"/api/v1/reports/?project_id={human_id}")
    assert resp_reports.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 3. POST /api/v1/reports/generate
    resp_gen = client.post(f"/api/v1/reports/generate?project_id={human_id}")
    assert resp_gen.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 4. GET /api/v1/continuity/graph
    resp_continuity = client.get(f"/api/v1/continuity/graph?project_id={human_id}")
    assert resp_continuity.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 5. GET /api/v1/documents
    resp_docs = client.get(f"/api/v1/documents?project_id={human_id}")
    assert resp_docs.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 6. GET /api/v1/tasks
    resp_tasks = client.get(f"/api/v1/tasks?project_id={human_id}")
    assert resp_tasks.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 7. GET /api/v1/decisions
    resp_decisions = client.get(f"/api/v1/decisions?project_id={human_id}")
    assert resp_decisions.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_incoming_owner_never_inferred_from_deciders_or_assignees(client):
    """
    Regression test: verify that when multiple contributors exist (e.g. deciders like 'Lead Reviewer'),
    the incoming successor is NEVER inferred from task assignees, deciders, or alphabetical ordering.
    It must strictly be 'Not assigned' unless explicitly designated.
    """
    project_id = _create_project(client, "Lead Reviewer Disassociation Project")

    # Tasks assigned to Aryan Mandal
    client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Primary Architecture Implementation", "assignee": "Aryan Mandal"},
    )
    client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Continuity Topology", "assignee": "Aryan Mandal"},
    )

    # Decision decided by Lead Reviewer
    client.post(
        f"/api/v1/projects/{project_id}/decisions",
        json={"title": "Provenance Guardrail ADR", "decided_by": "Lead Reviewer", "rationale": "Audit verified"},
    )

    # Generate report with NO explicitly designated incoming successor
    gen_res = client.post(f"/api/v1/reports/generate?project_id={project_id}&actor=Aryan+Mandal")
    assert gen_res.status_code == status.HTTP_201_CREATED
    content = gen_res.json()["content"]

    # 1. Outgoing owner is preserved as primary contributor
    assert content["overview"]["outgoing_owner"] == "Aryan Mandal"

    # 2. Incoming owner must NEVER be inferred as Lead Reviewer
    assert content["overview"]["incoming_owner"] == "Not assigned"
    assert "Lead Reviewer" not in content["overview"]["incoming_owner"]

    # 3. Ownership matrix does not label non-designated decider as successor
    for own in content["ownership_matrix"]:
        if own["name"] == "Lead Reviewer":
            assert own["role"] != "Successor Engineer"
            assert own["role"] != "Incoming Successor"
            assert own["handover_status"] == "Active Contributor"

    # 4. Next actions walkthrough target is 'Not assigned', not 'Lead Reviewer'
    walkthrough_action = next(
        a for a in content["recommended_next_actions"] if "live architecture walkthrough" in a["action"].lower()
    )
    assert walkthrough_action["target_owner"] == "Not assigned"


def test_generate_report_with_assigned_successor_and_role(client):
    """
    Verify that generating a report with explicitly designated incoming owner
    and incoming owner role persists both in overview, ownership matrix, and PDF export.
    """
    project_id = _create_project(client, "Successor Assignment Project")
    client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Infrastructure Handoff", "assignee": "Aryan Mandal"},
    )

    gen_res = client.post(
        f"/api/v1/reports/generate?project_id={project_id}&actor=Aryan+Mandal&incoming_owner=Sarah+Chen&incoming_owner_role=Staff+SRE"
    )
    assert gen_res.status_code == status.HTTP_201_CREATED
    data = gen_res.json()
    report_id = data["id"]
    content = data["content"]

    assert content["overview"]["outgoing_owner"] == "Aryan Mandal"
    assert content["overview"]["incoming_owner"] == "Sarah Chen"
    assert content["overview"]["incoming_owner_role"] == "Staff SRE"

    # Verify Sarah Chen in ownership matrix
    sarah_row = next((m for m in content["ownership_matrix"] if m["name"] == "Sarah Chen"), None)
    assert sarah_row is not None
    assert "Staff SRE" in sarah_row["role"]
    assert "Relay" in sarah_row["handover_status"]

    # Verify walkthrough target
    walkthrough = next(
        a for a in content["recommended_next_actions"] if "live architecture walkthrough" in a["action"].lower()
    )
    assert walkthrough["target_owner"] == "Sarah Chen"

    # Verify PDF export
    pdf_res = client.get(f"/api/v1/reports/{report_id}/pdf")
    assert pdf_res.status_code == status.HTTP_200_OK
    doc = pymupdf.open(stream=pdf_res.content, filetype="pdf")
    pdf_text = "".join(page.get_text() for page in doc)
    assert "Sarah Chen" in pdf_text
    assert "Staff SRE" in pdf_text


def test_update_existing_report_successor_details(client):
    """
    Verify that an existing report can have its designated successor updated
    via PATCH /api/v1/reports/{id}/successor, updating overview, matrix, and PDF.
    """
    project_id = _create_project(client, "Patch Successor Project")
    client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Security Hardening", "assignee": "Aryan Mandal"},
    )

    # 1. Generate report without successor
    gen_res = client.post(f"/api/v1/reports/generate?project_id={project_id}&actor=Aryan+Mandal")
    assert gen_res.status_code == status.HTTP_201_CREATED
    report_id = gen_res.json()["id"]
    assert gen_res.json()["content"]["overview"]["incoming_owner"] == "Not assigned"

    # 2. Update successor
    patch_res = client.patch(
        f"/api/v1/reports/{report_id}/successor",
        json={"incoming_owner": "David Miller", "incoming_owner_role": "Principal DevOps"},
    )
    assert patch_res.status_code == status.HTTP_200_OK
    updated_content = patch_res.json()["content"]

    assert updated_content["overview"]["incoming_owner"] == "David Miller"
    assert updated_content["overview"]["incoming_owner_role"] == "Principal DevOps"

    # Matrix reflects David Miller
    david_row = next((m for m in updated_content["ownership_matrix"] if m["name"] == "David Miller"), None)
    assert david_row is not None
    assert "Principal DevOps" in david_row["role"]

    # PDF reflects updated successor
    pdf_res = client.get(f"/api/v1/reports/{report_id}/pdf")
    assert pdf_res.status_code == status.HTTP_200_OK
    doc = pymupdf.open(stream=pdf_res.content, filetype="pdf")
    pdf_text = "".join(page.get_text() for page in doc)
    assert "David Miller" in pdf_text
    assert "Principal DevOps" in pdf_text


def test_update_report_successor_unassign(client):
    """
    Verify that clearing a successor explicitly sets incoming_owner to 'Not assigned'
    and removes role.
    """
    project_id = _create_project(client, "Unassign Successor Project")
    gen_res = client.post(
        f"/api/v1/reports/generate?project_id={project_id}&incoming_owner=Alex+Turner&incoming_owner_role=Lead"
    )
    assert gen_res.status_code == status.HTTP_201_CREATED
    report_id = gen_res.json()["id"]

    # Clear successor
    patch_res = client.patch(
        f"/api/v1/reports/{report_id}/successor",
        json={"incoming_owner": "", "incoming_owner_role": ""},
    )
    assert patch_res.status_code == status.HTTP_200_OK
    updated_content = patch_res.json()["content"]

    assert updated_content["overview"]["incoming_owner"] == "Not assigned"
    assert updated_content["overview"]["incoming_owner_role"] is None


def test_report_update_oversized_successor_fails(client):
    """
    Regression test: Security Audit Fix 6.
    Verify updating a report successor with incoming_owner > 120 chars returns 422.
    """
    project_id = _create_project(client, "Successor Limits Project")
    gen_res = client.post(f"/api/v1/reports/generate?project_id={project_id}")
    assert gen_res.status_code == status.HTTP_201_CREATED
    report_id = gen_res.json()["id"]

    patch_res = client.patch(
        f"/api/v1/reports/{report_id}/successor",
        json={"incoming_owner": "S" * 121, "incoming_owner_role": "Valid Role"},
    )
    assert patch_res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY





