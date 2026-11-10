from typing import Dict, List, Optional, Set
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.decision import Decision
from app.models.document import Document
from app.models.extracted_knowledge import ExtractedKnowledge, KnowledgeCategory, VerificationStatus
from app.models.project import Project
from app.models.task import Task, TaskStatus
from app.schemas.continuity import ContinuityGraphResponse, GraphEdge, GraphNode, NodeDetailResponse


class ContinuityService:
    @classmethod
    def get_continuity_graph(cls, db: Session, project_id: UUID) -> ContinuityGraphResponse:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID '{project_id}' not found.",
            )

        tasks = db.query(Task).filter(Task.project_id == project_id).all()
        decisions = db.query(Decision).filter(Decision.project_id == project_id).all()
        documents = db.query(Document).filter(Document.project_id == project_id).all()
        claims = db.query(ExtractedKnowledge).filter(ExtractedKnowledge.project_id == project_id).all()

        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []
        node_ids: Set[str] = set()
        connected_node_ids: Set[str] = set()

        # 1. Project Root Node
        proj_node_id = f"proj-{project.id}"
        nodes.append(
            GraphNode(
                id=proj_node_id,
                label=project.name,
                entity_type="project",
                status=project.status.value if hasattr(project.status, "value") else str(project.status),
                subtitle="Project Core",
                metadata={"description": project.description or ""},
            )
        )
        node_ids.add(proj_node_id)

        # 2. Documents Nodes
        doc_map: Dict[UUID, str] = {}
        for doc in documents:
            doc_id = f"doc-{doc.id}"
            doc_map[doc.id] = doc_id
            nodes.append(
                GraphNode(
                    id=doc_id,
                    label=doc.filename,
                    entity_type="document",
                    status=doc.status.value if hasattr(doc.status, "value") else str(doc.status),
                    subtitle=f"{doc.file_type.upper()} • {doc.page_count} pgs",
                    source_doc=doc.filename,
                    metadata={"file_size": doc.file_size, "claims_count": doc.extracted_claims_count},
                )
            )
            node_ids.add(doc_id)

            # Edge Project -> Document
            edge_id = f"edge-{proj_node_id}-{doc_id}"
            edges.append(
                GraphEdge(
                    id=edge_id,
                    source=proj_node_id,
                    target=doc_id,
                    relationship="contains spec",
                    inferred=False,
                    status="active",
                )
            )
            connected_node_ids.add(proj_node_id)
            connected_node_ids.add(doc_id)

        # 3. Decisions Nodes
        dec_map: Dict[UUID, str] = {}
        for dec in decisions:
            dec_id = f"dec-{dec.id}"
            dec_map[dec.id] = dec_id
            nodes.append(
                GraphNode(
                    id=dec_id,
                    label=dec.title,
                    entity_type="decision",
                    status="ratified",
                    subtitle=f"Decided by {dec.decided_by or 'Working Group'}",
                    evidence_quote=dec.rationale,
                    owner=dec.decided_by,
                    metadata={"decision_date": str(dec.decision_date)},
                )
            )
            node_ids.add(dec_id)

            # Edge Project -> Decision
            edge_id = f"edge-{proj_node_id}-{dec_id}"
            edges.append(
                GraphEdge(
                    id=edge_id,
                    source=proj_node_id,
                    target=dec_id,
                    relationship="governs",
                    inferred=False,
                    status="verified",
                )
            )
            connected_node_ids.add(proj_node_id)
            connected_node_ids.add(dec_id)

        # 4. Tasks Nodes
        task_map: Dict[UUID, str] = {}
        for task in tasks:
            task_id = f"task-{task.id}"
            task_map[task.id] = task_id
            is_blocked = (task.status == TaskStatus.BLOCKED)
            nodes.append(
                GraphNode(
                    id=task_id,
                    label=task.title,
                    entity_type="task",
                    status=task.status.value if hasattr(task.status, "value") else str(task.status),
                    subtitle=f"Priority: {task.priority.value if hasattr(task.priority, 'value') else str(task.priority)}",
                    owner=task.assignee,
                    metadata={"due_date": str(task.due_date) if task.due_date else None},
                )
            )
            node_ids.add(task_id)

            # Edge Project -> Task
            edge_id = f"edge-{proj_node_id}-{task_id}"
            edges.append(
                GraphEdge(
                    id=edge_id,
                    source=proj_node_id,
                    target=task_id,
                    relationship="mandates" if not is_blocked else "mandates [blocked]",
                    inferred=False,
                    status="blocked" if is_blocked else "active",
                )
            )
            connected_node_ids.add(proj_node_id)
            connected_node_ids.add(task_id)

        # 5. Extracted Claims (Risks, Questions, Conflicts)
        for claim in claims:
            # Explicit integrity guard: Rejected claims never appear as ratified decisions, active risks, or verified gaps
            if claim.status == VerificationStatus.REJECTED:
                continue

            cat = claim.category.value if hasattr(claim.category, "value") else str(claim.category)
            if cat in ["risk", "question", "conflict"]:
                claim_node_id = f"{cat}-{claim.id}"
                nodes.append(
                    GraphNode(
                        id=claim_node_id,
                        label=claim.title,
                        entity_type=cat,
                        status=claim.status.value if hasattr(claim.status, "value") else str(claim.status),
                        subtitle=f"Confidence: {int(claim.confidence * 100)}%",
                        source_doc=claim.source_reference,
                        evidence_quote=claim.evidence_snippet,
                        citation=claim.source_reference,
                        owner=claim.owner,
                        impact_scope=claim.impact_scope,
                    )
                )
                node_ids.add(claim_node_id)

                # Link Document -> Claim if document_id exists
                if claim.document_id and claim.document_id in doc_map:
                    parent_doc_node_id = doc_map[claim.document_id]
                    edge_id = f"edge-{parent_doc_node_id}-{claim_node_id}"
                    edges.append(
                        GraphEdge(
                            id=edge_id,
                            source=parent_doc_node_id,
                            target=claim_node_id,
                            relationship="evidence for",
                            inferred=False,
                            status="active",
                        )
                    )
                    connected_node_ids.add(parent_doc_node_id)
                    connected_node_ids.add(claim_node_id)
                elif claim.status == VerificationStatus.APPROVED:
                    # Link Project -> Claim for approved claims
                    edge_id = f"edge-{proj_node_id}-{claim_node_id}"
                    edges.append(
                        GraphEdge(
                            id=edge_id,
                            source=proj_node_id,
                            target=claim_node_id,
                            relationship="triggers risk" if cat == "risk" else "relates to",
                            inferred=True,
                            status="active",
                        )
                    )
                    connected_node_ids.add(proj_node_id)
                    connected_node_ids.add(claim_node_id)

        # 6. Owners Nodes & Assignment Edges (from actual tasks, decisions, and approved claims)
        owner_names: Set[str] = set()
        for t in tasks:
            if t.assignee and t.assignee.strip():
                owner_names.add(t.assignee.strip())
        for d in decisions:
            if d.decided_by and d.decided_by.strip():
                owner_names.add(d.decided_by.strip())
        for c in claims:
            # Only consider human-approved claims for owner nodes
            if c.status == VerificationStatus.APPROVED and c.owner and c.owner.strip():
                owner_names.add(c.owner.strip())

        owner_map: Dict[str, str] = {}
        for owner_name in owner_names:
            owner_slug = owner_name.lower().replace(" ", "-")
            owner_node_id = f"owner-{owner_slug}"
            owner_map[owner_name] = owner_node_id

            # Count tasks/decisions for this owner
            owned_tasks = [t for t in tasks if t.assignee == owner_name]
            nodes.append(
                GraphNode(
                    id=owner_node_id,
                    label=owner_name,
                    entity_type="owner",
                    status="active",
                    subtitle=f"{len(owned_tasks)} active tasks",
                    owner=owner_name,
                )
            )
            node_ids.add(owner_node_id)

            # Link Owner -> Tasks
            for ot in owned_tasks:
                ot_id = task_map.get(ot.id)
                if ot_id:
                    edge_id = f"edge-{owner_node_id}-{ot_id}"
                    edges.append(
                        GraphEdge(
                            id=edge_id,
                            source=owner_node_id,
                            target=ot_id,
                            relationship="assigned to",
                            inferred=False,
                            status="active",
                        )
                    )
                    connected_node_ids.add(owner_node_id)
                    connected_node_ids.add(ot_id)

            # Link Owner -> Project
            edge_id = f"edge-{proj_node_id}-{owner_node_id}"
            edges.append(
                GraphEdge(
                    id=edge_id,
                    source=proj_node_id,
                    target=owner_node_id,
                    relationship="primary owner",
                    inferred=False,
                    status="active",
                )
            )
            connected_node_ids.add(proj_node_id)
            connected_node_ids.add(owner_node_id)

        # 7. Check for orphans (project root node is the graph root, not an orphan)
        orphan_count = 0
        for node in nodes:
            if node.entity_type != "project" and node.id not in connected_node_ids:
                node.is_orphan = True
                orphan_count += 1

        # Count blocking paths (blocked tasks or conflicts)
        blocking_paths = sum(1 for e in edges if e.status == "blocked" or "blocked" in e.relationship.lower())
        blocking_paths += sum(1 for n in nodes if n.entity_type == "conflict")

        entity_counts = {
            "decisions": sum(1 for n in nodes if n.entity_type == "decision"),
            "tasks": sum(1 for n in nodes if n.entity_type == "task"),
            "risks": sum(1 for n in nodes if n.entity_type == "risk"),
            "documents": sum(1 for n in nodes if n.entity_type == "document"),
            "owners": sum(1 for n in nodes if n.entity_type == "owner"),
            "questions": sum(1 for n in nodes if n.entity_type == "question"),
            "conflicts": sum(1 for n in nodes if n.entity_type == "conflict"),
        }

        return ContinuityGraphResponse(
            project_id=project.id,
            project_name=project.name,
            nodes=nodes,
            edges=edges,
            entity_counts=entity_counts,
            orphan_count=orphan_count,
            blocking_paths_count=blocking_paths,
        )

    @classmethod
    def get_node_detail(cls, db: Session, project_id: UUID, node_id: str) -> NodeDetailResponse:
        graph = cls.get_continuity_graph(db, project_id)
        node = next((n for n in graph.nodes if n.id == node_id), None)
        if not node:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Node '{node_id}' not found in project '{project_id}'.",
            )

        incoming = [e for e in graph.edges if e.target == node_id]
        outgoing = [e for e in graph.edges if e.source == node_id]

        neighbor_ids = {e.source for e in incoming} | {e.target for e in outgoing}
        connected_nodes = [n for n in graph.nodes if n.id in neighbor_ids]

        return NodeDetailResponse(
            node=node,
            connected_nodes=connected_nodes,
            incoming_edges=incoming,
            outgoing_edges=outgoing,
        )
