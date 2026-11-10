from typing import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings


def get_engine_args(url: str) -> dict:
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return connect_args


def get_engine_options(url: str) -> dict:
    """
    Construct robust engine options based on the database URL and driver.
    
    - pool_pre_ping=True: Health-checks pooled connections on checkout to gracefully
      recover from dropped or timed-out connections (e.g. Render / AWS PostgreSQL).
    - pool_recycle=300: Recycles connections after 5 minutes to prevent stale TCP sockets.
    - Preserves SQLite compatibility without passing unsupported connection pool arguments.
    """
    options = {
        "pool_pre_ping": True,
    }
    connect_args = get_engine_args(url)

    if url.startswith("sqlite"):
        # Enable pool_recycle for file-based SQLite; omit for in-memory SQLite instances
        if not (url.startswith("sqlite:///:memory:") or url == "sqlite://"):
            options["pool_recycle"] = 300
    else:
        # PostgreSQL / remote RDBMS connection pools
        options["pool_recycle"] = 300

    options["connect_args"] = connect_args
    return options


engine = create_engine(
    settings.DATABASE_URL,
    **get_engine_options(settings.DATABASE_URL),
)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable SQLite foreign key constraints."""
    if type(dbapi_connection).__module__.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


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
