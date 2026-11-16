from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskPriority, TaskStatus


def test_handover_lifecycle_and_acknowledgement(client, db_session):
    project = Project(
        name="Apollo Launch Platform",
        description="Mission critical handover dossier",
        status=ProjectStatus.ACTIVE,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    # Add incomplete tasks
    t1 = Task(
        project_id=project.id,
        title="Final Telemetry Calibration",
        status=TaskStatus.IN_PROGRESS,
        priority=TaskPriority.HIGH,
        assignee="Flight Lead",
    )
    db_session.add(t1)
    db_session.commit()

    # 1. Generate report
    gen_res = client.post(
        f"/api/v1/reports/generate?project_id={project.id}&incoming_owner=Dr.+Zheng&incoming_owner_role=Chief+Flight+Director"
    )
    assert gen_res.status_code == 201
    rep = gen_res.json()
    assert rep["acknowledgement_status"] == "draft"
    assert rep["version"] == 1
    assert rep["incoming_owner"] == "Dr. Zheng"

    report_id = rep["id"]

    # 2. Send for acknowledgement
    send_res = client.post(f"/api/v1/reports/{report_id}/send-acknowledgement")
    assert send_res.status_code == 200
    sent_rep = send_res.json()
    assert sent_rep["acknowledgement_status"] == "pending"
    assert sent_rep["sent_at"] is not None

    # 3. Request clarification
    clarify_res = client.post(
        f"/api/v1/reports/{report_id}/request-clarification",
        json={"clarification_notes": "Please document telemetry retry parameters before final sign-off."},
    )
    assert clarify_res.status_code == 200
    clarified_rep = clarify_res.json()
    assert clarified_rep["acknowledgement_status"] == "clarification_requested"
    assert "telemetry retry parameters" in clarified_rep["clarification_notes"]

    # 4. Final acknowledgement
    ack_res = client.post(
        f"/api/v1/reports/{report_id}/acknowledge",
        json={"notes": "All requirements verified and signed off.", "acknowledged_by": "Dr. Zheng"},
    )
    assert ack_res.status_code == 200
    acked_rep = ack_res.json()
    assert acked_rep["acknowledgement_status"] == "acknowledged"
    assert acked_rep["acknowledged_at"] is not None

    # 5. Create new revision version (v2)
    v2_res = client.post(f"/api/v1/reports/{report_id}/versions")
    assert v2_res.status_code == 201
    v2_rep = v2_res.json()
    assert v2_rep["version"] == 2
    assert v2_rep["acknowledgement_status"] == "draft"

