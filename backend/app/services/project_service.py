from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_project(db: Session, project_in: ProjectCreate) -> Project:
    """Create a new project record."""
    project = Project(
        name=project_in.name,
        description=project_in.description,
        status=project_in.status,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_projects(db: Session, skip: int = 0, limit: int = 100) -> List[Project]:
    """Retrieve all projects ordered newest first."""
    return (
        db.query(Project)
        .order_by(Project.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_project_by_id(db: Session, project_id: UUID) -> Optional[Project]:
    """Retrieve a single project by its UUID."""
    return db.query(Project).filter(Project.id == project_id).first()


def update_project(db: Session, project: Project, project_in: ProjectUpdate) -> Project:
    """Update project name, description, or status."""
    update_data = project_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    project.updated_at = utc_now()
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project: Project) -> None:
    """Delete a project record."""
    db.delete(project)
    db.commit()

