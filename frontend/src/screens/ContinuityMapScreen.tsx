import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api/client';
import { useNavigation } from '../context/useNavigation';
import { isValidUUID } from '../utils/uuid';
import type { ContinuityGraphData, Project } from '../types';

export const ContinuityMapScreen: React.FC = () => {
  const { navigate, selectedProjectId, setSelectedProjectId } = useNavigation();

  // State
  const [graphData, setGraphData] = useState<ContinuityGraphData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>(
    isValidUUID(selectedProjectId) ? selectedProjectId : ''
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isOrphanFilterActive, setIsOrphanFilterActive] = useState<boolean>(false);
  const [isHandoverPathActive, setIsHandoverPathActive] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [hopDepth, setHopDepth] = useState<number>(2);

  // Active entity filters
  const [activeEntityFilters, setActiveEntityFilters] = useState<{ [key: string]: boolean }>({
    decision: true,
    task: true,
    risk: true,
    document: true,
    owner: true,
    question: true,
    conflict: true,
    project: true,
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  // Load projects list
  useEffect(() => {
    let isMounted = true;
    api.getProjects().then((projs) => {
      if (!isMounted) return;
      setProjects(projs);
      if (projs.length > 0) {
        setActiveProjectId((prev) => {
          if (isValidUUID(prev) && projs.some((p) => p.id === prev)) {
            return prev;
          }
          if (isValidUUID(selectedProjectId) && projs.some((p) => p.id === selectedProjectId)) {
            return selectedProjectId;
          }
          return projs[0].id;
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  // Load continuity graph for active project
  useEffect(() => {
    let isMounted = true;
    if (!activeProjectId || !isValidUUID(activeProjectId)) return;

    const loadGraph = async () => {
      try {
        const data = await api.getContinuityGraph(activeProjectId);
        if (!isMounted) return;

        if (data && data.nodes && data.nodes.length > 0) {
          setGraphData(data);
          setSelectedNodeId((prev) => prev || (data.nodes.length > 1 ? data.nodes[1].id : data.nodes[0].id));
        } else {
          setGraphData(data || null);
          setSelectedNodeId(null);
        }
      } catch (err) {
        console.warn('Error loading continuity graph:', err);
        if (isMounted) {
          setGraphData(null);
          setSelectedNodeId(null);
        }
      }
    };

    loadGraph();

    return () => {
      isMounted = false;
    };
  }, [activeProjectId]);

  // Compute node layout coordinates automatically if not preset
  const layoutNodes = useMemo(() => {
    if (!graphData) return [];
    const rawNodes = graphData.nodes;

    // Distribute nodes in clusters around center
    return rawNodes.map((node, idx) => {
      if (node.x !== undefined && node.y !== undefined) return node;

      if (node.entity_type === 'project') {
        return { ...node, x: 340, y: 260 };
      }

      // Clustered arrangement
      const angle = (idx / (rawNodes.length - 1)) * 2 * Math.PI;
      const radius = 220 + (idx % 2) * 80;
      const x = Math.round(340 + radius * Math.cos(angle));
      const y = Math.round(260 + radius * Math.sin(angle));
      return { ...node, x: Math.max(20, Math.min(740, x)), y: Math.max(60, Math.min(520, y)) };
    });
  }, [graphData]);

  // Filtered nodes based on entity toggles, orphans, and search query
  const visibleNodes = useMemo(() => {
    if (!layoutNodes) return [];
    return layoutNodes.filter((node) => {
      // Entity toggle filter
      if (!activeEntityFilters[node.entity_type]) return false;

      // Orphan toggle filter
      if (isOrphanFilterActive && !node.is_orphan) return false;

      // Search query filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchLabel = node.label.toLowerCase().includes(q);
        const matchOwner = (node.owner || '').toLowerCase().includes(q);
        const matchSub = (node.subtitle || '').toLowerCase().includes(q);
        if (!matchLabel && !matchOwner && !matchSub) return false;
      }

      return true;
    });
  }, [layoutNodes, activeEntityFilters, isOrphanFilterActive, searchQuery]);

  const visibleNodeIdSet = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  // Visible edges
  const visibleEdges = useMemo(() => {
    if (!graphData) return [];
    return graphData.edges.filter(
      (edge) => visibleNodeIdSet.has(edge.source) && visibleNodeIdSet.has(edge.target)
    );
  }, [graphData, visibleNodeIdSet]);

  // Selected node & inspector data
  const selectedNode = useMemo(() => {
    if (!layoutNodes || !selectedNodeId) return null;
    return layoutNodes.find((n) => n.id === selectedNodeId) || null;
  }, [layoutNodes, selectedNodeId]);

  const selectedNodeConnected = useMemo(() => {
    if (!selectedNode || !graphData) return { incoming: [], outgoing: [] };
    const incoming = graphData.edges.filter((e) => e.target === selectedNode.id);
    const outgoing = graphData.edges.filter((e) => e.source === selectedNode.id);
    return { incoming, outgoing };
  }, [selectedNode, graphData]);

  // Toggle filter helper
  const toggleFilter = (type: string) => {
    setActiveEntityFilters((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.max(50, Math.min(180, prev + delta)));
  };

  const handleResetLayout = () => {
    setZoomLevel(100);
    setIsOrphanFilterActive(false);
    setIsHandoverPathActive(true);
    setSearchQuery('');
    if (layoutNodes.length > 0) {
      setSelectedNodeId(layoutNodes[0].id);
    }
  };

  const handleExportGraph = () => {
    window.print();
  };

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Page Top Bar */}
      <div className="w-full bg-surface-container-lowest px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm border-b border-outline-variant/15">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Continuity Map</span>
            <span className="px-2 py-0.5 rounded bg-surface-container font-code-inline text-code-inline text-on-surface-variant font-medium">
              v2.4 topology
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary-container text-on-secondary-fixed font-label-sm text-label-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              Live Relational Graph
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Visual dependency graph mapping enterprise decisions, open handovers, risk blast radii, and owner relays.
          </p>
        </div>

        {/* Right Header Utilities */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Project selector */}
          {projects.length > 0 && (
            <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded-lg">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Project:</span>
              <select
                value={activeProjectId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setActiveProjectId(newId);
                  if (setSelectedProjectId) setSelectedProjectId(newId);
                }}
                className="bg-transparent font-label-md text-label-md text-on-surface font-semibold focus:outline-none cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleExportGraph}
            className="h-8 px-3 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export SVG / PDF</span>
          </button>

          <button
            onClick={handleResetLayout}
            className="h-8 px-3 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            <span>Reset Layout</span>
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="p-space-lg flex-1">
          <div className="w-full bg-surface-container-lowest rounded-lg shadow-sm p-space-xl text-center space-y-space-md border border-surface-container my-8 max-w-2xl mx-auto">
            <div className="w-12 h-12 mx-auto rounded-full bg-surface-container flex items-center justify-center text-outline">
              <span className="material-symbols-outlined text-[28px]">hub</span>
            </div>
            <div className="space-y-1">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">No continuity graph available</h3>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
                The knowledge continuity graph populates dynamically as projects, architectural decisions, tasks, and documents are captured. Create your first project to view its relational topology.
              </p>
            </div>
            <button
              onClick={() => navigate('my-projects')}
              className="inline-flex items-center gap-1.5 px-4 h-9 rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-xs transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>Go to My Projects</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Graph Controls & Filter Toolbar */}
          <div className="w-full bg-surface-container-low px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-on-surface border-b border-outline-variant/15">
        {/* Filter Badges / Entity Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold mr-1">
            Entities:
          </span>

          {/* Decisions */}
          <button
            onClick={() => toggleFilter('decision')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors cursor-pointer shadow-sm ${
              activeEntityFilters.decision
                ? 'bg-surface-container-lowest ring-1 ring-primary'
                : 'bg-surface-container-low opacity-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-primary-container"></span>
            <span className="font-label-sm text-label-sm text-on-surface font-medium">Decisions</span>
            <span className="font-code-inline text-[11px] px-1 py-0.2 rounded bg-surface-container text-on-surface-variant">
              {graphData?.entity_counts.decisions || 0}
            </span>
          </button>

          {/* Tasks */}
          <button
            onClick={() => toggleFilter('task')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors cursor-pointer shadow-sm ${
              activeEntityFilters.task
                ? 'bg-surface-container-lowest ring-1 ring-primary'
                : 'bg-surface-container-low opacity-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-tertiary-container"></span>
            <span className="font-label-sm text-label-sm text-on-surface font-medium">Tasks</span>
            <span className="font-code-inline text-[11px] px-1 py-0.2 rounded bg-surface-container text-on-surface-variant">
              {graphData?.entity_counts.tasks || 0}
            </span>
          </button>

          {/* Risks */}
          <button
            onClick={() => toggleFilter('risk')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors cursor-pointer shadow-sm ${
              activeEntityFilters.risk
                ? 'bg-surface-container-lowest ring-1 ring-primary'
                : 'bg-surface-container-low opacity-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-error"></span>
            <span className="font-label-sm text-label-sm text-on-surface font-medium">Risks</span>
            <span className="font-code-inline text-[11px] px-1 py-0.2 rounded bg-error-container text-on-error-container font-semibold">
              {graphData?.entity_counts.risks || 0}
            </span>
          </button>

          {/* Documents */}
          <button
            onClick={() => toggleFilter('document')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors cursor-pointer shadow-sm ${
              activeEntityFilters.document
                ? 'bg-surface-container-lowest ring-1 ring-primary'
                : 'bg-surface-container-low opacity-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-on-surface-variant"></span>
            <span className="font-label-sm text-label-sm text-on-surface font-medium">Documents</span>
            <span className="font-code-inline text-[11px] px-1 py-0.2 rounded bg-surface-container text-on-surface-variant">
              {graphData?.entity_counts.documents || 0}
            </span>
          </button>

          {/* Owners */}
          <button
            onClick={() => toggleFilter('owner')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors cursor-pointer shadow-sm ${
              activeEntityFilters.owner
                ? 'bg-surface-container-lowest ring-1 ring-primary'
                : 'bg-surface-container-low opacity-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            <span className="font-label-sm text-label-sm text-on-surface font-medium">Owners</span>
            <span className="font-code-inline text-[11px] px-1 py-0.2 rounded bg-surface-container text-on-surface-variant">
              {graphData?.entity_counts.owners || 0}
            </span>
          </button>
        </div>

        {/* Quick Graph Query & Modifiers */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search inside graph */}
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-2 text-[15px] text-on-surface-variant pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find node by name or owner..."
              className="h-7 w-48 pl-7 pr-3 rounded bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary-container"
            />
          </div>

          {/* Orphan Alert toggle */}
          <button
            onClick={() => setIsOrphanFilterActive((prev) => !prev)}
            className={`h-7 px-2.5 rounded font-label-sm text-label-sm flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer ${
              isOrphanFilterActive
                ? 'bg-error text-on-error'
                : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
            <span>Orphan Nodes</span>
            <span className="font-code-inline text-[10px] text-on-error-container bg-error-container px-1 rounded">
              {graphData?.orphan_count || 0}
            </span>
          </button>

          {/* Handover Path highlight */}
          <button
            onClick={() => setIsHandoverPathActive((prev) => !prev)}
            className={`h-7 px-2.5 rounded font-label-sm text-label-sm font-semibold flex items-center gap-1 shadow-sm transition-colors cursor-pointer ${
              isHandoverPathActive
                ? 'bg-primary-fixed text-on-primary-fixed ring-1 ring-primary'
                : 'bg-surface-container-lowest text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">alt_route</span>
            <span>Handover Path</span>
          </button>

          {/* Hops selector */}
          <div className="flex items-center bg-surface-container-lowest rounded shadow-sm px-2 h-7 gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Hops:</span>
            <select
              value={hopDepth}
              onChange={(e) => setHopDepth(Number(e.target.value))}
              className="bg-transparent font-code-inline text-code-inline text-on-surface focus:outline-none cursor-pointer"
            >
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
              <option value={3}>3 hops</option>
              <option value={99}>Unlimited</option>
            </select>
          </div>

          {/* Zoom controller */}
          <div className="flex items-center bg-surface-container-lowest rounded shadow-sm h-7 px-1">
            <button
              onClick={() => handleZoom(-10)}
              className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined text-[14px]">remove</span>
            </button>
            <span className="font-code-inline text-[11px] text-on-surface px-1.5 select-none">{zoomLevel}%</span>
            <button
              onClick={() => handleZoom(10)}
              className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded transition-colors cursor-pointer"
              title="Zoom In"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Workspace: 70% Network Topology Stage / 30% Node Inspector */}
      <div className="w-full flex-1 flex flex-col lg:flex-row overflow-hidden bg-surface relative min-h-[640px]">
        {/* 70% Graph Stage Canvas */}
        <div
          ref={canvasRef}
          className="relative flex-1 lg:w-[70%] min-h-[580px] bg-surface-container-low/40 overflow-auto cursor-grab active:cursor-grabbing select-none"
        >
          {/* Ambient Blueprint Grid Overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40 min-w-[900px] min-h-[600px]"
            style={{
              backgroundSize: '32px 32px',
              backgroundImage: 'radial-gradient(circle, #c7c4d8 1px, transparent 1px)',
            }}
          ></div>

          {/* Canvas Wrapper scaling by Zoom */}
          <div
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top left',
              position: 'relative',
              width: '900px',
              height: '620px',
            }}
          >
            {/* Interactive SVG Connection Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker
                  id="arrow-default"
                  markerHeight="6"
                  markerWidth="6"
                  orient="auto-start-reverse"
                  refX="8"
                  refY="5"
                  viewBox="0 0 10 10"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#777587"></path>
                </marker>
                <marker
                  id="arrow-primary"
                  markerHeight="6"
                  markerWidth="6"
                  orient="auto-start-reverse"
                  refX="8"
                  refY="5"
                  viewBox="0 0 10 10"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#4f46e5"></path>
                </marker>
                <marker
                  id="arrow-danger"
                  markerHeight="6"
                  markerWidth="6"
                  orient="auto-start-reverse"
                  refX="8"
                  refY="5"
                  viewBox="0 0 10 10"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#ba1a1a"></path>
                </marker>
                <linearGradient id="handover-flow" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#3525cd"></stop>
                  <stop offset="100%" stopColor="#4f46e5"></stop>
                </linearGradient>
              </defs>

              {/* Render dynamic bezier curved connection paths */}
              {visibleEdges.map((edge) => {
                const sourceNode = visibleNodes.find((n) => n.id === edge.source);
                const targetNode = visibleNodes.find((n) => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const sx = (sourceNode.x || 300) + 80;
                const sy = (sourceNode.y || 200) + 30;
                const tx = (targetNode.x || 300) + 80;
                const ty = (targetNode.y || 200) + 30;

                const midX = (sx + tx) / 2;
                const midY = (sy + ty) / 2;

                const isBlocked = edge.status === 'blocked' || edge.relationship.includes('blocked');
                const isRelay = edge.relationship.includes('relay');
                const isPrimary = edge.relationship.includes('arch') || edge.relationship.includes('governs');

                const strokeColor = isBlocked
                  ? '#ba1a1a'
                  : isRelay
                  ? 'url(#handover-flow)'
                  : isPrimary
                  ? '#4f46e5'
                  : '#c7c4d8';

                const marker = isBlocked
                  ? 'url(#arrow-danger)'
                  : isPrimary
                  ? 'url(#arrow-primary)'
                  : 'url(#arrow-default)';

                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isRelay ? 2.5 : isBlocked ? 2 : 1.5}
                      strokeDasharray={isRelay ? '5 3' : isBlocked ? '4 2' : undefined}
                      markerEnd={marker}
                    />
                    <text
                      x={midX}
                      y={midY - 4}
                      fill={isBlocked ? '#ba1a1a' : isPrimary ? '#3525cd' : '#464555'}
                      fontFamily="Inter"
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {edge.relationship}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* DOM Node Containers for Precision Styling */}
            {visibleNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isProject = node.entity_type === 'project';
              const isDecision = node.entity_type === 'decision';
              const isRisk = node.entity_type === 'risk';
              const isDocument = node.entity_type === 'document';
              const isOwner = node.entity_type === 'owner';
              const isBlocked = node.status?.toLowerCase().includes('block');

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{ left: `${node.x}px`, top: `${node.y}px` }}
                  className={`absolute z-20 w-[190px] p-2.5 rounded-lg bg-surface-container-lowest shadow-sm hover:shadow-md transition-all cursor-pointer ${
                    isSelected ? 'ring-2 ring-primary-container shadow-md' : ''
                  } ${node.is_orphan ? 'border-2 border-dashed border-error/60' : ''} ${
                    isBlocked ? 'border-l-4 border-l-error' : ''
                  }`}
                >
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-surface-container">
                    <div className="flex items-center gap-1 min-w-0">
                      {isOwner && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-[10px] shrink-0">
                          {node.label.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span
                        className={`px-1.5 py-0.2 rounded font-code-inline text-[9px] font-semibold uppercase truncate ${
                          isProject
                            ? 'bg-primary-fixed text-on-primary-fixed'
                            : isDecision
                            ? 'bg-primary text-on-primary'
                            : isRisk
                            ? 'bg-error-container text-on-error-container'
                            : isDocument
                            ? 'bg-surface-container text-on-surface-variant'
                            : 'bg-secondary-container text-on-secondary-fixed'
                        }`}
                      >
                        {node.entity_type}
                      </span>
                    </div>

                    {node.status && (
                      <span
                        className={`text-[9px] font-label-sm font-semibold px-1 rounded truncate ${
                          isBlocked
                            ? 'bg-error-container text-error'
                            : node.status === 'Ratified' || node.status === 'done'
                            ? 'bg-surface-container-high text-on-surface'
                            : 'text-on-surface-variant'
                        }`}
                      >
                        {node.status}
                      </span>
                    )}
                  </div>

                  <div className="font-headline-sm text-[12px] text-on-surface font-semibold leading-tight truncate mb-1">
                    {node.label}
                  </div>

                  <div className="flex items-center justify-between font-label-sm text-[10px] text-on-surface-variant truncate">
                    <span>{node.subtitle || node.owner || 'Verified node'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Canvas Legend */}
          <div className="absolute left-4 bottom-4 z-30 p-2.5 rounded-lg bg-surface-container-lowest/95 backdrop-blur-sm shadow-md flex flex-col gap-1.5 text-on-surface border border-outline-variant/20">
            <div className="font-label-sm text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
              Canvas Legend
            </div>
            <div className="flex items-center gap-3 font-label-sm text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-primary-container inline-block"></span> Arch Mandate
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-error inline-block"></span> Blocker Line
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-primary inline-block"></span> Owner Relay
              </span>
            </div>
          </div>

          {/* Quick Mini Status Pin */}
          <div className="absolute right-4 bottom-4 z-30 px-3 py-1.5 rounded-lg bg-surface-container-lowest shadow-md flex items-center gap-2 border border-outline-variant/20">
            <span
              className={`w-2 h-2 rounded-full ${
                (graphData?.blocking_paths_count || 0) > 0 ? 'bg-error animate-pulse' : 'bg-tertiary'
              }`}
            ></span>
            <span className="font-label-sm text-label-sm text-on-surface font-medium">
              {graphData?.blocking_paths_count || 0} Blocking Paths to Launch
            </span>
          </div>
        </div>

        {/* 30% Right Selected Node Inspector Panel */}
        <aside className="w-full lg:w-[30%] min-w-[320px] bg-surface-container-lowest border-t lg:border-t-0 lg:border-l border-outline-variant/20 flex flex-col justify-between shadow-sm z-30 p-space-lg">
          {selectedNode ? (
            <div className="flex flex-col gap-space-md overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-outline-variant/15 pb-space-sm">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-code-inline font-bold uppercase bg-primary-fixed text-on-primary-fixed">
                      {selectedNode.entity_type}
                    </span>
                    {selectedNode.is_orphan && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-error-container text-error">
                        Orphaned
                      </span>
                    )}
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-snug">
                    {selectedNode.label}
                  </h3>
                </div>
              </div>

              {/* Status and Impact */}
              <div className="grid grid-cols-2 gap-2 bg-surface-container-low/60 p-2.5 rounded-lg text-[12px]">
                <div>
                  <span className="text-on-surface-variant font-label-sm block">Status</span>
                  <span className="font-semibold text-on-surface">{selectedNode.status || 'Active'}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant font-label-sm block">Impact Scope</span>
                  <span className="font-semibold text-primary">{selectedNode.impact_scope || 'Project Infrastructure'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-on-surface-variant font-label-sm block">Responsible Owner</span>
                  <span className="font-semibold text-on-surface">{selectedNode.owner || 'Not assigned'}</span>
                </div>
              </div>

              {/* Source Citation Box */}
              {selectedNode.citation && (
                <div className="flex flex-col gap-1 bg-surface-container-low/40 p-2.5 rounded-lg border border-outline-variant/20">
                  <span className="font-label-sm text-[11px] uppercase font-bold text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-primary">attachment</span>
                    Evidence Citation Anchor
                  </span>
                  <span className="font-body-sm text-[12px] font-medium text-tertiary">
                    {selectedNode.citation}
                  </span>
                </div>
              )}

              {/* Evidence Quote */}
              {selectedNode.evidence_quote && (
                <div className="flex flex-col gap-1">
                  <span className="font-label-sm text-[11px] uppercase font-bold text-on-surface-variant">
                    Verbatim Document Extract
                  </span>
                  <blockquote className="p-2.5 rounded bg-surface-container text-on-surface font-body-sm text-[12px] leading-relaxed italic border-l-2 border-primary">
                    {selectedNode.evidence_quote}
                  </blockquote>
                </div>
              )}

              {/* Connected Relationships */}
              <div className="flex flex-col gap-2">
                <span className="font-label-sm text-[11px] uppercase font-bold text-on-surface-variant">
                  Connected Lineage
                </span>
                <div className="flex flex-col gap-1 text-[12px]">
                  {selectedNodeConnected.incoming.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-1.5 rounded bg-surface-container-low"
                    >
                      <span className="text-on-surface-variant">← {e.relationship}</span>
                      <span className="font-medium text-on-surface truncate max-w-[140px]">{e.source}</span>
                    </div>
                  ))}
                  {selectedNodeConnected.outgoing.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-1.5 rounded bg-surface-container-low"
                    >
                      <span className="text-on-surface-variant">→ {e.relationship}</span>
                      <span className="font-medium text-on-surface truncate max-w-[140px]">{e.target}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Navigation to Project Record */}
              <div className="pt-2 border-t border-outline-variant/15 flex flex-col gap-2">
                {selectedNode.entity_type === 'decision' && (
                  <button
                    onClick={() => navigate('decisions')}
                    className="w-full h-8 rounded bg-primary-container text-on-primary font-label-md text-label-md font-medium flex items-center justify-center gap-1.5 hover:bg-primary transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">gavel</span>
                    <span>Open in Decisions Register</span>
                  </button>
                )}
                {selectedNode.entity_type === 'task' && (
                  <button
                    onClick={() => navigate('my-tasks')}
                    className="w-full h-8 rounded bg-primary-container text-on-primary font-label-md text-label-md font-medium flex items-center justify-center gap-1.5 hover:bg-primary transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Open in My Tasks</span>
                  </button>
                )}
                {selectedNode.entity_type === 'document' && (
                  <button
                    onClick={() => navigate('documents')}
                    className="w-full h-8 rounded bg-primary-container text-on-primary font-label-md text-label-md font-medium flex items-center justify-center gap-1.5 hover:bg-primary transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">description</span>
                    <span>Open in Documents Hub</span>
                  </button>
                )}
                {selectedNode.entity_type === 'risk' && (
                  <button
                    onClick={() => navigate('ai-review-queue')}
                    className="w-full h-8 rounded bg-primary-container text-on-primary font-label-md text-label-md font-medium flex items-center justify-center gap-1.5 hover:bg-primary transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                    <span>Review in AI Queue</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-on-surface-variant">
              Select any node in the map to inspect its connections, evidence citations, and lineage.
            </div>
          )}
        </aside>
      </div>
        </>
      )}
    </div>
  );
};
