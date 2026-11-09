from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings


def get_engine_args(url: str) -> dict:
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return connect_args


engine = create_engine(
    settings.DATABASE_URL,
    connect_args=get_engine_args(settings.DATABASE_URL),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Reusable database session dependency for FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create database tables automatically during application startup for MVP."""
    import app.models  # noqa: F401 - ensure models are registered with Base metadata
    Base.metadata.create_all(bind=engine)

