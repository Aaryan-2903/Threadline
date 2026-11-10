import logging
from typing import List, Optional, Union
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.decision import Decision
from app.models.extracted_knowledge import ExtractedKnowledge, KnowledgeCategory, VerificationStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.schemas.extracted_knowledge import ExtractedKnowledgeUpdate
from app.services.activity_service import record_activity

logger = logging.getLogger(__name__)


class ReviewService:
    @classmethod
    def list_reviews(
        cls,
        db: Session,
        project_id: Optional[Union[UUID, str]] = None,
        document_id: Optional[Union[UUID, str]] = None,
        verification_status: Optional[str] = None,
        category: Optional[str] = None,
    ) -> List[ExtractedKnowledge]:
        query = db.query(ExtractedKnowledge)
        if project_id:
            pid = UUID(str(project_id)) if not isinstance(project_id, UUID) else project_id
            query = query.filter(ExtractedKnowledge.project_id == pid)
        if document_id:
            did = UUID(str(document_id)) if not isinstance(document_id, UUID) else document_id
            query = query.filter(ExtractedKnowledge.document_id == did)
        if verification_status:
            query = query.filter(ExtractedKnowledge.status == verification_status)
        if category:
            query = query.filter(ExtractedKnowledge.category == category)
        return query.order_by(ExtractedKnowledge.created_at.desc()).all()

    @classmethod
    def get_review(cls, db: Session, review_id: UUID) -> ExtractedKnowledge:
        item = db.query(ExtractedKnowledge).filter(ExtractedKnowledge.id == review_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Extracted claim with ID '{review_id}' not found.",
            )
        return item

    @classmethod
    def _promote_and_approve_claim(
        cls, db: Session, claim: ExtractedKnowledge, actor: Optional[str] = "Reviewer"
    ) -> None:
        """Promote an extracted claim to Decision or Task table and record activity in the current transaction."""
        claim.status = VerificationStatus.APPROVED

        # If claim is decision and project_id exists, promote to Decisions table
        if claim.category == KnowledgeCategory.DECISION and claim.project_id:
            decision = Decision(
                project_id=claim.project_id,
                title=claim.title[:200],
                description=claim.content,
                rationale=claim.evidence_snippet,
                decided_by=claim.owner or actor or "AI Review",
            )
            db.add(decision)

        # If claim is task and project_id exists, promote to Tasks table
        elif claim.category == KnowledgeCategory.TASK and claim.project_id:
            task = Task(
                project_id=claim.project_id,
                title=claim.title[:200],
                description=claim.content,
                status=TaskStatus.TODO,
                priority=TaskPriority.MEDIUM,
                assignee=claim.owner,
            )
            db.add(task)

        if claim.project_id:
            record_activity(
                db=db,
                project_id=claim.project_id,
                event_type="claim_approved",
                description=f"Approved {claim.category.value} claim: '{claim.title}'",
                actor=actor or "Reviewer",
                entity_type="extracted_knowledge",
                entity_id=claim.id,
            )

    @classmethod
    def approve_review(
        cls, db: Session, review_id: UUID, actor: Optional[str] = "Reviewer"
    ) -> ExtractedKnowledge:
        claim = cls.get_review(db, review_id)

        # Idempotency guard: If already approved, return existing claim without creating duplicate records or activities
        if claim.status == VerificationStatus.APPROVED:
            return claim

        cls._promote_and_approve_claim(db=db, claim=claim, actor=actor)
        db.commit()
        db.refresh(claim)
        return claim

    @classmethod
    def reject_review(
        cls, db: Session, review_id: UUID, actor: Optional[str] = "Reviewer"
    ) -> ExtractedKnowledge:
        claim = cls.get_review(db, review_id)

        # Idempotency guard: If already rejected, return without duplicate activities
        if claim.status == VerificationStatus.REJECTED:
            return claim

        claim.status = VerificationStatus.REJECTED

        if claim.project_id:
            record_activity(
                db=db,
                project_id=claim.project_id,
                event_type="claim_rejected",
                description=f"Rejected {claim.category.value} claim: '{claim.title}'",
                actor=actor or "Reviewer",
                entity_type="extracted_knowledge",
                entity_id=claim.id,
            )

        db.commit()
        db.refresh(claim)
        return claim

    @classmethod
    def update_review(
        cls,
        db: Session,
        review_id: UUID,
        update_data: ExtractedKnowledgeUpdate,
        actor: Optional[str] = "Reviewer",
    ) -> ExtractedKnowledge:
        claim = cls.get_review(db, review_id)

        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(claim, key, value)

        if claim.project_id:
            record_activity(
                db=db,
                project_id=claim.project_id,
                event_type="claim_updated",
                description=f"Updated claim: '{claim.title}'",
                actor=actor or "Reviewer",
                entity_type="extracted_knowledge",
                entity_id=claim.id,
            )

        db.commit()
        db.refresh(claim)
        return claim

    @classmethod
    def approve_all(
        cls,
        db: Session,
        project_id: Optional[Union[UUID, str]] = None,
        document_id: Optional[Union[UUID, str]] = None,
        actor: Optional[str] = "Reviewer",
    ) -> int:
        """Batch approve all pending claims in a single atomic transaction. Rolls back completely on failure."""
        query = db.query(ExtractedKnowledge).filter(
            ExtractedKnowledge.status == VerificationStatus.PENDING
        )
        if project_id:
            pid = UUID(str(project_id)) if not isinstance(project_id, UUID) else project_id
            query = query.filter(ExtractedKnowledge.project_id == pid)
        if document_id:
            did = UUID(str(document_id)) if not isinstance(document_id, UUID) else document_id
            query = query.filter(ExtractedKnowledge.document_id == did)

        pending_items = query.all()
        if not pending_items:
            return 0

        try:
            count = 0
            for item in pending_items:
                cls._promote_and_approve_claim(db=db, claim=item, actor=actor)
                count += 1

            db.commit()
            return count
        except Exception:
            db.rollback()
            raise

