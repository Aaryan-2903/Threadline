# Threadline

**Project Knowledge, Without a Break.**

Threadline is an AI-powered knowledge handover platform designed to help teams preserve project knowledge when a member leaves.

## Core Workflow

Connect → Reconstruct → Verify → Review → Handover

## Core Features

- Project workspace and activity tracking
- Document ingestion
- AI-powered knowledge extraction
- Decisions, tasks, ownership and risk identification
- Evidence-linked project information
- Human review and approval
- Automated handover generation

## Technology Stack

- Frontend: React, TypeScript, Vite
- Backend: Python, FastAPI
- Database: PostgreSQL
- AI: LLM API with structured outputs

## Repository Structure

- `frontend/` — Web application
- `backend/` — API and processing pipeline (see [backend/README.md](backend/README.md) for API setup, endpoints & tests)
- `docs/` — Architecture and API documentation
- `sample-data/` — Synthetic demonstration data

## Quick Start (Backend)

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Run automated tests:
```bash
python -m pytest backend/tests -v
```

## Project Status

Under development for CodersInPune Hackathon Round 2.