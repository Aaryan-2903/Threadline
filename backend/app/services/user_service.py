import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.activity import Activity
from app.models.audit_log import AuditLog
from app.models.conflict import Conflict, ConflictSeverity, ConflictStatus, ConflictType
from app.models.decision import Decision
from app.models.document import Document, DocumentStatus
from app.models.extracted_knowledge import ExtractedKnowledge, KnowledgeCategory, VerificationStatus
from app.models.project import Project, ProjectStatus
from app.models.report import HandoverReport, ReportAcknowledgementStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User, UserRole
from app.schemas.user import UserCreate


def get_user_by_id(db: Session, user_id: UUID) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email.ilike(email.strip())).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username.ilike(username.strip())).first()


def get_user_by_email_or_username(db: Session, identifier: str) -> Optional[User]:
    clean = identifier.strip()
    return db.query(User).filter(
        (User.email.ilike(clean)) | (User.username.ilike(clean))
    ).first()


def create_user(db: Session, user_in: UserCreate, is_demo: bool = False) -> User:
    user = User(
        email=user_in.email.strip().lower(),
        username=user_in.username.strip(),
        hashed_password=hash_password(user_in.password),
        role=UserRole(user_in.role) if user_in.role else UserRole.CONTRIBUTOR,
        is_active=True,
        is_demo=is_demo,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, identifier: str, password: str) -> Optional[User]:
    user = get_user_by_email_or_username(db, identifier)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


def list_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    return db.query(User).order_by(User.created_at.asc()).offset(skip).limit(limit).all()


def update_user_role(db: Session, user_id: UUID, new_role: str) -> Optional[User]:
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    user.role = UserRole(new_role)
    db.commit()
    db.refresh(user)
    return user


def seed_default_users_and_demo(db: Session) -> User:
    """
    Ensure default accounts exist and create a populated demo workspace
    demonstrating Conflict Detection, Sensitive Data Redaction, and Handover Lifecycle.
    Returns the Demo Judge user.
    """
    now = datetime.now(timezone.utc)

    # 1. Seed standard roles
    default_accounts = [
        ("demo@threadline.io", "demojudge", "demo123", UserRole.PROJECT_OWNER, True),
        ("admin@threadline.io", "admin", "admin123", UserRole.ADMIN, False),
        ("contributor@threadline.io", "contributor", "contrib123", UserRole.CONTRIBUTOR, False),
        ("viewer@threadline.io", "viewer", "viewer123", UserRole.VIEWER, False),
    ]

    demo_user = None
    for email, username, pwd, role, is_demo in default_accounts:
        user = get_user_by_email(db, email)
        if not user:
            user = User(
                email=email,
                username=username,
                hashed_password=hash_password(pwd),
                role=role,
                is_active=True,
                is_demo=is_demo,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        if is_demo:
            demo_user = user

    # 2. Check if the demo workspace already exists
    demo_project = db.query(Project).filter(Project.name == "Acme Cloud Platform Migration").first()
    if not demo_project:
        demo_project = Project(
            name="Acme Cloud Platform Migration",
            description="Enterprise database modernization and multi-region Kubernetes migration from legacy on-premise infrastructure.",
            status=ProjectStatus.ACTIVE,
        )
        db.add(demo_project)
        db.commit()
        db.refresh(demo_project)

        # 3. Add Tasks showing assignee & deadline conflicts
        task_db_schema = Task(
            project_id=demo_project.id,
            title="Database Schema Migration to Distributed SQL",
            description="Migrate all 120 relational tables from MySQL to CockroachDB.",
            status=TaskStatus.IN_PROGRESS,
            priority=TaskPriority.HIGH,
            assignee="Dave Miller",
            due_date=now + timedelta(days=14),
        )
        task_conflicting = Task(
            project_id=demo_project.id,
            title="Database Schema Migration to Distributed SQL",
            description="Duplicate task created during sprint planning with conflicting assignee and shorter deadline.",
            status=TaskStatus.TODO,
            priority=TaskPriority.URGENT,
            assignee="Sarah Jenkins",
            due_date=now + timedelta(days=7),
        )
        task_auth = Task(
            project_id=demo_project.id,
            title="Zero Trust Service Mesh Implementation",
            description="Deploy Istio mutual TLS across all Kubernetes service pods.",
            status=TaskStatus.DONE,
            priority=TaskPriority.MEDIUM,
            assignee="Alex Rivera",
            due_date=now - timedelta(days=2),
        )
        db.add_all([task_db_schema, task_conflicting, task_auth])
        db.commit()

        # 4. Add Decisions showing superseded / outdated architectural decisions
        dec_legacy = Decision(
            project_id=demo_project.id,
            title="Adopt Monolithic MySQL for Core Services",
            description="Retain MySQL 8 with read-replicas for core transactions.",
            rationale="Team had 10 years experience; minimized immediate operational risk.",
            decided_by="Marcus Vance (Former VP Eng)",
            decision_date=now - timedelta(days=180),
        )
        dec_modern = Decision(
            project_id=demo_project.id,
            title="Migrate Core Services to CockroachDB Distributed SQL",
            description="Supersedes monolithic MySQL decision. Adopt distributed ACID CockroachDB cluster across 3 availability zones.",
            rationale="High availability requirements and multi-region read latency necessitated a distributed SQL tier. Deprecates MySQL.",
            decided_by="Sarah Jenkins (Principal Architect)",
            decision_date=now - timedelta(days=30),
        )
        db.add_all([dec_legacy, dec_modern])
        db.commit()

        # 5. Add Document with sensitive content for Redaction demonstration
        sensitive_text = (
            "Confidential Handover Credentials & Architecture Notes:\n"
            "Lead Contact: alex.rivera@acmecorp.internal (Phone: +1-415-555-0199)\n"
            "Secondary Escalation: sarah.jenkins@acmecorp.internal (+1-415-555-0842)\n"
            "Staging OpenAI Key: sk-proj-ab9871239847129384712983471928347192837419827341982734\n"
            "Production Cloud API Token: AIzaSyD9874123984712984712938471928374\n"
            "Service Mesh Secret: api_key='prod_mesh_9921478192384719'\n"
            "Note: REST endpoints deprecated in favor of gRPC services."
        )
        demo_doc = Document(
            project_id=demo_project.id,
            filename="Architecture_Security_Handover.pdf",
            file_type="pdf",
            file_size=len(sensitive_text.encode("utf-8")),
            author="Dave Miller",
            status=DocumentStatus.EXTRACTED,
            extracted_claims_count=3,
            page_count=2,
            extracted_text=sensitive_text,
        )
        db.add(demo_doc)
        db.commit()
        db.refresh(demo_doc)

        # 6. Add Extracted Knowledge with contradictory claims
        claim1 = ExtractedKnowledge(
            document_id=demo_doc.id,
            project_id=demo_project.id,
            category=KnowledgeCategory.CONFLICT,
            title="Database Architecture Discrepancy",
            content="Document states MySQL 8 is required for transaction auditing, contradicting active migration to CockroachDB.",
            evidence_snippet="Auditing requirements mandate MySQL 8 binary logs until Q4 compliance sign-off.",
            source_reference="Architecture_Security_Handover.pdf (Page 2)",
            confidence=0.92,
            status=VerificationStatus.APPROVED,
            owner="Compliance Review",
        )
        claim2 = ExtractedKnowledge(
            document_id=demo_doc.id,
            project_id=demo_project.id,
            category=KnowledgeCategory.DECISION,
            title="Istio Mutual TLS Enforcement",
            content="Strict mTLS required for all inter-pod communications.",
            evidence_snippet="Deploy Istio mutual TLS across all Kubernetes service pods.",
            source_reference="Architecture_Security_Handover.pdf (Page 1)",
            confidence=0.95,
            status=VerificationStatus.APPROVED,
            owner="Alex Rivera",
        )
        db.add_all([claim1, claim2])
        db.commit()

        # 7. Add Pre-computed Conflicts showing open & resolved conflict lifecycle
        conflict_task = Conflict(
            project_id=demo_project.id,
            conflict_type=ConflictType.CONFLICTING_ASSIGNEE,
            severity=ConflictSeverity.HIGH,
            title="Conflicting Task Ownership & Deadlines on Schema Migration",
            description="Two active tasks exist with identical scope 'Database Schema Migration to Distributed SQL' assigned to Dave Miller and Sarah Jenkins with different due dates.",
            source_entity_type="task",
            source_entity_id=task_db_schema.id,
            target_entity_type="task",
            target_entity_id=task_conflicting.id,
            evidence_snippet=f"Task A assigned to Dave Miller (due {task_db_schema.due_date.strftime('%Y-%m-%d')}) vs Task B assigned to Sarah Jenkins (due {task_conflicting.due_date.strftime('%Y-%m-%d')})",
            status=ConflictStatus.OPEN,
        )
        conflict_decision = Conflict(
            project_id=demo_project.id,
            conflict_type=ConflictType.SUPERSEDED_DECISION,
            severity=ConflictSeverity.MEDIUM,
            title="Superseded Architectural Decision: MySQL vs CockroachDB",
            description="Decision 'Adopt Monolithic MySQL for Core Services' was superseded by 'Migrate Core Services to CockroachDB Distributed SQL'.",
            source_entity_type="decision",
            source_entity_id=dec_legacy.id,
            target_entity_type="decision",
            target_entity_id=dec_modern.id,
            evidence_snippet="Decided by Sarah Jenkins on 30 days ago explicitly replacing monolithic MySQL with CockroachDB distributed SQL.",
            status=ConflictStatus.RESOLVED,
            resolved_by="Demo Judge (Project Owner)",
            resolution_notes="Confirmed MySQL has been deprecated. CockroachDB is the primary database for all tier-1 microservices.",
            resolved_at=now - timedelta(hours=2),
        )
        db.add_all([conflict_task, conflict_decision])
        db.commit()

        # 8. Add Handover Report with Lifecycle & Acknowledgement Tracking
        report_content = {
            "overview": {
                "project_id": str(demo_project.id),
                "project_name": demo_project.name,
                "description": demo_project.description,
                "generated_at": now.strftime("%Y-%m-%d %H:%M UTC"),
                "project_status": "Active",
                "progress_percentage": 68,
                "outgoing_owner": "Marcus Vance",
                "incoming_owner": "Demo Judge",
                "incoming_owner_role": "Platform Engineering Director",
                "health_score": "Good (85/100)",
                "executive_summary": "Migration from legacy MySQL to CockroachDB is 68% complete. Istio service mesh deployed. One critical assignee conflict requires resolution prior to cutover."
            },
            "status": {
                "total_tasks": 3,
                "completed_tasks": 1,
                "pending_tasks": 2,
                "blocked_tasks": 0,
                "decisions_count": 2,
                "risks_count": 1,
                "documents_count": 1,
                "approved_claims_count": 2,
                "rejected_claims_count": 0,
                "pending_claims_count": 0
            },
            "decisions": [
                {
                    "id": str(dec_modern.id),
                    "title": dec_modern.title,
                    "rationale": dec_modern.rationale,
                    "decided_by": dec_modern.decided_by,
                    "decision_date": dec_modern.decision_date.strftime("%Y-%m-%d"),
                    "verified": True
                }
            ],
            "completed_work": [
                {
                    "id": str(task_auth.id),
                    "title": task_auth.title,
                    "status": "done",
                    "priority": "medium",
                    "assignee": task_auth.assignee
                }
            ],
            "pending_and_blocked_tasks": [
                {
                    "id": str(task_db_schema.id),
                    "title": task_db_schema.title,
                    "status": "in_progress",
                    "priority": "high",
                    "assignee": task_db_schema.assignee,
                    "due_date": task_db_schema.due_date.strftime("%Y-%m-%d")
                }
            ],
            "ownership_matrix": [
                {
                    "name": "Marcus Vance",
                    "role": "Outgoing Project Owner",
                    "assigned_tasks_count": 0,
                    "decisions_signed_count": 1,
                    "handover_status": "Outgoing sign-off initiated"
                },
                {
                    "name": "Demo Judge",
                    "role": "Incoming Owner",
                    "assigned_tasks_count": 0,
                    "decisions_signed_count": 0,
                    "handover_status": "Pending Acknowledgement"
                }
            ],
            "risks_and_blockers": [
                {
                    "id": str(uuid.uuid4()),
                    "title": "MySQL Audit Log Compliance Gap",
                    "severity": "Medium",
                    "evidence_snippet": "Binary logging compliance sign-off needed before MySQL shutdown.",
                    "verified": True
                }
            ],
            "dependencies": [],
            "open_questions": [],
            "recommended_next_actions": [
                {
                    "action": "Resolve database schema migration task duplicate assignee",
                    "priority": "High",
                    "target_owner": "Demo Judge",
                    "suggested_timeframe": "Week 1",
                    "is_inferred": False
                }
            ],
            "source_documents": [
                {
                    "id": str(demo_doc.id),
                    "filename": demo_doc.filename,
                    "file_type": demo_doc.file_type,
                    "file_size": demo_doc.file_size,
                    "author": demo_doc.author,
                    "page_count": demo_doc.page_count,
                    "extracted_claims_count": demo_doc.extracted_claims_count
                }
            ]
        }

        handover = HandoverReport(
            project_id=demo_project.id,
            title="Executive Handover Report: Cloud Platform Modernization",
            summary="Formal knowledge transfer package for Acme Cloud Platform Migration.",
            status="generated",
            content_json=json.dumps(report_content),
            generated_by="Marcus Vance",
            version=1,
            outgoing_owner="Marcus Vance",
            incoming_owner="Demo Judge",
            incoming_owner_role="Platform Engineering Director",
            acknowledgement_status=ReportAcknowledgementStatus.PENDING,
            sent_at=now - timedelta(days=1),
        )
        db.add(handover)
        db.commit()

        # 9. Add Initial Audit Logs
        db.add_all([
            AuditLog(
                user_id=demo_user.id if demo_user else None,
                username="demojudge",
                user_role="project_owner",
                project_id=demo_project.id,
                action="demo_workspace_initialized",
                details="Populated Acme Cloud Platform Migration sample workspace.",
                timestamp=now - timedelta(days=2),
            ),
            AuditLog(
                user_id=demo_user.id if demo_user else None,
                username="marcus.vance",
                user_role="project_owner",
                project_id=demo_project.id,
                action="handover_sent",
                resource_type="handover_report",
                resource_id=handover.id,
                details="Transferred project ownership and requested formal acknowledgement from Demo Judge.",
                timestamp=now - timedelta(days=1),
            ),
            AuditLog(
                user_id=demo_user.id if demo_user else None,
                username="demojudge",
                user_role="project_owner",
                project_id=demo_project.id,
                action="conflict_resolved",
                resource_type="conflict",
                resource_id=conflict_decision.id,
                details="Resolved superseded decision: MySQL deprecated in favor of CockroachDB.",
                timestamp=now - timedelta(hours=2),
            )
        ])
        db.commit()

    return demo_user

