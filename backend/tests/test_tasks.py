import uuid
from fastapi import status


def _create_project(client, name="Test Project"):
    resp = client.post("/api/v1/projects/", json={"name": name})
    assert resp.status_code == status.HTTP_201_CREATED
    return resp.json()["id"]


def test_create_task_under_project(client):
    project_id = _create_project(client)
    payload = {
        "title": "Set up database migrations",
        "description": "Configure Alembic and base schemas",
        "status": "todo",
        "priority": "high",
        "assignee": "Alice",
    }
    response = client.post(f"/api/v1/projects/{project_id}/tasks", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["project_id"] == project_id
    assert data["title"] == "Set up database migrations"
    assert data["status"] == "todo"
    assert data["priority"] == "high"
    assert data["assignee"] == "Alice"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_task_top_level(client):
    project_id = _create_project(client)
    payload = {
        "project_id": project_id,
        "title": "Build frontend auth",
        "priority": "urgent",
    }
    response = client.post("/api/v1/tasks/", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["project_id"] == project_id
    assert data["title"] == "Build frontend auth"
    assert data["status"] == "todo"  # default
    assert data["priority"] == "urgent"


def test_create_task_missing_project_id(client):
    payload = {"title": "Orphan Task"}
    response = client.post("/api/v1/tasks/", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_task_nonexistent_project(client):
    bad_id = str(uuid.uuid4())
    payload = {"title": "Task for Ghost Project"}
    response = client.post(f"/api/v1/projects/{bad_id}/tasks", json=payload)
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_create_task_blank_title(client):
    project_id = _create_project(client)
    response = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "   "},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_task_title_too_long(client):
    project_id = _create_project(client)
    response = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "X" * 201},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_task_invalid_status_and_priority(client):
    project_id = _create_project(client)
    resp1 = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Task", "status": "invalid_status"},
    )
    assert resp1.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    resp2 = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Task", "priority": "critical"},
    )
    assert resp2.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_list_tasks_for_project(client):
    project_id = _create_project(client)
    # Create two tasks
    client.post(f"/api/v1/projects/{project_id}/tasks", json={"title": "Task 1", "status": "todo"})
    client.post(f"/api/v1/projects/{project_id}/tasks", json={"title": "Task 2", "status": "in_progress"})

    response = client.get(f"/api/v1/projects/{project_id}/tasks")
    assert response.status_code == status.HTTP_200_OK
    tasks = response.json()
    assert len(tasks) == 2

    # Filter by status
    filtered = client.get(f"/api/v1/projects/{project_id}/tasks?status=in_progress")
    assert filtered.status_code == status.HTTP_200_OK
    assert len(filtered.json()) == 1
    assert filtered.json()[0]["title"] == "Task 2"


def test_list_tasks_nonexistent_project(client):
    bad_id = str(uuid.uuid4())
    response = client.get(f"/api/v1/projects/{bad_id}/tasks")
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_get_task_by_id(client):
    project_id = _create_project(client)
    create_resp = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Inspect codebase", "description": "Check directories"},
    )
    task_id = create_resp.json()["id"]

    response = client.get(f"/api/v1/tasks/{task_id}")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == task_id
    assert data["title"] == "Inspect codebase"
    assert data["description"] == "Check directories"


def test_get_task_not_found(client):
    bad_id = str(uuid.uuid4())
    response = client.get(f"/api/v1/tasks/{bad_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_update_task_fields_and_status(client):
    project_id = _create_project(client)
    create_resp = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Original Title", "status": "todo", "priority": "low"},
    )
    task_id = create_resp.json()["id"]

    # Update title and priority
    patch1 = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"title": "New Title", "priority": "high"},
    )
    assert patch1.status_code == status.HTTP_200_OK
    assert patch1.json()["title"] == "New Title"
    assert patch1.json()["priority"] == "high"
    assert patch1.json()["status"] == "todo"

    # Update status to done
    patch2 = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "done"},
    )
    assert patch2.status_code == status.HTTP_200_OK
    assert patch2.json()["status"] == "done"


def test_update_task_blank_title(client):
    project_id = _create_project(client)
    create_resp = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Valid Title"},
    )
    task_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"title": "   "},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_update_task_not_found(client):
    bad_id = str(uuid.uuid4())
    response = client.patch(
        f"/api/v1/tasks/{bad_id}",
        json={"title": "New Title"},
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_delete_task(client):
    project_id = _create_project(client)
    create_resp = client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"title": "Temporary Task"},
    )
    task_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/v1/tasks/{task_id}")
    assert del_resp.status_code == status.HTTP_204_NO_CONTENT

    # Verify task is deleted
    get_resp = client.get(f"/api/v1/tasks/{task_id}")
    assert get_resp.status_code == status.HTTP_404_NOT_FOUND


def test_delete_task_not_found(client):
    bad_id = str(uuid.uuid4())
    response = client.delete(f"/api/v1/tasks/{bad_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_create_task_oversized_description_fails(client):
    """
    Regression test: Security Audit Fix 6.
    Verify creating a task with description > 10,000 chars returns 422.
    """
    proj = client.post("/api/v1/projects/", json={"name": "Task Proj"}).json()
    response = client.post(
        f"/api/v1/projects/{proj['id']}/tasks",
        json={"title": "Valid Task", "description": "d" * 10001},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_update_task_oversized_description_fails(client):
    """
    Regression test: Security Audit Fix 6.
    Verify updating a task with description > 10,000 chars returns 422.
    """
    proj = client.post("/api/v1/projects/", json={"name": "Task Proj 2"}).json()
    task = client.post(
        f"/api/v1/projects/{proj['id']}/tasks",
        json={"title": "Valid Task", "description": "Normal"},
    ).json()

    patch_resp = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"description": "u" * 10001},
    )
    assert patch_resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_task_oversized_assignee_fails(client):
    """
    Regression test: Security Audit Fix 6.
    Verify creating a task with assignee > 120 chars returns 422.
    """
    proj = client.post("/api/v1/projects/", json={"name": "Task Proj 3"}).json()
    response = client.post(
        f"/api/v1/projects/{proj['id']}/tasks",
        json={"title": "Valid Task", "assignee": "a" * 121},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

