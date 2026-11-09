import uuid
from fastapi import status


def _create_project(client, name="Decision Project"):
    resp = client.post("/api/v1/projects/", json={"name": name})
    assert resp.status_code == status.HTTP_201_CREATED
    return resp.json()["id"]


def test_create_decision_under_project(client):
    project_id = _create_project(client)
    payload = {
        "title": "Use PostgreSQL for persistence",
        "description": "Selected PostgreSQL with psycopg 3 for production stability.",
        "rationale": "High reliability, JSONB capabilities and widespread hosting support.",
        "decided_by": "Architecture Guild",
    }
    response = client.post(f"/api/v1/projects/{project_id}/decisions", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["project_id"] == project_id
    assert data["title"] == "Use PostgreSQL for persistence"
    assert data["rationale"] == "High reliability, JSONB capabilities and widespread hosting support."
    assert data["decided_by"] == "Architecture Guild"
    assert "id" in data
    assert "decision_date" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_decision_top_level(client):
    project_id = _create_project(client)
    payload = {
        "project_id": project_id,
        "title": "Adopt Vite for frontend tooling",
        "decided_by": "Frontend Lead",
    }
    response = client.post("/api/v1/decisions/", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["project_id"] == project_id
    assert data["title"] == "Adopt Vite for frontend tooling"


def test_create_decision_missing_project_id(client):
    payload = {"title": "Orphan Decision"}
    response = client.post("/api/v1/decisions/", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_decision_nonexistent_project(client):
    bad_id = str(uuid.uuid4())
    payload = {"title": "Ghost Decision"}
    response = client.post(f"/api/v1/projects/{bad_id}/decisions", json=payload)
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_create_decision_blank_title(client):
    project_id = _create_project(client)
    response = client.post(
        f"/api/v1/projects/{project_id}/decisions",
        json={"title": "   "},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_list_decisions_for_project(client):
    project_id = _create_project(client)
    client.post(f"/api/v1/projects/{project_id}/decisions", json={"title": "Decision 1"})
    client.post(f"/api/v1/projects/{project_id}/decisions", json={"title": "Decision 2"})

    response = client.get(f"/api/v1/projects/{project_id}/decisions")
    assert response.status_code == status.HTTP_200_OK
    decisions = response.json()
    assert len(decisions) == 2


def test_list_decisions_nonexistent_project(client):
    bad_id = str(uuid.uuid4())
    response = client.get(f"/api/v1/projects/{bad_id}/decisions")
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_get_decision_by_id(client):
    project_id = _create_project(client)
    create_resp = client.post(
        f"/api/v1/projects/{project_id}/decisions",
        json={"title": "Decide on State Management", "rationale": "Redux Toolkit"},
    )
    decision_id = create_resp.json()["id"]

    response = client.get(f"/api/v1/decisions/{decision_id}")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == decision_id
    assert data["title"] == "Decide on State Management"
    assert data["rationale"] == "Redux Toolkit"


def test_get_decision_not_found(client):
    bad_id = str(uuid.uuid4())
    response = client.get(f"/api/v1/decisions/{bad_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_update_decision(client):
    project_id = _create_project(client)
    create_resp = client.post(
        f"/api/v1/projects/{project_id}/decisions",
        json={"title": "Initial Title", "rationale": "Initial Rationale"},
    )
    decision_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/decisions/{decision_id}",
        json={"title": "Revised Title", "rationale": "Revised Rationale", "decided_by": "New Lead"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["title"] == "Revised Title"
    assert data["rationale"] == "Revised Rationale"
    assert data["decided_by"] == "New Lead"


def test_update_decision_blank_title(client):
    project_id = _create_project(client)
    create_resp = client.post(
        f"/api/v1/projects/{project_id}/decisions",
        json={"title": "Valid Decision"},
    )
    decision_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/decisions/{decision_id}",
        json={"title": "   "},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_update_decision_not_found(client):
    bad_id = str(uuid.uuid4())
    response = client.patch(
        f"/api/v1/decisions/{bad_id}",
        json={"title": "New Title"},
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_delete_decision(client):
    project_id = _create_project(client)
    create_resp = client.post(
        f"/api/v1/projects/{project_id}/decisions",
        json={"title": "Temporary Decision"},
    )
    decision_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/v1/decisions/{decision_id}")
    assert del_resp.status_code == status.HTTP_204_NO_CONTENT

    get_resp = client.get(f"/api/v1/decisions/{decision_id}")
    assert get_resp.status_code == status.HTTP_404_NOT_FOUND


def test_delete_decision_not_found(client):
    bad_id = str(uuid.uuid4())
    response = client.delete(f"/api/v1/decisions/{bad_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND

