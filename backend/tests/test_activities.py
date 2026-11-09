import time
import uuid
from fastapi import status


def _create_project(client, name="Timeline Project"):
    resp = client.post("/api/v1/projects/", json={"name": name})
    assert resp.status_code == status.HTTP_201_CREATED
    return resp.json()["id"]


def test_task_creation_records_activity(client):
    project_id = _create_project(client)

    task_resp = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Setup CI/CD", "assignee": "Bob"},
    )
    assert task_resp.status_code == status.HTTP_201_CREATED
    task_id = task_resp.json()["id"]

    act_resp = client.get(f"/api/v1/projects/{project_id}/activities")
    assert act_resp.status_code == status.HTTP_200_OK
    activities = act_resp.json()
    assert len(activities) == 1

    act = activities[0]
    assert act["event_type"] == "task_created"
    assert "Setup CI/CD" in act["description"]
    assert act["actor"] == "Bob"
    assert act["entity_type"] == "task"
    assert act["entity_id"] == task_id


def test_task_status_change_records_activity(client):
    project_id = _create_project(client)
    task_resp = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Document API", "status": "todo", "assignee": "Alice"},
    )
    task_id = task_resp.json()["id"]

    # Change status
    patch_resp = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "in_progress"},
    )
    assert patch_resp.status_code == status.HTTP_200_OK

    act_resp = client.get(f"/api/v1/projects/{project_id}/activities")
    activities = act_resp.json()
    assert len(activities) == 2

    # Newest event is task_status_changed
    status_act = activities[0]
    assert status_act["event_type"] == "task_status_changed"
    assert "status changed from 'todo' to 'in_progress'" in status_act["description"]
    assert status_act["entity_id"] == task_id


def test_task_field_update_records_activity(client):
    project_id = _create_project(client)
    task_resp = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Old Task Title"},
    )
    task_id = task_resp.json()["id"]

    # Update title without changing status
    patch_resp = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"title": "Updated Task Title"},
    )
    assert patch_resp.status_code == status.HTTP_200_OK

    act_resp = client.get(f"/api/v1/projects/{project_id}/activities")
    activities = act_resp.json()
    assert len(activities) == 2
    assert activities[0]["event_type"] == "task_updated"
    assert "Updated Task Title" in activities[0]["description"]


def test_task_no_change_does_not_create_duplicate_activity(client):
    project_id = _create_project(client)
    task_resp = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Fixed Task", "status": "todo"},
    )
    task_id = task_resp.json()["id"]

    # Patch with same values
    client.patch(f"/api/v1/tasks/{task_id}", json={"title": "Fixed Task", "status": "todo"})
    client.patch(f"/api/v1/tasks/{task_id}", json={})

    act_resp = client.get(f"/api/v1/projects/{project_id}/activities")
    activities = act_resp.json()
    # Still only 1 activity (task_created)
    assert len(activities) == 1


def test_task_deletion_records_activity(client):
    project_id = _create_project(client)
    task_resp = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Task To Delete"},
    )
    task_id = task_resp.json()["id"]

    del_resp = client.delete(f"/api/v1/tasks/{task_id}?actor=Admin")
    assert del_resp.status_code == status.HTTP_204_NO_CONTENT

    act_resp = client.get(f"/api/v1/projects/{project_id}/activities")
    activities = act_resp.json()
    assert len(activities) == 2
    assert activities[0]["event_type"] == "task_deleted"
    assert activities[0]["actor"] == "Admin"


def test_decision_lifecycle_records_activities(client):
    project_id = _create_project(client)

    # 1. Decision created
    dec_resp = client.post(
        f"/api/v1/projects/{project_id}/decisions",
        json={"title": "Use Docker for Containers", "decided_by": "DevOps Team"},
    )
    decision_id = dec_resp.json()["id"]

    # 2. Decision updated
    client.patch(
        f"/api/v1/decisions/{decision_id}",
        json={"rationale": "Better cross-platform reproducibility"},
    )

    # 3. Decision deleted
    client.delete(f"/api/v1/decisions/{decision_id}?actor=CTO")

    act_resp = client.get(f"/api/v1/projects/{project_id}/activities")
    events = [a["event_type"] for a in act_resp.json()]
    assert "decision_created" in events
    assert "decision_updated" in events
    assert "decision_deleted" in events


def test_project_timeline_order_and_alias(client):
    project_id = _create_project(client)

    # Create sequence of events
    client.post(f"/api/v1/projects/{project_id}/tasks", json={"title": "First Event"})
    time.sleep(0.02)
    client.post(f"/api/v1/projects/{project_id}/decisions", json={"title": "Second Event"})

    # Test default descending order
    desc_resp = client.get(f"/api/v1/projects/{project_id}/activities")
    assert desc_resp.status_code == status.HTTP_200_OK
    desc_items = desc_resp.json()
    assert len(desc_items) == 2
    assert desc_items[0]["event_type"] == "decision_created"
    assert desc_items[1]["event_type"] == "task_created"

    # Test ascending order
    asc_resp = client.get(f"/api/v1/projects/{project_id}/activities?order=asc")
    assert asc_resp.status_code == status.HTTP_200_OK
    asc_items = asc_resp.json()
    assert asc_items[0]["event_type"] == "task_created"
    assert asc_items[1]["event_type"] == "decision_created"

    # Test timeline alias
    alias_resp = client.get(f"/api/v1/projects/{project_id}/timeline")
    assert alias_resp.status_code == status.HTTP_200_OK
    assert len(alias_resp.json()) == 2


def test_project_timeline_nonexistent_project(client):
    bad_id = str(uuid.uuid4())
    resp1 = client.get(f"/api/v1/projects/{bad_id}/activities")
    assert resp1.status_code == status.HTTP_404_NOT_FOUND

    resp2 = client.get(f"/api/v1/projects/{bad_id}/timeline")
    assert resp2.status_code == status.HTTP_404_NOT_FOUND


def test_global_activities_endpoint(client):
    p1 = _create_project(client, name="Proj 1")
    p2 = _create_project(client, name="Proj 2")

    client.post(f"/api/v1/projects/{p1}/tasks", json={"title": "Task P1"})
    client.post(f"/api/v1/projects/{p2}/tasks", json={"title": "Task P2"})

    # All activities
    all_resp = client.get("/api/v1/activities/")
    assert all_resp.status_code == status.HTTP_200_OK
    assert len(all_resp.json()) == 2

    # Filtered by project_id
    filtered = client.get(f"/api/v1/activities/?project_id={p1}")
    assert filtered.status_code == status.HTTP_200_OK
    assert len(filtered.json()) == 1
    assert filtered.json()[0]["project_id"] == p1


def test_cascade_deletion_on_project_delete(client):
    """When a project is deleted, its tasks, decisions and activities are cleanly removed."""
    project_id = _create_project(client, name="Cascade Project")
    task_resp = client.post(f"/api/v1/projects/{project_id}/tasks", json={"title": "Child Task"})
    task_id = task_resp.json()["id"]

    dec_resp = client.post(f"/api/v1/projects/{project_id}/decisions", json={"title": "Child Decision"})
    decision_id = dec_resp.json()["id"]

    # Delete project
    del_proj = client.delete(f"/api/v1/projects/{project_id}")
    assert del_proj.status_code == status.HTTP_204_NO_CONTENT

    # Verify task and decision no longer exist
    assert client.get(f"/api/v1/tasks/{task_id}").status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/v1/decisions/{decision_id}").status_code == status.HTTP_404_NOT_FOUND

    # Verify project activities no longer exist
    assert client.get(f"/api/v1/projects/{project_id}/activities").status_code == status.HTTP_404_NOT_FOUND
    assert len(client.get(f"/api/v1/activities/?project_id={project_id}").json()) == 0

