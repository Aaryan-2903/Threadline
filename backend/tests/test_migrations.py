import os
import subprocess
import sys
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_engine_options, init_db
from app.models.activity import Activity
from app.models.decision import Decision
from app.models.document import Document
from app.models.extracted_knowledge import ExtractedKnowledge, KnowledgeCategory, VerificationStatus
from app.models.project import Project, ProjectStatus
from app.models.report import HandoverReport
from app.models.task import Task, TaskPriority, TaskStatus


EXPECTED_TABLES = {
    "projects",
    "tasks",
    "decisions",
    "activities",
    "documents",
    "extracted_knowledge",
    "handover_reports",
    "alembic_version",
}


@pytest.fixture
def alembic_config_factory(tmp_path):
    """Factory fixture to create an Alembic Config pointing to a disposable SQLite database."""
    backend_dir = Path(__file__).resolve().parent.parent
    ini_path = backend_dir / "alembic.ini"

    def _factory(db_filename="migration_test.db"):
        db_path = tmp_path / db_filename
        db_url = f"sqlite:///{db_path}"
        cfg = Config(str(ini_path))
        cfg.set_main_option("sqlalchemy.url", db_url)
        return cfg, db_url, db_path

    return _factory


def test_fresh_sqlite_database_created_using_migrations(alembic_config_factory):
    """
    Verify that a fresh SQLite database can be created from scratch using Alembic migrations,
    and all expected tables, columns, indexes, and foreign keys exist.
    """
    cfg, db_url, _ = alembic_config_factory("fresh_db.db")

    # Run migration upgrade to head
    command.upgrade(cfg, "head")

    engine = create_engine(db_url, **get_engine_options(db_url))
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        assert EXPECTED_TABLES.issubset(tables), f"Missing tables: {EXPECTED_TABLES - tables}"

        # Verify alembic_version has the recorded head revision
        with engine.connect() as conn:
            rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
            assert rev is not None
            assert len(rev) > 0

        # Verify projects table structure & indexes
        project_cols = {col["name"] for col in inspector.get_columns("projects")}
        assert {"id", "name", "description", "status", "created_at", "updated_at"}.issubset(project_cols)
        project_indexes = {idx["name"] for idx in inspector.get_indexes("projects")}
        assert "ix_projects_name" in project_indexes
        assert "ix_projects_id" in project_indexes

        # Verify tasks table foreign keys
        task_fks = inspector.get_foreign_keys("tasks")
        assert len(task_fks) >= 1
        assert any(
            fk["referred_table"] == "projects"
            and fk["referred_columns"] == ["id"]
            and fk["options"].get("ondelete") == "CASCADE"
            for fk in task_fks
        )

        # Verify extracted_knowledge table foreign keys
        ek_fks = inspector.get_foreign_keys("extracted_knowledge")
        referred_tables = {fk["referred_table"] for fk in ek_fks}
        assert "documents" in referred_tables
        assert "projects" in referred_tables

    finally:
        engine.dispose()


def test_migration_downgrade_and_reupgrade_cycle(alembic_config_factory):
    """
    Verify that migrating up, downgrading to base, and re-migrating to head
    executes cleanly without leaving dangling artifacts or errors.
    """
    cfg, db_url, _ = alembic_config_factory("cycle_db.db")

    # 1. Upgrade to head
    command.upgrade(cfg, "head")
    engine = create_engine(db_url, **get_engine_options(db_url))
    try:
        inspector = inspect(engine)
        assert "projects" in inspector.get_table_names()
        assert "tasks" in inspector.get_table_names()
    finally:
        engine.dispose()

    # 2. Downgrade to base
    command.downgrade(cfg, "base")
    engine = create_engine(db_url, **get_engine_options(db_url))
    try:
        inspector = inspect(engine)
        remaining_app_tables = set(inspector.get_table_names()) - {"alembic_version"}
        assert len(remaining_app_tables) == 0, f"Tables remained after downgrade: {remaining_app_tables}"
    finally:
        engine.dispose()

    # 3. Upgrade to head again
    command.upgrade(cfg, "head")
    engine = create_engine(db_url, **get_engine_options(db_url))
    try:
        inspector = inspect(engine)
        assert EXPECTED_TABLES.issubset(set(inspector.get_table_names()))
    finally:
        engine.dispose()


def test_foreign_keys_and_cascades_enforced_in_migrated_db(alembic_config_factory):
    """
    Verify that SQLite PRAGMA foreign_keys=ON is active and cascading deletes
    operate properly in a database initialized via migrations.
    """
    import uuid

    cfg, db_url, _ = alembic_config_factory("fk_test.db")
    command.upgrade(cfg, "head")

    engine = create_engine(db_url, **get_engine_options(db_url))
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # 1. Foreign key constraint enforcement: inserting task with non-existent project_id fails
        orphan_task = Task(
            project_id=uuid.uuid4(),
            title="Orphan Task",
            status=TaskStatus.TODO,
            priority=TaskPriority.MEDIUM,
        )
        session.add(orphan_task)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

        # 2. Cascade delete enforcement: deleting project cascades to tasks, decisions, reports
        project = Project(name="Cascade Test Project")
        session.add(project)
        session.commit()

        task = Task(
            project_id=project.id,
            title="Child Task",
            status=TaskStatus.TODO,
            priority=TaskPriority.HIGH,
        )
        decision = Decision(
            project_id=project.id,
            title="Child Decision",
        )
        report = HandoverReport(
            project_id=project.id,
            title="Child Report",
            content_json="{}",
        )
        session.add_all([task, decision, report])
        session.commit()

        # Verify child records exist
        assert session.query(Task).filter(Task.project_id == project.id).count() == 1
        assert session.query(Decision).filter(Decision.project_id == project.id).count() == 1
        assert session.query(HandoverReport).filter(HandoverReport.project_id == project.id).count() == 1

        # Delete parent project and verify cascade
        session.delete(project)
        session.commit()

        assert session.query(Task).filter(Task.project_id == project.id).count() == 0
        assert session.query(Decision).filter(Decision.project_id == project.id).count() == 0
        assert session.query(HandoverReport).filter(HandoverReport.project_id == project.id).count() == 0

    finally:
        session.close()
        engine.dispose()


def test_cli_migration_execution_from_backend_working_directory(tmp_path):
    """
    Verify that alembic CLI commands run cleanly from the backend working directory
    using python -m alembic.
    """
    backend_dir = Path(__file__).resolve().parent.parent
    db_path = tmp_path / "cli_test.db"
    db_url = f"sqlite:///{db_path}"

    env = os.environ.copy()
    env["DATABASE_URL"] = db_url

    # Run upgrade head via CLI
    res_up = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(backend_dir),
        env=env,
        capture_output=True,
        text=True,
    )
    assert res_up.returncode == 0, f"Alembic upgrade failed: {res_up.stderr}"
    assert "Running upgrade" in res_up.stderr or "Running upgrade" in res_up.stdout

    # Run current via CLI
    res_curr = subprocess.run(
        [sys.executable, "-m", "alembic", "current"],
        cwd=str(backend_dir),
        env=env,
        capture_output=True,
        text=True,
    )
    assert res_curr.returncode == 0, f"Alembic current failed: {res_curr.stderr}"
    assert "head" in res_curr.stdout or "head" in res_curr.stderr

    # Run downgrade base via CLI
    res_down = subprocess.run(
        [sys.executable, "-m", "alembic", "downgrade", "base"],
        cwd=str(backend_dir),
        env=env,
        capture_output=True,
        text=True,
    )
    assert res_down.returncode == 0, f"Alembic downgrade failed: {res_down.stderr}"
    assert "Running downgrade" in res_down.stderr or "Running downgrade" in res_down.stdout


def test_init_db_initialization_remains_compatible(tmp_path, monkeypatch):
    """
    Verify that init_db() and Base.metadata.create_all() remain fully compatible
    for development and test environments.
    """
    from app.core.config import settings

    test_db = tmp_path / "init_db_test.db"
    test_url = f"sqlite:///{test_db}"
    monkeypatch.setattr(settings, "DATABASE_URL", test_url)

    engine = create_engine(test_url, **get_engine_options(test_url))
    monkeypatch.setattr("app.database.engine", engine)

    # Calling init_db() creates tables cleanly
    init_db()

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert {"projects", "tasks", "decisions", "activities", "documents", "extracted_knowledge", "handover_reports"}.issubset(tables)

    engine.dispose()

