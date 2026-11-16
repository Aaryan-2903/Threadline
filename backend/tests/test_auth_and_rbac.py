import uuid
import pytest
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole


def test_password_hashing_and_verification():
    pw = "SuperSecret123!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_user_registration_and_login(client):
    unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "username": f"user_{uuid.uuid4().hex[:8]}",
            "password": "Password123!",
            "role": "contributor",
        },
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert reg_data["email"] == unique_email
    assert reg_data["role"] == "contributor"

    # Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": unique_email, "password": "Password123!"},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    assert token_data["user"]["email"] == unique_email


def test_demo_login_endpoint(client):
    res = client.post("/api/v1/auth/demo-login")
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "project_owner"
    assert data["user"]["is_demo"] is True

    # Use token to call /me
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["username"] == data["user"]["username"]


def test_viewer_role_prohibited_from_mutations(client, db_session):
    # Create Viewer user
    viewer = User(
        email=f"viewer_{uuid.uuid4().hex[:8]}@example.com",
        username=f"viewer_{uuid.uuid4().hex[:8]}",
        hashed_password=hash_password("view123"),
        role=UserRole.VIEWER,
    )
    db_session.add(viewer)
    db_session.commit()
    db_session.refresh(viewer)

    token = create_access_token({"sub": str(viewer.id), "username": viewer.username, "role": viewer.role.value})
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Attempt project creation with viewer token
    create_res = client.post(
        "/api/v1/projects/",
        json={"name": "Forbidden Project", "description": "Should fail"},
        headers=auth_headers,
    )
    assert create_res.status_code == 403
    assert "Viewers have read-only access" in create_res.json()["detail"]


def test_contributor_cannot_resolve_conflict(client, db_session):
    # Create demo workspace and users
    client.post("/api/v1/auth/demo-login")

    # Create contributor
    contrib = User(
        email=f"contrib_{uuid.uuid4().hex[:8]}@example.com",
        username=f"contrib_{uuid.uuid4().hex[:8]}",
        hashed_password=hash_password("contrib123"),
        role=UserRole.CONTRIBUTOR,
    )
    db_session.add(contrib)
    db_session.commit()
    db_session.refresh(contrib)

    token = create_access_token({"sub": str(contrib.id), "username": contrib.username, "role": contrib.role.value})
    headers = {"Authorization": f"Bearer {token}"}

    # Retrieve demo project
    projects_res = client.get("/api/v1/projects/")
    assert projects_res.status_code == 200
    project_id = projects_res.json()[0]["id"]

    # Contributor CAN create tasks
    task_res = client.post(
        "/api/v1/tasks/",
        json={"project_id": project_id, "title": "Contributor Task", "status": "todo", "priority": "medium"},
        headers=headers,
    )
    assert task_res.status_code == 201

    # Contributor CANNOT resolve conflicts
    conflicts_res = client.get(f"/api/v1/projects/{project_id}/conflicts/")
    assert conflicts_res.status_code == 200
    conflicts = conflicts_res.json()
    if conflicts:
        conflict_id = conflicts[0]["id"]
        resolve_res = client.patch(
            f"/api/v1/conflicts/{conflict_id}",
            json={"status": "resolved", "resolution_notes": "Trying to resolve"},
            headers=headers,
        )
        assert resolve_res.status_code == 403
        assert "requires 'project_owner' or 'admin'" in resolve_res.json()["detail"]


def test_demo_user_role_and_cannot_escalate(client):
    # 1. Login with demo-login
    res = client.post("/api/v1/auth/demo-login")
    assert res.status_code == 200
    demo_data = res.json()
    assert demo_data["user"]["username"] == "demojudge"
    assert demo_data["user"]["email"] == "demo@threadline.io"
    assert demo_data["user"]["role"] == "project_owner"
    demo_token = demo_data["access_token"]
    demo_user_id = demo_data["user"]["id"]

    # 2. Verify /me endpoint
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {demo_token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["username"] == "demojudge"
    assert me_data["role"] == "project_owner"

    # 3. Attempt to escalate role to admin using demo token -> MUST FAIL (403 Forbidden)
    patch_role_res = client.patch(
        f"/api/v1/auth/users/{demo_user_id}/role",
        json={"role": "admin"},
        headers={"Authorization": f"Bearer {demo_token}"},
    )
    assert patch_role_res.status_code == 403
    assert "Only administrators can change user roles" in patch_role_res.json()["detail"]

    # 4. Confirm role remains project_owner
    me_res_after = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {demo_token}"},
    )
    assert me_res_after.status_code == 200
    assert me_res_after.json()["role"] == "project_owner"


