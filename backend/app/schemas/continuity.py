from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class GraphNode(BaseModel):
    id: str
    label: str
    entity_type: str = Field(
        ...,
        description="One of: 'project', 'document', 'decision', 'task', 'owner', 'risk', 'question', 'conflict'",
    )
    status: Optional[str] = None
    subtitle: Optional[str] = None
    source_doc: Optional[str] = None
    evidence_quote: Optional[str] = None
    citation: Optional[str] = None
    owner: Optional[str] = None
    impact_scope: Optional[str] = None
    is_orphan: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relationship: str = Field(
        ...,
        description="E.g. 'references', 'defines arch', 'governs', 'mandates', 'triggers risk', 'primary owner', 'relay transfer', 'depends on', 'evidence for'",
    )
    inferred: bool = False
    status: Optional[str] = None  # 'active', 'blocked', 'verified'

    model_config = ConfigDict(from_attributes=True)


class ContinuityGraphResponse(BaseModel):
    project_id: UUID
    project_name: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    entity_counts: Dict[str, int]
    orphan_count: int
    blocking_paths_count: int

    model_config = ConfigDict(from_attributes=True)


class NodeDetailResponse(BaseModel):
    node: GraphNode
    connected_nodes: List[GraphNode]
    incoming_edges: List[GraphEdge]
    outgoing_edges: List[GraphEdge]

    model_config = ConfigDict(from_attributes=True)

