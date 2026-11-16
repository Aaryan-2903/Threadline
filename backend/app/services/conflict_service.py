from datetime import datetime, timezone
import re
from typing import List, Optional, Set
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.activity import Activity
from app.models.audit_log import AuditLog
from app.models.conflict import Conflict, ConflictSeverity, ConflictStatus, ConflictType
from app.models.decision import Decision
from app.models.extracted_knowledge import ExtractedKnowledge, KnowledgeCategory
from app.models.project import Project
from app.models.task import Task, TaskStatus
from app.services.audit_service import log_audit_event


def _normalize_title(title: str) -> Set[str]:
    """Tokenize and return significant lowercase words from title."""
    words = re.findall(r"\b[a-zA-Z0-9]{3,}\b", title.lower())
    stop_words = {"the", "and", "for", "with", "all", "our", "new", "from", "into"}
    return {w for w in words if w not in stop_words}


def detect_project_conflicts(db: Session, project_id: UUID, actor: str = "System") -> List[Conflict]:
    """
    Run deterministic conflict detection algorithms across:
    1. Extracted document claims flagged as contradictions or conflicts.
    2. Outdated or superseded architectural decisions.
    3. Conflicting task assignees and impossible/clashing deadlines.

    Preserves already resolved/dismissed conflicts without resetting their status.
    """
    existing_conflicts = db.query(Conflict).filter(Conflict.project_id == project_id).all()
    # Map by (conflict_type, title) and (source_entity_id, target_entity_id) to avoid duplicates
    existing_map = {}
    for c in existing_conflicts:
        existing_map[(c.conflict_type, c.title)] = c
        if c.source_entity_id and c.target_entity_id:
            existing_map[(c.conflict_type, str(c.source_entity_id), str(c.target_entity_id))] = c

    new_conflicts: List[Conflict] = []
    now = datetime.now(timezone.utc)

    # -------------------------------------------------------------
    # 1. Contradictory Claims from Extracted Document Knowledge
    # -------------------------------------------------------------
    claims = db.query(ExtractedKnowledge).filter(
        ExtractedKnowledge.project_id == project_id
    ).all()

    for claim in claims:
        if claim.category == KnowledgeCategory.CONFLICT or "conflict" in claim.title.lower() or "contradict" in claim.title.lower():
            title = f"Contradictory Claim: {claim.title}"
            key = (ConflictType.CONTRADICTORY_CLAIM, title)
            if key not in existing_map:
                c = Conflict(
                    project_id=project_id,
                    conflict_type=ConflictType.CONTRADICTORY_CLAIM,
                    severity=ConflictSeverity.HIGH,
                    title=title,
                    description=claim.content or claim.evidence_snippet or "Contradictory claim extracted from document.",
                    source_entity_type="extracted_knowledge",
                    source_entity_id=claim.id,
                    evidence_snippet=claim.evidence_snippet or claim.source_reference,
                    status=ConflictStatus.OPEN,
                )
                db.add(c)
                new_conflicts.append(c)
                existing_map[key] = c

    # -------------------------------------------------------------
    # 2. Potentially Outdated or Superseded Decisions
    # -------------------------------------------------------------
    decisions = db.query(Decision).filter(Decision.project_id == project_id).order_by(Decision.decision_date.asc()).all()
    supersede_keywords = ["supersede", "supersedes", "deprecated", "deprecates", "replace", "replaces", "migrated from", "modernized"]

    for i in range(len(decisions)):
        for j in range(i + 1, len(decisions)):
            dec_older = decisions[i]
            dec_newer = decisions[j]

            words_older = _normalize_title(dec_older.title)
            words_newer = _normalize_title(dec_newer.title)
            common_words = words_older.intersection(words_newer)

            newer_text = f"{dec_newer.title} {dec_newer.description or ''} {dec_newer.rationale or ''}".lower()
            explicit_supersede = any(k in newer_text for k in supersede_keywords)

            # If they share topics or explicit supersede indicator
            if explicit_supersede or len(common_words) >= 2:
                title = f"Superseded Decision: '{dec_older.title[:40]}' vs '{dec_newer.title[:40]}'"
                key = (ConflictType.SUPERSEDED_DECISION, str(dec_older.id), str(dec_newer.id))
                key2 = (ConflictType.SUPERSEDED_DECISION, title)

                if key not in existing_map and key2 not in existing_map:
                    evidence = f"Older decision '{dec_older.title}' ({dec_older.decided_by or 'Unknown'}) was made on {dec_older.decision_date.strftime('%Y-%m-%d')}. Newer decision '{dec_newer.title}' ({dec_newer.decided_by or 'Unknown'}) was recorded on {dec_newer.decision_date.strftime('%Y-%m-%d')}."
                    c = Conflict(
                        project_id=project_id,
                        conflict_type=ConflictType.SUPERSEDED_DECISION,
                        severity=ConflictSeverity.MEDIUM,
                        title=title,
                        description=f"Newer decision by {dec_newer.decided_by or 'team'} appears to supersede earlier architecture baseline: '{dec_older.title}'.",
                        source_entity_type="decision",
                        source_entity_id=dec_older.id,
                        target_entity_type="decision",
                        target_entity_id=dec_newer.id,
                        evidence_snippet=evidence,
                        status=ConflictStatus.OPEN,
                    )
                    db.add(c)
                    new_conflicts.append(c)
                    existing_map[key] = c

    # -------------------------------------------------------------
    # 3. Conflicting Task Assignees and Deadlines
    # -------------------------------------------------------------
    active_tasks = db.query(Task).filter(
        Task.project_id == project_id,
        Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED]),
    ).all()

    for i in range(len(active_tasks)):
        for j in range(i + 1, len(active_tasks)):
            t1 = active_tasks[i]
            t2 = active_tasks[j]

            words_t1 = _normalize_title(t1.title)
            words_t2 = _normalize_title(t2.title)
            overlap = words_t1.intersection(words_t2)

            # Conflicting assignees on duplicate/similar active tasks
            if (len(overlap) >= 3 or t1.title.strip().lower() == t2.title.strip().lower()) and t1.assignee and t2.assignee and t1.assignee.strip().lower() != t2.assignee.strip().lower():
                title = f"Conflicting Assignees on '{t1.title[:45]}'"
                key = (ConflictType.CONFLICTING_ASSIGNEE, str(t1.id), str(t2.id))
                key2 = (ConflictType.CONFLICTING_ASSIGNEE, title)

                if key not in existing_map and key2 not in existing_map:
                    c = Conflict(
                        project_id=project_id,
                        conflict_type=ConflictType.CONFLICTING_ASSIGNEE,
                        severity=ConflictSeverity.HIGH,
                        title=title,
                        description=f"Multiple active tasks with matching scope are assigned to different individuals: '{t1.assignee}' and '{t2.assignee}'.",
                        source_entity_type="task",
                        source_entity_id=t1.id,
                        target_entity_type="task",
                        target_entity_id=t2.id,
                        evidence_snippet=f"Task 1: {t1.title} -> {t1.assignee} (Status: {t1.status.value}). Task 2: {t2.title} -> {t2.assignee} (Status: {t2.status.value}).",
                        status=ConflictStatus.OPEN,
                    )
                    db.add(c)
                    new_conflicts.append(c)
                    existing_map[key] = c

            # Conflicting deadlines: identical scope but wildly different deadlines
            if (len(overlap) >= 3 or t1.title.strip().lower() == t2.title.strip().lower()) and t1.due_date and t2.due_date:
                diff_days = abs((t1.due_date - t2.due_date).days)
                if diff_days >= 3:
                    title = f"Conflicting Deadlines on '{t1.title[:45]}'"
                    key = (ConflictType.CONFLICTING_DEADLINE, str(t1.id), str(t2.id))
                    key2 = (ConflictType.CONFLICTING_DEADLINE, title)

                    if key not in existing_map and key2 not in existing_map:
                        c = Conflict(
                            project_id=project_id,
                            conflict_type=ConflictType.CONFLICTING_DEADLINE,
                            severity=ConflictSeverity.MEDIUM,
                            title=title,
                            description=f"Duplicate tasks have conflicting milestone targets separated by {diff_days} days.",
                            source_entity_type="task",
                            source_entity_id=t1.id,
                            target_entity_type="task",
                            target_entity_id=t2.id,
                            evidence_snippet=f"Task A due {t1.due_date.strftime('%Y-%m-%d')} vs Task B due {t2.due_date.strftime('%Y-%m-%d')}.",
                            status=ConflictStatus.OPEN,
                        )
                        db.add(c)
                        new_conflicts.append(c)
                        existing_map[key] = c

    if new_conflicts:
        db.commit()
        for c in new_conflicts:
            db.refresh(c)
        log_audit_event(
            db=db,
            action="conflict_detected",
            username=actor,
            project_id=project_id,
            details=f"Conflict detection scan identified {len(new_conflicts)} new potential conflicts.",
        )

    return db.query(Conflict).filter(Conflict.project_id == project_id).order_by(Conflict.created_at.desc()).all()


def get_project_conflicts(
    db: Session,
    project_id: UUID,
    status_filter: Optional[str] = None,
) -> List[Conflict]:
    query = db.query(Conflict).filter(Conflict.project_id == project_id)
    if status_filter:
        query = query.filter(Conflict.status == status_filter)
    return query.order_by(Conflict.created_at.desc()).all()


def get_conflict_by_id(db: Session, conflict_id: UUID) -> Optional[Conflict]:
    return db.query(Conflict).filter(Conflict.id == conflict_id).first()


def resolve_conflict(
    db: Session,
    conflict_id: UUID,
    status: str,
    resolution_notes: Optional[str],
    resolved_by: str,
) -> Optional[Conflict]:
    conflict = get_conflict_by_id(db, conflict_id)
    if not conflict:
        return None

    conflict.status = ConflictStatus(status)
    conflict.resolution_notes = resolution_notes
    conflict.resolved_by = resolved_by
    if status in ("resolved", "dismissed"):
        conflict.resolved_at = datetime.now(timezone.utc)
    else:
        conflict.resolved_at = None

    db.commit()
    db.refresh(conflict)

    # Log to audit log
    log_audit_event(
        db=db,
        action="conflict_resolved" if status == "resolved" else f"conflict_{status}",
        username=resolved_by,
        project_id=conflict.project_id,
        resource_type="conflict",
        resource_id=conflict.id,
        details=f"Conflict '{conflict.title}' updated to '{status}'. Notes: {resolution_notes or 'None'}",
    )

    # Also log to project activity timeline
    activity = Activity(
        project_id=conflict.project_id,
        event_type="conflict_resolved" if status == "resolved" else "conflict_updated",
        description=f"Conflict '{conflict.title}' marked as {status} by {resolved_by}: {resolution_notes or ''}".strip(),
        actor=resolved_by,
        entity_type="conflict",
        entity_id=conflict.id,
    )
    db.add(activity)
    db.commit()

    return conflict

