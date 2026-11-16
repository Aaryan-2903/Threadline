from datetime import datetime, timedelta, timezone
from app.models.conflict import ConflictStatus
from app.models.decision import Decision
from app.models.extracted_knowledge import ExtractedKnowledge, KnowledgeCategory, VerificationStatus
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskPriority, TaskStatus


def test_conflict_detection_engine_end_to_end(client, db_session):
    now = datetime.now(timezone.utc)

    # 1. Create project
    project = Project(
        name="Fintech Ledger Overhaul",
        description="Core ledger database migration",
        status=ProjectStatus.ACTIVE,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    # 2. Add conflicting tasks (same title, different assignees)
    task1 = Task(
        project_id=project.id,
        title="Double Entry Transaction Reconciliation",
        status=TaskStatus.IN_PROGRESS,
        priority=TaskPriority.HIGH,
        assignee="Alice Cooper",
        due_date=now + timedelta(days=10),
    )
    task2 = Task(
        project_id=project.id,
        title="Double Entry Transaction Reconciliation",
        status=TaskStatus.TODO,
        priority=TaskPriority.URGENT,
        assignee="Bob Smith",
        due_date=now + timedelta(days=5),
    )

    # 3. Add superseded decisions
    dec1 = Decision(
        project_id=project.id,
        title="Adopt Single-Leader MySQL Cluster",
        description="Baseline relational database setup",
        rationale="Initial prototype deployment",
        decided_by="Lead Dev",
        decision_date=now - timedelta(days=90),
    )
    dec2 = Decision(
        project_id=project.id,
        title="Migrate to Multi-Region Spanner Cluster",
        description="Supersedes Single-Leader MySQL. Deprecates MySQL in production.",
        rationale="Global read/write consistency",
        decided_by="Principal Architect",
        decision_date=now - timedelta(days=10),
    )

    db_session.add_all([task1, task2, dec1, dec2])
    db_session.commit()

    # 4. Trigger conflict detection scan
    res = client.post(f"/api/v1/projects/{project.id}/conflicts/detect")
    assert res.status_code == 200
    data = res.json()
    assert data["detected_count"] >= 2
    assert data["open_count"] >= 2

    # Verify conflicting assignee detected
    conflicts = data["conflicts"]
    assignee_conflict = next((c for c in conflicts if c["conflict_type"] == "conflicting_assignee"), None)
    assert assignee_conflict is not None
    assert "Alice Cooper" in assignee_conflict["evidence_snippet"]
    assert "Bob Smith" in assignee_conflict["evidence_snippet"]

    # Verify superseded decision detected
    decision_conflict = next((c for c in conflicts if c["conflict_type"] == "superseded_decision"), None)
    assert decision_conflict is not None
    assert "Spanner" in decision_conflict["title"] or "MySQL" in decision_conflict["title"]

    # 5. Resolve conflict
    resolve_res = client.patch(
        f"/api/v1/conflicts/{decision_conflict['id']}",
        json={
            "status": "resolved",
            "resolution_notes": "Confirmed Spanner is the final architectural decision.",
            "resolved_by": "Architecture Review Board",
        },
    )
    assert resolve_res.status_code == 200
    resolved_data = resolve_res.json()
    assert resolved_data["status"] == "resolved"
    assert resolved_data["resolved_by"] == "Architecture Review Board"
    assert resolved_data["resolved_at"] is not None

    # 6. Re-detecting should be idempotent and preserve resolved status
    redetect_res = client.post(f"/api/v1/projects/{project.id}/conflicts/detect")
    assert redetect_res.status_code == 200
    redetect_data = redetect_res.json()
    redetected_dec_c = next((c for c in redetect_data["conflicts"] if c["id"] == decision_conflict["id"]), None)
    assert redetected_dec_c is not None
    assert redetected_dec_c["status"] == "resolved"
    assert redetected_dec_c["resolution_notes"] == "Confirmed Spanner is the final architectural decision."

