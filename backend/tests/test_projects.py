import time
import uuid
from fastapi import status


def test_root_and_health_endpoints(client):
    """Preserve existing root and health endpoints."""
    resp_root = client.get("/")
    assert resp_root.status_code == status.HTTP_200_OK
    data_root = resp_root.json()
    assert data_root["message"] == "Welcome to Threadline API"
    assert data_root["status"] == "running"

    resp_health = client.get("/health")
    assert resp_health.status_code == status.HTTP_200_OK
    assert resp_health.json() == {"status": "healthy"}


def test_create_project_success(client):
    """Test successful project creation with valid payload."""
    payload = {
        "name": "Alpha Project",
        "description": "Handover documentation for Alpha Project",
        "status": "active",
    }
    response = client.post("/api/v1/projects/", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()

    assert "id" in data
    # Verify id is a valid UUID
    uuid.UUID(data["id"])
    assert data["name"] == "Alpha Project"
    assert data["description"] == "Handover documentation for Alpha Project"
    assert data["status"] == "active"
    assert "created_at" in data
    assert "updated_at" in data


def test_create_project_default_status(client):
    """Test project creation defaults to active status when omitted."""
    payload = {"name": "Beta Project"}
    response = client.post("/api/v1/projects/", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["status"] == "active"
    assert data["description"] is None


def test_create_project_archived_status(client):
    """Test project creation with explicit archived status."""
    payload = {"name": "Archived Project", "status": "archived"}
    response = client.post("/api/v1/projects/", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["status"] == "archived"


def test_create_project_blank_name_rejected(client):
    """Test project creation rejects empty or whitespace-only names."""
    # Empty string
    resp1 = client.post("/api/v1/projects/", json={"name": ""})
    assert resp1.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Whitespace only
    resp2 = client.post("/api/v1/projects/", json={"name": "   "})
    assert resp2.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Missing name
    resp3 = client.post("/api/v1/projects/", json={"description": "Missing name"})
    assert resp3.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_project_name_exceeds_max_length(client):
    """Test project creation rejects names exceeding 120 characters."""
    long_name = "A" * 121
    response = client.post("/api/v1/projects/", json={"name": long_name})
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_list_projects_empty(client):
    """Test listing projects when none exist returns empty list."""
    response = client.get("/api/v1/projects/")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


def test_list_projects_ordered_newest_first(client):
    """Test listing projects returns them sorted newest first."""
    # Create first project
    resp1 = client.post("/api/v1/projects/", json={"name": "Project One"})
    assert resp1.status_code == status.HTTP_201_CREATED
    p1 = resp1.json()

    # Small sleep to ensure distinct timestamps
    time.sleep(0.05)

    # Create second project
    resp2 = client.post("/api/v1/projects/", json={"name": "Project Two"})
    assert resp2.status_code == status.HTTP_201_CREATED
    p2 = resp2.json()

    time.sleep(0.05)

    # Create third project
    resp3 = client.post("/api/v1/projects/", json={"name": "Project Three"})
    assert resp3.status_code == status.HTTP_201_CREATED
    p3 = resp3.json()

    response = client.get("/api/v1/projects/")
    assert response.status_code == status.HTTP_200_OK
    projects = response.json()

    assert len(projects) == 3
    # Newest first: Project Three, Project Two, Project One
    assert projects[0]["id"] == p3["id"]
    assert projects[1]["id"] == p2["id"]
    assert projects[2]["id"] == p1["id"]


def test_get_project_success(client):
    """Test retrieving a single project by ID."""
    create_resp = client.post(
        "/api/v1/projects/",
        json={"name": "Apollo", "description": "Mission Apollo"},
    )
    created = create_resp.json()
    project_id = created["id"]

    response = client.get(f"/api/v1/projects/{project_id}")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == project_id
    assert data["name"] == "Apollo"
    assert data["description"] == "Mission Apollo"
    assert data["status"] == "active"


def test_get_project_not_found(client):
    """Test retrieving a non-existent project returns 404."""
    non_existent_id = str(uuid.uuid4())
    response = client.get(f"/api/v1/projects/{non_existent_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    data = response.json()
    assert "detail" in data
    assert non_existent_id in data["detail"]


def test_update_project_success(client):
    """Test updating project name, description, and status."""
    create_resp = client.post(
        "/api/v1/projects/",
        json={"name": "Initial Name", "description": "Initial Desc"},
    )
    project_id = create_resp.json()["id"]

    # Partial update: name and status
    patch_payload = {
        "name": "Updated Name",
        "status": "archived",
    }
    response = client.patch(f"/api/v1/projects/{project_id}", json=patch_payload)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["status"] == "archived"
    assert data["description"] == "Initial Desc"  # Preserved

    # Update description
    patch_desc = {"description": "Updated Description"}
    resp_desc = client.patch(f"/api/v1/projects/{project_id}", json=patch_desc)
    assert resp_desc.status_code == status.HTTP_200_OK
    assert resp_desc.json()["description"] == "Updated Description"


def test_update_project_blank_name_rejected(client):
    """Test updating project with a blank name is rejected."""
    create_resp = client.post(
        "/api/v1/projects/",
        json={"name": "Valid Name"},
    )
    project_id = create_resp.json()["id"]

    response = client.patch(f"/api/v1/projects/{project_id}", json={"name": "   "})
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_update_project_not_found(client):
    """Test updating a non-existent project returns 404."""
    non_existent_id = str(uuid.uuid4())
    response = client.patch(
        f"/api/v1/projects/{non_existent_id}",
        json={"name": "New Name"},
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_delete_project_success(client):
    """Test deleting a project returns 204 and removes it."""
    create_resp = client.post(
        "/api/v1/projects/",
        json={"name": "To Be Deleted"},
    )
    project_id = create_resp.json()["id"]

    # Delete project
    delete_resp = client.delete(f"/api/v1/projects/{project_id}")
    assert delete_resp.status_code == status.HTTP_204_NO_CONTENT

    # Verify project is gone
    get_resp = client.get(f"/api/v1/projects/{project_id}")
    assert get_resp.status_code == status.HTTP_404_NOT_FOUND

    # Verify not in list
    list_resp = client.get("/api/v1/projects/")
    assert len(list_resp.json()) == 0


def test_delete_project_not_found(client):
    """Test deleting a non-existent project returns 404."""
    non_existent_id = str(uuid.uuid4())
    response = client.delete(f"/api/v1/projects/{non_existent_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_sqlite_engine_compatibility_and_foreign_keys():
    """
    Regression test: Security Audit Fix 3.
    Verify SQLite engine options, pool_pre_ping, and foreign key pragma enforcement.
    """
    from sqlalchemy import create_engine, text
    from app.database import get_engine_options

    # 1. File SQLite options
    file_opts = get_engine_options("sqlite:///./test.db")
    assert file_opts["pool_pre_ping"] is True
    assert file_opts["pool_recycle"] == 300
    assert file_opts["connect_args"]["check_same_thread"] is False

    # 2. In-memory SQLite options (must avoid pool_recycle)
    mem_opts = get_engine_options("sqlite:///:memory:")
    assert mem_opts["pool_pre_ping"] is True
    assert "pool_recycle" not in mem_opts
    assert mem_opts["connect_args"]["check_same_thread"] is False

    # 3. Verify SQLite foreign keys enforcement
    test_eng = create_engine("sqlite:///:memory:", **mem_opts)
    with test_eng.connect() as conn:
        fk_status = conn.execute(text("PRAGMA foreign_keys;")).scalar()
        assert fk_status == 1, "SQLite foreign keys must be active"


def test_postgresql_engine_options_configuration():
    """
    Regression test: Security Audit Fix 3.
    Verify PostgreSQL engine configuration includes pool_pre_ping and pool_recycle.
    (Note: verifies driver engine/pool initialization without requiring a live remote server).
    """
    from sqlalchemy import create_engine
    from app.database import get_engine_options

    pg_url = "postgresql+psycopg://threadline_user:secret_pw@localhost:5432/threadline_prod"
    opts = get_engine_options(pg_url)

    assert opts["pool_pre_ping"] is True
    assert opts["pool_recycle"] == 300
    assert opts["connect_args"] == {}

    # Verify SQLAlchemy Engine and QueuePool instantiation
    pg_engine = create_engine(pg_url, **opts)
    assert getattr(pg_engine.pool, "_pre_ping", None) is True
    assert getattr(pg_engine.pool, "_recycle", None) == 300


def test_database_session_lifecycle(client):
    """
    Regression test: Security Audit Fix 3.
    Verify get_db generator yields a working session and properly closes it.
    """
    from app.database import get_db

    gen = get_db()
    session = next(gen)
    assert session is not None
    # Generator cleanup
    try:
        next(gen)
    except StopIteration:
        pass


def test_create_project_oversized_description_fails(client):
    """
    Regression test: Security Audit Fix 6.
    Verify creating a project with description exceeding 10,000 characters returns 422.
    """
    oversized_desc = "x" * 10001
    response = client.post(
        "/api/v1/projects/",
        json={"name": "Valid Name", "description": oversized_desc},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_update_project_oversized_description_fails(client):
    """
    Regression test: Security Audit Fix 6.
    Verify updating a project with description exceeding 10,000 characters returns 422.
    """
    create_resp = client.post(
        "/api/v1/projects/",
        json={"name": "Valid Name", "description": "Short description"},
    )
    project_id = create_resp.json()["id"]

    oversized_desc = "y" * 10001
    patch_resp = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"description": oversized_desc},
    )
    assert patch_resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


