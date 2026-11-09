# Threadline Backend

The backend for Threadline, an AI-powered project knowledge handover platform. Built with Python 3.12, FastAPI, SQLAlchemy, and Pydantic.

---

## Architecture & Code Structure

The backend follows a modular, layered architecture keeping database and business logic decoupled from API route handlers:

```text
backend/
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   └── projects.py       # Project route handlers (POST, GET, PATCH, DELETE)
│   │   └── __init__.py
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py             # Pydantic Settings & environment variable configuration
│   ├── models/
│   │   ├── __init__.py
│   │   └── project.py            # SQLAlchemy Project ORM model
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── project.py            # Pydantic schemas (ProjectCreate, ProjectUpdate, ProjectResponse)
│   ├── services/
│   │   ├── __init__.py
│   │   └── project_service.py    # Database business logic & query operations
│   ├── __init__.py
│   ├── database.py               # Engine, SessionLocal, Base, get_db dependency, init_db
│   └── main.py                   # FastAPI app instance, lifespan table creation, CORS, routers
├── tests/
│   ├── __init__.py
│   ├── conftest.py               # Test configuration & isolated SQLite in-memory fixtures
│   └── test_projects.py          # Automated pytest test suite
├── requirements.txt              # Production and development dependencies
└── README.md                     # Backend setup & API documentation
```

---

## Requirements

- Python 3.12+
- PostgreSQL (recommended for production) or SQLite (for local development and testing)

---

## Environment Variables

Configuration is loaded from environment variables or a `.env` file located in `backend/` or the repository root:

| Variable | Type | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | String | `sqlite:///./threadline.db` | SQLAlchemy connection string. Supports PostgreSQL (`postgresql+psycopg://...` or `postgresql://...`) and SQLite (`sqlite:///...`). |
| `FRONTEND_URL` | String | `http://localhost:5173` | Allowed origin for CORS requests. |
| `API_V1_STR` | String | `/api/v1` | URL prefix for API v1 endpoints. |
| `PROJECT_NAME` | String | `Threadline API` | Application title reported in OpenAPI docs. |

### Database Connectivity Details
- **Local Development**: If `DATABASE_URL` is omitted or empty, the application automatically defaults to a local SQLite database (`sqlite:///./threadline.db`), allowing zero-configuration setup.
- **Production (PostgreSQL)**: When using PostgreSQL with psycopg 3, set `DATABASE_URL=postgresql+psycopg://user:password@host:port/dbname`. (Standard `postgresql://` connection strings are also automatically adapted for psycopg 3 compatibility).
- **Automated Startup Table Creation**: During application startup, `init_db()` is executed within FastAPI's lifespan event to ensure all database tables are created automatically for this MVP.

---

## Setup & Local Development

### 1. Create and Activate a Virtual Environment

On Windows (PowerShell):
```powershell
python -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
```

On macOS / Linux:
```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

### 3. Run the Development Server

Navigate to the `backend/` directory and start Uvicorn:

```powershell
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or from the repository root:
```powershell
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

Once running, interactive OpenAPI API docs are available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Project Management API

All project management endpoints are mounted under `/api/v1/projects`:

### 1. Create a Project
- **Method**: `POST`
- **Path**: `/api/v1/projects/`
- **Status Code**: `201 Created`
- **Request Body**:
  ```json
  {
    "name": "Project Threadline",
    "description": "Knowledge handover platform",
    "status": "active"
  }
  ```
  *Validation*: `name` is required, maximum 120 characters, non-blank (empty or whitespace-only strings are rejected with `422 Unprocessable Entity`). `status` defaults to `"active"` (`"active"` or `"archived"`). `description` is optional.
- **Response**:
  ```json
  {
    "id": "74ac0f3f-68ea-49db-ba94-8d7250cb21ab",
    "name": "Project Threadline",
    "description": "Knowledge handover platform",
    "status": "active",
    "created_at": "2026-11-09T12:00:00Z",
    "updated_at": "2026-11-09T12:00:00Z"
  }
  ```

### 2. List All Projects
- **Method**: `GET`
- **Path**: `/api/v1/projects/`
- **Query Parameters**:
  - `skip` (optional, default: `0`): Number of items to skip.
  - `limit` (optional, default: `100`, max: `500`): Maximum items to return.
- **Status Code**: `200 OK`
- **Ordering**: Returns projects ordered **newest first** (`created_at` descending).
- **Response**:
  ```json
  [
    {
      "id": "74ac0f3f-68ea-49db-ba94-8d7250cb21ab",
      "name": "Project Threadline",
      "description": "Knowledge handover platform",
      "status": "active",
      "created_at": "2026-11-09T12:00:00Z",
      "updated_at": "2026-11-09T12:00:00Z"
    }
  ]
  ```

### 3. Retrieve a Single Project
- **Method**: `GET`
- **Path**: `/api/v1/projects/{project_id}`
- **Status Code**: `200 OK` (or `404 Not Found` if project does not exist)
- **Response**:
  ```json
  {
    "id": "74ac0f3f-68ea-49db-ba94-8d7250cb21ab",
    "name": "Project Threadline",
    "description": "Knowledge handover platform",
    "status": "active",
    "created_at": "2026-11-09T12:00:00Z",
    "updated_at": "2026-11-09T12:00:00Z"
  }
  ```

### 4. Update a Project
- **Method**: `PATCH`
- **Path**: `/api/v1/projects/{project_id}`
- **Status Code**: `200 OK` (or `404 Not Found` if project does not exist)
- **Request Body** (all fields optional):
  ```json
  {
    "name": "Updated Project Name",
    "description": "Updated project description",
    "status": "archived"
  }
  ```
  *Validation*: If `name` is provided, it cannot be blank or exceed 120 characters. Untouched fields are preserved.
- **Response**: Returns the updated `ProjectResponse`.

### 5. Delete a Project
- **Method**: `DELETE`
- **Path**: `/api/v1/projects/{project_id}`
- **Status Code**: `204 No Content` (or `404 Not Found` if project does not exist)

---

## Health & Root Endpoints

- `GET /` — Returns service status `{"message": "Welcome to Threadline API", "status": "running"}`
- `GET /health` — Health check endpoint returning `{"status": "healthy"}`

---

## Running Automated Tests

The test suite runs against an isolated SQLite in-memory database (`sqlite:///:memory:` with `StaticPool`), ensuring production and local file data are never touched.

### Command to Run Tests

From the repository root:
```powershell
python -m pytest backend/tests -v
```

Or from the `backend/` directory:
```powershell
cd backend
pytest -v
```

### Test Suite Coverage
- `test_root_and_health_endpoints`: Verifies `/` and `/health` endpoints are preserved and working.
- `test_create_project_success`: Validates successful creation of projects with UUID, timestamps, and active status.
- `test_create_project_default_status`: Verifies default status is `"active"`.
- `test_create_project_archived_status`: Verifies explicit `"archived"` status.
- `test_create_project_blank_name_rejected`: Tests rejection of empty, whitespace-only, and missing project names.
- `test_create_project_name_exceeds_max_length`: Tests rejection of names exceeding 120 characters.
- `test_list_projects_empty`: Verifies empty list when no projects exist.
- `test_list_projects_ordered_newest_first`: Verifies sorting ordered newest first.
- `test_get_project_success`: Retrieves project by UUID.
- `test_get_project_not_found`: Verifies 404 response on nonexistent UUID.
- `test_update_project_success`: Verifies PATCH updates name, description, and status.
- `test_update_project_blank_name_rejected`: Verifies 422 response when patching with blank name.
- `test_update_project_not_found`: Verifies 404 response when patching nonexistent project.
- `test_delete_project_success`: Verifies 204 No Content and removal of project.
- `test_delete_project_not_found`: Verifies 404 response when deleting nonexistent project.

