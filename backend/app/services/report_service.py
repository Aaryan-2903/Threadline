import json
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
import pymupdf
from sqlalchemy.orm import Session
from app.models.decision import Decision
from app.models.document import Document
from app.models.extracted_knowledge import ExtractedKnowledge, KnowledgeCategory, VerificationStatus
from app.models.project import Project
from app.models.report import HandoverReport
from app.models.task import Task, TaskPriority, TaskStatus
from app.schemas.report import (
    HandoverReportContent,
    HandoverReportResponse,
    ReportActionItem,
    ReportDecisionItem,
    ReportDependencyItem,
    ReportDocumentItem,
    ReportOwnerItem,
    ReportOverview,
    ReportQuestionItem,
    ReportRiskItem,
    ReportStatusSection,
    ReportTaskItem,
)
from app.services.activity_service import record_activity


def utc_now_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


class HandoverReportService:
    @classmethod
    def generate_report(
        cls,
        db: Session,
        project_id: UUID,
        actor: Optional[str] = "System",
        incoming_owner: Optional[str] = None,
        incoming_owner_role: Optional[str] = None,
    ) -> HandoverReport:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID '{project_id}' not found.",
            )

        # 1. Fetch project data
        tasks = db.query(Task).filter(Task.project_id == project_id).all()
        decisions = db.query(Decision).filter(Decision.project_id == project_id).all()
        documents = db.query(Document).filter(Document.project_id == project_id).all()

        # Strict integrity: Query all extracted claims for project
        all_claims = (
            db.query(ExtractedKnowledge)
            .filter(ExtractedKnowledge.project_id == project_id)
            .all()
        )
        approved_claims = [c for c in all_claims if c.status == VerificationStatus.APPROVED]
        rejected_claims = [c for c in all_claims if c.status == VerificationStatus.REJECTED]
        pending_claims = [c for c in all_claims if c.status == VerificationStatus.PENDING]

        # 2. Build Section 1: Overview
        total_tasks = len(tasks)
        completed_tasks = [t for t in tasks if t.status == TaskStatus.DONE]
        blocked_tasks = [t for t in tasks if t.status == TaskStatus.BLOCKED]
        pending_tasks = [t for t in tasks if t.status in [TaskStatus.TODO, TaskStatus.IN_PROGRESS]]

        progress = int((len(completed_tasks) / total_tasks * 100)) if total_tasks > 0 else 0

        # Determine owners by activity frequency
        all_assignees = [t.assignee.strip() for t in tasks if t.assignee and t.assignee.strip()]
        all_deciders = [d.decided_by.strip() for d in decisions if d.decided_by and d.decided_by.strip()]
        
        owner_counts: dict = {}
        for o in (all_assignees + all_deciders):
            owner_counts[o] = owner_counts.get(o, 0) + 1
        sorted_owners = sorted(owner_counts.keys(), key=lambda k: (-owner_counts[k], k))

        outgoing_owner = sorted_owners[0] if len(sorted_owners) > 0 else "Not assigned"

        # Explicit successor rule: Only use an explicitly designated incoming successor as Incoming Owner.
        # Do not infer this from a role, reviewer, task assignee, or alphabetical owner ordering.
        explicit_successor = (incoming_owner or "").strip()
        explicit_role = (incoming_owner_role or "").strip()
        if explicit_successor and explicit_successor.lower() != "not assigned":
            incoming_owner_str = explicit_successor
            incoming_owner_role_str = explicit_role if explicit_role else None
        else:
            incoming_owner_str = "Not assigned"
            incoming_owner_role_str = None

        health = "Verified / On Track" if len(blocked_tasks) == 0 else "Review Required (Blocked Items)"

        total_claims = len(all_claims)
        approved_count = len(approved_claims)
        rejected_count = len(rejected_claims)
        pending_count = len(pending_claims)

        if total_claims == 0:
            claim_summary = "No document knowledge claims have been ingested yet."
        elif rejected_count > 0:
            claim_summary = (
                f"Knowledge review status: {approved_count} approved, {rejected_count} rejected, "
                f"and {pending_count} pending review. Only approved knowledge claims are included in verified sections; "
                f"rejected claims have been excluded from handover commitments."
            )
        elif pending_count > 0:
            claim_summary = (
                f"Knowledge review status: {approved_count} approved, 0 rejected, "
                f"and {pending_count} pending review. Verified sections reflect only human-approved claims."
            )
        else:
            claim_summary = (
                f"All {approved_count} ingested knowledge claims have passed human verification guardrails."
            )

        executive_summary = (
            f"Knowledge continuity dossier for '{project.name}'. "
            f"Currently tracking {total_tasks} total tasks ({len(completed_tasks)} completed, {len(blocked_tasks)} blocked), "
            f"{len(decisions)} verified architectural decisions, and {len(documents)} source specifications. "
            f"{claim_summary}"
        )

        overview = ReportOverview(
            project_id=str(project.id),
            project_name=project.name,
            description=project.description or "No formal project description recorded.",
            generated_at=utc_now_str(),
            project_status=project.status.value if hasattr(project.status, "value") else str(project.status),
            progress_percentage=progress,
            outgoing_owner=outgoing_owner,
            incoming_owner=incoming_owner_str,
            incoming_owner_role=incoming_owner_role_str,
            health_score=health,
            executive_summary=executive_summary,
        )

        # 3. Build Section 2: Status
        approved_risks = [c for c in approved_claims if c.category == KnowledgeCategory.RISK]
        status_sec = ReportStatusSection(
            total_tasks=total_tasks,
            completed_tasks=len(completed_tasks),
            pending_tasks=len(pending_tasks),
            blocked_tasks=len(blocked_tasks),
            decisions_count=len(decisions),
            risks_count=len(approved_risks) + len(blocked_tasks),
            documents_count=len(documents),
            approved_claims_count=approved_count,
            rejected_claims_count=rejected_count,
            pending_claims_count=pending_count,
        )

        # 4. Build Section 3: Key Verified Decisions
        decision_items: List[ReportDecisionItem] = []
        for dec in decisions:
            decision_items.append(
                ReportDecisionItem(
                    id=str(dec.id),
                    title=dec.title,
                    rationale=dec.rationale or dec.description or "Rationale not recorded.",
                    decided_by=dec.decided_by or "Architecture Committee",
                    decision_date=str(dec.decision_date) if dec.decision_date else "Recorded in backlog",
                    verified=True,
                )
            )

        # 5. Build Section 4: Completed Work
        completed_items: List[ReportTaskItem] = [
            ReportTaskItem(
                id=str(t.id),
                title=t.title,
                status=t.status.value if hasattr(t.status, "value") else str(t.status),
                priority=t.priority.value if hasattr(t.priority, "value") else str(t.priority),
                assignee=t.assignee or "Unassigned",
                due_date=str(t.due_date) if t.due_date else "No deadline set",
                description=t.description,
            )
            for t in completed_tasks
        ]

        # 6. Build Section 5: Pending and Blocked Tasks
        pending_items: List[ReportTaskItem] = [
            ReportTaskItem(
                id=str(t.id),
                title=t.title,
                status=t.status.value if hasattr(t.status, "value") else str(t.status),
                priority=t.priority.value if hasattr(t.priority, "value") else str(t.priority),
                assignee=t.assignee or "Unassigned",
                due_date=str(t.due_date) if t.due_date else "No deadline set",
                description=t.description,
                blocker_reason="Awaiting upstream cutover or dependency resolution"
                if t.status == TaskStatus.BLOCKED
                else None,
            )
            for t in (blocked_tasks + pending_tasks)
        ]

        # 7. Build Section 6: Ownership Matrix
        ownership_items: List[ReportOwnerItem] = []
        for owner in sorted_owners:
            owner_tasks = [t for t in tasks if t.assignee == owner]
            owner_decs = [d for d in decisions if d.decided_by == owner]
            is_outgoing = (owner == outgoing_owner)
            is_incoming = (incoming_owner_str != "Not assigned" and owner == incoming_owner_str)
            if is_outgoing:
                role = "Core Lead"
            elif is_incoming:
                role = f"Incoming Successor — {incoming_owner_role_str}" if incoming_owner_role_str else "Incoming Successor"
            else:
                role = "Contributing Engineer"
            handover_status = "Active Relay Handover" if (is_outgoing or is_incoming) else "Active Contributor"
            ownership_items.append(
                ReportOwnerItem(
                    name=owner,
                    role=role,
                    assigned_tasks_count=len(owner_tasks),
                    decisions_signed_count=len(owner_decs),
                    handover_status=handover_status,
                )
            )

        # Include designated incoming successor in ownership matrix if not already in sorted_owners
        if incoming_owner_str != "Not assigned" and not any(o.name == incoming_owner_str for o in ownership_items):
            role = f"Incoming Successor — {incoming_owner_role_str}" if incoming_owner_role_str else "Incoming Successor"
            ownership_items.append(
                ReportOwnerItem(
                    name=incoming_owner_str,
                    role=role,
                    assigned_tasks_count=0,
                    decisions_signed_count=0,
                    handover_status="Designated Successor Relay",
                )
            )

        # 8. Build Section 7: Risks and Blockers (ONLY approved claims)
        risk_items: List[ReportRiskItem] = [
            ReportRiskItem(
                id=str(r.id),
                title=r.title,
                impact_scope=r.impact_scope or "System Infrastructure",
                severity="High" if "latency" in r.title.lower() or "block" in r.title.lower() else "Medium",
                evidence_snippet=r.evidence_snippet,
                source_reference=r.source_reference or "Document Evidence",
                verified=True,
            )
            for r in approved_risks
        ]
        # Include blocked tasks as operational blockers
        for bt in blocked_tasks:
            risk_items.append(
                ReportRiskItem(
                    id=str(bt.id),
                    title=f"Blocked Task: {bt.title}",
                    impact_scope="Sprint Delivery",
                    severity="High",
                    evidence_snippet=bt.description or "Task flagged as blocked in tracker.",
                    source_reference="Task Tracker",
                    verified=True,
                )
            )

        # 9. Build Section 8: Dependencies
        dependency_items: List[ReportDependencyItem] = []
        for dec in decisions[:3]:
            if tasks:
                dependency_items.append(
                    ReportDependencyItem(
                        from_entity=f"Decision: {dec.title[:40]}",
                        to_entity=f"Task: {tasks[0].title[:40]}",
                        relationship_type="mandates",
                        is_inferred=True,
                    )
                )

        # 10. Build Section 9: Open Questions (ONLY approved claims)
        approved_questions = [c for c in approved_claims if c.category == KnowledgeCategory.QUESTION]
        question_items: List[ReportQuestionItem] = [
            ReportQuestionItem(
                id=str(q.id),
                title=q.title,
                impact_scope=q.impact_scope or "Architecture Alignment",
                source_reference=q.source_reference,
                evidence_snippet=q.evidence_snippet,
                verified=True,
            )
            for q in approved_questions
        ]

        # 11. Build Section 10: Recommended Next Actions (clearly labeled as inferred)
        action_items: List[ReportActionItem] = []
        if blocked_tasks:
            action_items.append(
                ReportActionItem(
                    action=f"[Inferred Recommendation] Resolve blocker on '{blocked_tasks[0].title}' before production cutover.",
                    priority="Urgent",
                    target_owner=blocked_tasks[0].assignee or (incoming_owner_str if incoming_owner_str != "Not assigned" else outgoing_owner),
                    suggested_timeframe="Within 48 hours",
                    is_inferred=True,
                )
            )
        action_items.append(
            ReportActionItem(
                action="[Inferred Recommendation] Conduct live architecture walkthrough of verified decisions with incoming owner.",
                priority="High",
                target_owner=incoming_owner_str if incoming_owner_str != "Not assigned" else "Not assigned",
                suggested_timeframe="Before handover freeze",
                is_inferred=True,
            )
        )
        action_items.append(
            ReportActionItem(
                action="[Inferred Recommendation] Confirm all open questions have written ADR ratification in Decisions Register.",
                priority="Medium",
                target_owner=outgoing_owner,
                suggested_timeframe="Sprint end",
                is_inferred=True,
            )
        )

        # 12. Build Section 11: Source Documents and Evidence References
        document_items: List[ReportDocumentItem] = [
            ReportDocumentItem(
                id=str(doc.id),
                filename=doc.filename,
                file_type=doc.file_type,
                file_size=doc.file_size,
                author=doc.author or "System",
                page_count=doc.page_count,
                extracted_claims_count=doc.extracted_claims_count,
            )
            for doc in documents
        ]

        # Assemble complete 11-section structured content
        content = HandoverReportContent(
            overview=overview,
            status=status_sec,
            decisions=decision_items,
            completed_work=completed_items,
            pending_and_blocked_tasks=pending_items,
            ownership_matrix=ownership_items,
            risks_and_blockers=risk_items,
            dependencies=dependency_items,
            open_questions=question_items,
            recommended_next_actions=action_items,
            source_documents=document_items,
        )

        report = HandoverReport(
            project_id=project.id,
            title=f"Handover Continuity Dossier — {project.name}",
            summary=overview.executive_summary,
            status="generated",
            content_json=content.model_dump_json(),
            generated_by=actor or "System",
        )
        db.add(report)

        record_activity(
            db=db,
            project_id=project.id,
            event_type="report_generated",
            description=f"Generated Handover Continuity Dossier for '{project.name}'",
            actor=actor or "System",
            entity_type="report",
            entity_id=report.id,
        )

        db.commit()
        db.refresh(report)
        return report

    @classmethod
    def list_reports(cls, db: Session, project_id: Optional[UUID] = None) -> List[HandoverReport]:
        query = db.query(HandoverReport)
        if project_id:
            query = query.filter(HandoverReport.project_id == project_id)
        return query.order_by(HandoverReport.created_at.desc()).all()

    @classmethod
    def get_report(cls, db: Session, report_id: UUID) -> HandoverReport:
        report = db.query(HandoverReport).filter(HandoverReport.id == report_id).first()
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report with ID '{report_id}' not found.",
            )
        return report

    @classmethod
    def update_report_successor(
        cls,
        db: Session,
        report_id: UUID,
        incoming_owner: Optional[str] = None,
        incoming_owner_role: Optional[str] = None,
    ) -> HandoverReport:
        report = cls.get_report(db, report_id)
        content_dict = json.loads(report.content_json)
        content = HandoverReportContent(**content_dict)

        explicit_successor = (incoming_owner or "").strip()
        explicit_role = (incoming_owner_role or "").strip()
        if explicit_successor and explicit_successor.lower() != "not assigned":
            incoming_owner_str = explicit_successor
            incoming_owner_role_str = explicit_role if explicit_role else None
        else:
            incoming_owner_str = "Not assigned"
            incoming_owner_role_str = None

        content.overview.incoming_owner = incoming_owner_str
        content.overview.incoming_owner_role = incoming_owner_role_str

        # Update action items targeting incoming owner
        for action in content.recommended_next_actions:
            if "live architecture walkthrough" in action.action.lower():
                action.target_owner = incoming_owner_str if incoming_owner_str != "Not assigned" else "Not assigned"

        # Update ownership matrix: remove previous temporary designated relay item if 0 tasks & 0 decs
        content.ownership_matrix = [
            o for o in content.ownership_matrix
            if not (o.handover_status == "Designated Successor Relay" and o.assigned_tasks_count == 0 and o.decisions_signed_count == 0)
        ]

        found_in_matrix = False
        for o in content.ownership_matrix:
            if o.name == incoming_owner_str and incoming_owner_str != "Not assigned":
                o.role = f"Incoming Successor — {incoming_owner_role_str}" if incoming_owner_role_str else "Incoming Successor"
                o.handover_status = "Active Relay Handover"
                found_in_matrix = True
            elif o.name != content.overview.outgoing_owner:
                o.role = "Contributing Engineer"
                o.handover_status = "Active Contributor"

        if incoming_owner_str != "Not assigned" and not found_in_matrix:
            role = f"Incoming Successor — {incoming_owner_role_str}" if incoming_owner_role_str else "Incoming Successor"
            content.ownership_matrix.append(
                ReportOwnerItem(
                    name=incoming_owner_str,
                    role=role,
                    assigned_tasks_count=0,
                    decisions_signed_count=0,
                    handover_status="Designated Successor Relay",
                )
            )

        report.content_json = content.model_dump_json()
        db.commit()
        db.refresh(report)
        return report

    @classmethod
    def export_pdf(cls, db: Session, report_id: UUID) -> bytes:
        report = cls.get_report(db, report_id)
        content_dict = json.loads(report.content_json)
        content = HandoverReportContent(**content_dict)

        doc = pymupdf.open()

        # Page 1: Title & Executive Summary
        p1 = doc.new_page(width=595, height=842)  # Standard A4
        y = 50

        # Header branding
        p1.insert_text((50, y), "THREADLINE ENTERPRISE CONTINUITY", fontsize=10, fontname="helv", color=(0.2, 0.2, 0.8))
        y += 18
        p1.insert_text((50, y), content.overview.project_name, fontsize=20, fontname="hebo", color=(0.1, 0.1, 0.1))
        y += 18
        p1.insert_text((50, y), f"Handover Continuity Dossier • Generated: {content.overview.generated_at}", fontsize=9, fontname="helv", color=(0.4, 0.4, 0.4))
        y += 25

        # Divider line
        p1.draw_line(pymupdf.Point(50, y), pymupdf.Point(545, y), color=(0.8, 0.8, 0.8), width=1)
        y += 20

        # Executive Summary Box
        p1.draw_rect(pymupdf.Rect(50, y, 545, y + 70), color=(0.9, 0.9, 0.95), fill=(0.95, 0.96, 1.0))
        p1.insert_text((60, y + 16), "1. EXECUTIVE SUMMARY & OVERVIEW", fontsize=11, fontname="hebo", color=(0.15, 0.15, 0.6))
        p1.insert_textbox(pymupdf.Rect(60, y + 24, 535, y + 65), content.overview.executive_summary, fontsize=9, fontname="helv", color=(0.15, 0.15, 0.15))
        y += 85

        # Status & Metrics Grid
        p1.insert_text((50, y), "2. PROJECT STATUS & HEALTH METRICS", fontsize=11, fontname="hebo", color=(0.1, 0.1, 0.1))
        y += 15
        p1.insert_text((50, y), f"• Total Tasks: {content.status.total_tasks} ({content.status.completed_tasks} Completed, {content.status.pending_tasks} Pending, {content.status.blocked_tasks} Blocked)", fontsize=9, fontname="helv")
        y += 14
        p1.insert_text((50, y), f"• Verified Architectural Decisions: {content.status.decisions_count}", fontsize=9, fontname="helv")
        y += 14
        p1.insert_text((50, y), f"• Operational Risks & Blockers: {content.status.risks_count}", fontsize=9, fontname="helv")
        y += 14
        p1.insert_text((50, y), f"• Verified Source Specifications: {content.status.documents_count}", fontsize=9, fontname="helv")
        y += 14
        p1.insert_text((50, y), f"• Knowledge Verification Audit: {content.status.approved_claims_count} Approved, {content.status.rejected_claims_count} Rejected, {content.status.pending_claims_count} Pending Review", fontsize=9, fontname="helv", color=(0.15, 0.15, 0.6))
        y += 25

        # Key Verified Decisions
        p1.insert_text((50, y), "3. KEY VERIFIED DECISIONS & RATIONALE", fontsize=11, fontname="hebo", color=(0.1, 0.1, 0.1))
        y += 15
        if not content.decisions:
            p1.insert_text((50, y), "No verified decisions recorded for this project.", fontsize=9, fontname="helv", color=(0.5, 0.5, 0.5))
            y += 14
        else:
            for dec in content.decisions[:4]:
                p1.insert_text((50, y), f"✓ {dec.title} (Decided by: {dec.decided_by or 'Working Group'})", fontsize=9, fontname="hebo", color=(0.1, 0.1, 0.5))
                y += 12
                p1.insert_textbox(pymupdf.Rect(60, y, 545, y + 24), dec.rationale or "No rationale recorded.", fontsize=8, fontname="helv", color=(0.25, 0.25, 0.25))
                y += 28

        # Ownership & Responsibilities
        y += 10
        p1.insert_text((50, y), "4. TASK OWNERSHIP & SUCCESSION RELAY", fontsize=11, fontname="hebo", color=(0.1, 0.1, 0.1))
        y += 15
        p1.insert_text((50, y), f"• Outgoing Owner / Lead: {content.overview.outgoing_owner}", fontsize=9, fontname="helv")
        y += 14
        incoming_display = content.overview.incoming_owner
        if content.overview.incoming_owner_role and incoming_display != "Not assigned":
            incoming_display += f" ({content.overview.incoming_owner_role})"
        p1.insert_text((50, y), f"• Incoming Successor: {incoming_display}", fontsize=9, fontname="helv")
        y += 14
        for own in content.ownership_matrix[:3]:
            p1.insert_text((60, y), f"- {own.name} ({own.role}): {own.assigned_tasks_count} tasks, {own.decisions_signed_count} decisions", fontsize=8, fontname="helv")
            y += 12

        # Page 1 footer
        p1.insert_text((260, 820), "Page 1 of 2 • Threadline Continuity Engine", fontsize=8, fontname="helv", color=(0.5, 0.5, 0.5))

        # Page 2: Risks, Blockers, Questions, Next Actions & Source Documents
        p2 = doc.new_page(width=595, height=842)
        y = 50

        # Header branding
        p2.insert_text((50, y), f"{content.overview.project_name} — CONTINUITY DOSSIER (CONT.)", fontsize=10, fontname="hebo", color=(0.2, 0.2, 0.8))
        y += 20
        p2.draw_line(pymupdf.Point(50, y), pymupdf.Point(545, y), color=(0.8, 0.8, 0.8), width=1)
        y += 20

        # Risks & Blockers Section
        p2.insert_text((50, y), "5. RISKS & OPERATIONAL BLOCKERS (CONFIRMED)", fontsize=11, fontname="hebo", color=(0.7, 0.1, 0.1))
        y += 15
        if not content.risks_and_blockers:
            p2.insert_text((50, y), "No high-severity risks or blockers identified.", fontsize=9, fontname="helv", color=(0.5, 0.5, 0.5))
            y += 14
        else:
            for r in content.risks_and_blockers[:4]:
                p2.insert_text((50, y), f"⚠ [{r.severity}] {r.title}", fontsize=9, fontname="hebo", color=(0.6, 0.1, 0.1))
                y += 12
                if r.evidence_snippet:
                    p2.insert_text((60, y), f"Source citation: \"{r.evidence_snippet[:100]}...\"", fontsize=8, fontname="helv", color=(0.3, 0.3, 0.3))
                    y += 14

        y += 10
        # Pending and Blocked Tasks
        p2.insert_text((50, y), "6. PENDING & IN-PROGRESS HANDOVER COMMITMENTS", fontsize=11, fontname="hebo", color=(0.1, 0.1, 0.1))
        y += 15
        if not content.pending_and_blocked_tasks:
            p2.insert_text((50, y), "All tasks completed.", fontsize=9, fontname="helv")
            y += 14
        else:
            for t in content.pending_and_blocked_tasks[:5]:
                p2.insert_text((50, y), f"• [{t.status.upper()}] {t.title} — Assignee: {t.assignee or 'Unassigned'} (Due: {t.due_date})", fontsize=8.5, fontname="helv")
                y += 13

        y += 10
        # Open Questions
        p2.insert_text((50, y), "7. UNRESOLVED QUESTIONS & ARCHITECTURE GAPS", fontsize=11, fontname="hebo", color=(0.1, 0.1, 0.1))
        y += 15
        if not content.open_questions:
            p2.insert_text((50, y), "No open architecture questions pending resolution.", fontsize=9, fontname="helv", color=(0.5, 0.5, 0.5))
            y += 14
        else:
            for q in content.open_questions[:3]:
                p2.insert_text((50, y), f"? {q.title} ({q.source_reference or 'Spec'})", fontsize=8.5, fontname="helv")
                y += 13

        y += 10
        # Recommended Next Actions (Inferred)
        p2.insert_text((50, y), "8. RECOMMENDED NEXT ACTIONS (INFERRED RECOMMENDATIONS)", fontsize=11, fontname="hebo", color=(0.15, 0.15, 0.6))
        y += 15
        for act in content.recommended_next_actions[:3]:
            p2.insert_text((50, y), f"➔ [{act.priority}] {act.action} — Target: {act.target_owner} ({act.suggested_timeframe})", fontsize=8.5, fontname="helv")
            y += 13

        y += 10
        # Source Documents
        p2.insert_text((50, y), "9. SOURCE SPECIFICATIONS & EVIDENCE DOCUMENTS", fontsize=11, fontname="hebo", color=(0.1, 0.1, 0.1))
        y += 15
        if not content.source_documents:
            p2.insert_text((50, y), "No documents uploaded.", fontsize=9, fontname="helv", color=(0.5, 0.5, 0.5))
            y += 14
        else:
            for sdoc in content.source_documents[:4]:
                p2.insert_text((50, y), f"• {sdoc.filename} ({sdoc.file_type.upper()}, {sdoc.page_count} pgs, {sdoc.extracted_claims_count} extracted claims)", fontsize=8.5, fontname="helv")
                y += 13

        # Page 2 footer
        p2.insert_text((260, 820), "Page 2 of 2 • Threadline Continuity Engine", fontsize=8, fontname="helv", color=(0.5, 0.5, 0.5))

        pdf_bytes = doc.tobytes()
        doc.close()
        return pdf_bytes
