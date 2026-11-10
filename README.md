# Threadline

**Project Knowledge, Without a Break.**

Threadline is an AI-powered knowledge handover platform designed to help teams preserve project knowledge when a member leaves.

## Core Workflow

Connect → Reconstruct → Verify → Review → Handover

## Core Features

- Project workspace and activity tracking
- Document ingestion (PDF & DOCX)
- AI-powered knowledge extraction with evidence citations
- Decisions (ADRs), tasks, ownership, and risk identification
- Human review and approval queue
- Relational knowledge continuity graph
- Automated handover report generation (interactive & PDF export)

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Python 3.12, FastAPI, SQLAlchemy, Alembic, Uvicorn
- **Database**: SQLite (local development) / PostgreSQL (production)
- **AI Engine**: LLM API with structured outputs (Gemini / OpenAI)

## Repository Structure

- `frontend/` — React SPA web application
- `backend/` — FastAPI application and pipeline (see [backend/README.md](backend/README.md))
- `scripts/` — Cross-platform process and test launcher utilities
- `docs/` — Architecture and API documentation
- `sample-data/` — Synthetic demonstration documents and RFCs

---

## Development Setup

### First-Time Setup

```powershell
# 1. Install root development dependencies (concurrently)
npm install

# 2. Install frontend dependencies
npm --prefix frontend install

# 3. Set up backend virtual environment & dependencies
cd backend
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\pip install -r requirements.txt
# On macOS / Linux:
# ./.venv/bin/pip install -r requirements.txt
cd ..
```

### Start the Entire Application (One Command)

From the project root:

```powershell
npm run dev
```

This starts both the FastAPI backend and Vite frontend simultaneously with unified logging and coordinated graceful shutdown.

### Expected Local Addresses

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive API Docs (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc API Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### Development Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts both backend (FastAPI on 127.0.0.1:8000) and frontend (Vite on 5173) |
| `npm run dev:backend` | Starts FastAPI standalone using the existing `.venv` Python executable |
| `npm run dev:frontend` | Starts the Vite development server standalone |
| `npm run build` | Builds the frontend production bundle (`tsc -b && vite build`) |
| `npm run lint` | Runs frontend linting via `oxlint` |
| `npm run test:backend` | Runs the full 68-test backend test suite via `pytest` |

---

## Production Deployment Architecture

Production deployment operates independently of the local development runner:

- **Frontend**: Hosted on **Vercel**
  - Build command: `npm --prefix frontend run build` (or in frontend directory: `npm run build`)
  - Output directory: `frontend/dist`
  - Environment variable: `VITE_API_URL` pointing to the deployed backend URL
- **Backend**: Hosted on **Render**
  - Release command: `alembic upgrade head` (from `backend/` directory)
  - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  - Python version: 3.12
- **Database**: **PostgreSQL** hosted on Render or Supabase
  - Configured via `DATABASE_URL`

---

## Project Status

Under development for CodersInPune Hackathon Round 2.
