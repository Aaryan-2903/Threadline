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
│   │   │   ├── projects.py       # Project routes + nested task, decision & timeline endpoints
│   │   │   ├── tasks.py          # Standalone task route handlers (CRUD & filtering)
│   │   │   ├── decisions.py      # Standalone decision route handlers (CRUD)
│   │   │   └── activities.py     # System-wide and project activity timeline handlers
│   │   └── __init__.py
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py             # Pydantic Settings & environment variable configuration
│   ├── models/
│   │   ├── __init__.py
│   │   ├── project.py            # SQLAlchemy Project ORM model with cascade relationships
│   │   ├── task.py               # SQLAlchemy Task ORM model (status, priority, assignee)
│   │   ├── decision.py           # SQLAlchemy Decision ORM model (rationale, decided_by)
│   │   └── activity.py           # SQLAlchemy Activity ORM model (event_type, timeline)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── project.py            # Pydantic schemas (ProjectCreate, ProjectUpdate, ProjectResponse)
│   │   ├── task.py               # Pydantic schemas (TaskCreate, TaskUpdate, TaskResponse)
│   │   ├── decision.py           # Pydantic schemas (DecisionCreate, DecisionUpdate, DecisionResponse)
│   │   └── activity.py           # Pydantic schema (ActivityResponse)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── project_service.py    # Database business logic for projects
│   │   ├── task_service.py       # Task business logic & activity event triggers
│   │   ├── decision_service.py   # Decision business logic & activity event triggers
│   │   └── activity_service.py   # Activity timeline recording & retrieval
│   ├── __init__.py
│   ├── database.py               # Engine, SessionLocal, Base, get_db dependency, init_db, SQLite pragmas
│   └── main.py                   # FastAPI app instance, lifespan table creation, CORS, routers
├── tests/
│   ├── __init__.py
│   ├── conftest.py               # Test configuration & isolated SQLite in-memory fixtures
│   ├── test_projects.py          # Project management test suite (15 tests)
│   ├── test_tasks.py             # Task management test suite (16 tests)
│   ├── test_decisions.py         # Decision records test suite (14 tests)
│   └── test_activities.py        # Activity timeline & cascading test suite (10 tests)
├── requirements.txt              # Dependencies (including psycopg, SQLAlchemy, FastAPI, pytest)
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
- **Automated Startup Table Creation**: During application startup, `init_db()` is executed within FastAPI's lifespan event to ensure all database tables (`projects`, `tasks`, `decisions`, `activities`) are created automatically for this MVP.
- **SQLite Foreign Keys**: Foreign key constraints are automatically enabled in SQLite via `PRAGMA foreign_keys=ON;`.

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

## Database Migrations (Alembic)

Threadline uses **Alembic** to manage schema migrations across SQLite (local development) and PostgreSQL (production).

All migration commands should be run from the `backend/` working directory with the virtual environment activated:

```powershell
cd backend
```

### Common Migration Commands

- **Apply all pending migrations to the database:**
  ```powershell
  alembic upgrade head
  ```
- **Check current database revision:**
  ```powershell
  alembic current
  ```
- **View migration history:**
  ```powershell
  alembic history --verbose
  ```
- **Roll back the most recent migration:**
  ```powershell
  alembic downgrade -1
  ```
- **Roll back all migrations to empty base:**
  ```powershell
  alembic downgrade base
  ```
- **Generate a new migration revision (after modifying SQLAlchemy models):**
  ```powershell
  alembic revision --autogenerate -m "describe_changes"
  ```

### Target Environment Configuration

Alembic resolves the target database URL dynamically from the `DATABASE_URL` environment variable or `app.core.config.settings.DATABASE_URL` without hardcoding credentials:

- **Local SQLite (default)**: `alembic upgrade head` applies migrations to `sqlite:///./threadline.db`.
- **Production PostgreSQL**: Provide the `DATABASE_URL` connection string:
  ```bash
  DATABASE_URL="postgresql+psycopg://user:password@host:port/dbname" alembic upgrade head
  ```

> [!NOTE]
> In local development and automated test runs, `init_db()` is also executed on startup as a fallback to ensure fresh development databases work out of the box. For production deployments, execute `alembic upgrade head` during deployment build/release phases.

---

## API Documentation

All routes are mounted under `/api/v1`.

### 1. Project Management

- `POST /api/v1/projects/` — Create a project (`201 Created`)
- `GET /api/v1/projects/` — List all projects (`200 OK`, newest first)
- `GET /api/v1/projects/{project_id}` — Retrieve single project (`200 OK` or `404 Not Found`)
- `PATCH /api/v1/projects/{project_id}` — Update project name, description or status (`200 OK` or `404`)
- `DELETE /api/v1/projects/{project_id}` — Delete project and cascade-delete child tasks, decisions, and activities (`204 No Content` or `404`)

---

### 2. Task Management

Tasks can be created and listed either nested under a project or via top-level task endpoints.

#### Create Task
- **Methods & Paths**:
  - `POST /api/v1/projects/{project_id}/tasks`
  - `POST /api/v1/tasks/` (requires `project_id` in request body)
- **Status Code**: `201 Created`
- **Request Body**:
  ```json
  {
    "title": "Set up database migrations",
    "description": "Configure Alembic and base schemas",
    "status": "todo",
    "priority": "high",
    "assignee": "Alice",
    "due_date": "2026-12-01T12:00:00Z"
  }
  ```
  *Allowed status values*: `todo`, `in_progress`, `done`, `blocked` (default: `todo`).
  *Allowed priority values*: `low`, `medium`, `high`, `urgent` (default: `medium`).
  *Validation*: `title` is required, non-blank, max 200 characters. Target project must exist.
- **Activity Trigger**: Automatically records a `task_created` event on the project activity timeline.

#### List Tasks
- **Methods & Paths**:
  - `GET /api/v1/projects/{project_id}/tasks`
  - `GET /api/v1/tasks/?project_id={project_id}&status={status}&priority={priority}&skip=0&limit=100`
- **Status Code**: `200 OK`

#### Retrieve Task
- **Method & Path**: `GET /api/v1/tasks/{task_id}`
- **Status Code**: `200 OK` (or `404 Not Found`)

#### Update Task
- **Method & Path**: `PATCH /api/v1/tasks/{task_id}`
- **Status Code**: `200 OK` (or `404 Not Found`)
- **Request Body** (all fields optional):
  ```json
  {
    "status": "in_progress",
    "priority": "urgent"
  }
  ```
- **Activity Triggers**:
  - When status changes: records a `task_status_changed` event (`"Task '...' status changed from 'todo' to 'in_progress'"`).
  - When other fields change: records a `task_updated` event (`"Task '...' was updated"`).
  - When update makes no changes: avoids creating duplicate activity records.

#### Delete Task
- **Method & Path**: `DELETE /api/v1/tasks/{task_id}`
- **Status Code**: `204 No Content` (or `404 Not Found`)
- **Activity Trigger**: Records a `task_deleted` event on the timeline.

---

### 3. Decision Records

Document architectural, organizational, and operational decisions taken throughout a project.

#### Create Decision
- **Methods & Paths**:
  - `POST /api/v1/projects/{project_id}/decisions`
  - `POST /api/v1/decisions/` (requires `project_id` in request body)
- **Status Code**: `201 Created`
- **Request Body**:
  ```json
  {
    "title": "Use PostgreSQL for production persistence",
    "description": "Selected PostgreSQL with psycopg 3 for production stability.",
    "rationale": "High reliability, JSONB capabilities, and native UUID support.",
    "decided_by": "Architecture Guild",
    "decision_date": "2026-11-09T12:00:00Z"
  }
  ```
  *Validation*: `title` is required, non-blank, max 200 characters. Target project must exist.
- **Activity Trigger**: Automatically records a `decision_created` event.

#### List Decisions
- **Methods & Paths**:
  - `GET /api/v1/projects/{project_id}/decisions`
  - `GET /api/v1/decisions/?project_id={project_id}&skip=0&limit=100`
- **Status Code**: `200 OK` (ordered newest decision date first)

#### Retrieve Decision
- **Method & Path**: `GET /api/v1/decisions/{decision_id}`
- **Status Code**: `200 OK` (or `404 Not Found`)

#### Update Decision
- **Method & Path**: `PATCH /api/v1/decisions/{decision_id}`
- **Status Code**: `200 OK` (or `404 Not Found`)
- **Activity Trigger**: Records a `decision_updated` event when fields change.

#### Delete Decision
- **Method & Path**: `DELETE /api/v1/decisions/{decision_id}`
- **Status Code**: `204 No Content` (or `404 Not Found`)
- **Activity Trigger**: Records a `decision_deleted` event.

---

### 4. Project Activity Timeline

Chronologically track key project events including task creation, task updates, status transitions, and decision records.

#### Endpoints
- `GET /api/v1/projects/{project_id}/activities` — Project activity timeline
- `GET /api/v1/projects/{project_id}/timeline` — Timeline alias
- `GET /api/v1/activities/?project_id={project_id}` — Global activity query endpoint

#### Query Parameters
- `order` (optional, default: `"desc"`): Sort order by timestamp (`"desc"` for newest first, `"asc"` for chronological order).
- `skip` (optional, default: `0`): Pagination offset.
- `limit` (optional, default: `100`, max: `500`): Maximum items returned.

#### Response Structure
```json
[
  {
    "id": "e2f08a54-71bb-48f8-b39b-e85df6495db3",
    "project_id": "74ac0f3f-68ea-49db-ba94-8d7250cb21ab",
    "event_type": "task_status_changed",
    "description": "Task 'Set up database migrations' status changed from 'todo' to 'in_progress'",
    "actor": "Alice",
    "entity_type": "task",
    "entity_id": "5cb89262-6da5-4be4-b892-e421528659b7",
    "timestamp": "2026-11-09T12:30:00Z"
  },
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "project_id": "74ac0f3f-68ea-49db-ba94-8d7250cb21ab",
    "event_type": "decision_created",
    "description": "Decision 'Use PostgreSQL for production persistence' was recorded",
    "actor": "Architecture Guild",
    "entity_type": "decision",
    "entity_id": "89ab12cd-ef34-5678-90ab-cdef12345678",
    "timestamp": "2026-11-09T12:00:00Z"
  }
]
```

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

### Test Suite Summary (55 Tests Passing)
- `test_projects.py` (15 tests): Project CRUD, validation, 404s, newest-first ordering, preserved root and health endpoints.
- `test_tasks.py` (16 tests): Task creation (nested and top-level), project validation (404 on ghost project), blank and max-length title validation, invalid status/priority validation (422), task retrieval, filtering by status and priority, patching fields, status updates, 404s on nonexistent tasks, task deletion.
- `test_decisions.py` (14 tests): Decision creation, project validation, rationale, decided_by, decision_date default and explicit values, title validation, decision retrieval, updates, 404s, decision deletion.
- `test_activities.py` (10 tests): `task_created`, `task_status_changed`, `task_updated`, `task_deleted`, `decision_created`, `decision_updated`, `decision_deleted` activity events; duplicate activity avoidance on zero-change updates; ascending and descending timeline ordering; timeline alias endpoint; 404 on nonexistent project; cascading deletion of child tasks, decisions, and activities on project delete.
