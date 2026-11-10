import logging
from typing import List, Optional
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
        project_id: Optional[UUID] = None,
        document_id: Optional[UUID] = None,
        verification_status: Optional[str] = None,
        category: Optional[str] = None,
    ) -> List[ExtractedKnowledge]:
        query = db.query(ExtractedKnowledge)
        if project_id:
            query = query.filter(ExtractedKnowledge.project_id == project_id)
        if document_id:
            query = query.filter(ExtractedKnowledge.document_id == document_id)
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
    def approve_review(
        cls, db: Session, review_id: UUID, actor: Optional[str] = "Reviewer"
    ) -> ExtractedKnowledge:
        claim = cls.get_review(db, review_id)
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

        db.commit()
        db.refresh(claim)
        return claim

    @classmethod
    def reject_review(
        cls, db: Session, review_id: UUID, actor: Optional[str] = "Reviewer"
    ) -> ExtractedKnowledge:
        claim = cls.get_review(db, review_id)
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
        project_id: Optional[UUID] = None,
        document_id: Optional[UUID] = None,
        actor: Optional[str] = "Reviewer",
    ) -> int:
        query = db.query(ExtractedKnowledge).filter(
            ExtractedKnowledge.status == VerificationStatus.PENDING
        )
        if project_id:
            query = query.filter(ExtractedKnowledge.project_id == project_id)
        if document_id:
            query = query.filter(ExtractedKnowledge.document_id == document_id)

        pending_items = query.all()
        count = 0
        for item in pending_items:
            cls.approve_review(db, item.id, actor=actor)
            count += 1

        return count

