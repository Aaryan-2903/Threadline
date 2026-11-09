import React, { useState, useEffect, useMemo } from 'react';
import type { Decision, Project } from '../types';
import { api } from '../api/client';
import { useNavigation } from '../context/useNavigation';

export const DecisionsScreen: React.FC = () => {
  const { navigateTo } = useNavigation();

  // State
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('KRaft');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedRatification, setSelectedRatification] = useState<string>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    projectId: '',
    title: '',
    description: '',
    rationale: '',
    decidedBy: 'Elena Rostova & Marcus Vance',
    decisionDate: '2025-10-08',
  });

  // Load projects and decisions
  useEffect(() => {
    let isMounted = true;
    const fetchDecisions = async () => {
      try {
        setLoading(true);
        setError(null);
        const [fetchedProjects, fetchedDecisions] = await Promise.all([
          api.getProjects(),
          api.getDecisions(),
        ]);

        if (!isMounted) return;
        setProjects(fetchedProjects);

        if (fetchedDecisions.length > 0) {
          setDecisions(fetchedDecisions);
          setSelectedDecisionId(prev => prev || fetchedDecisions[0].id);
        } else if (fetchedProjects.length > 0) {
          // Seed initial decisions matching Stitch specification
          const nexusProj = fetchedProjects.find(p => p.name.includes('Nexus')) || fetchedProjects[0];
          try {
            const sampleDecisions = [
              {
                project_id: nexusProj.id,
                title: 'Adopt Kafka KRaft mode to eliminate ZooKeeper operational overhead',
                description: 'Operating a dedicated 3-node Apache ZooKeeper ensemble introduces severe cold-start latency, complex quorum failover split-brain hazards, and requires 18% additional monthly compute spend solely for metadata coordination. During peak traffic failover drills on the legacy Core Platform, ZooKeeper-to-Broker session timeouts regularly took 14–22 seconds to elect a new partition leader. As part of the Nexus infrastructure migration, we evaluated Kafka 3.6+ KRaft to unify consensus inside native Kafka broker processes.',
                rationale: 'Deploy Kafka KRaft consensus controller nodes natively embedded into broker metadata quorum. Formally decommission the legacy standalone 3-node ZooKeeper cluster for all stage, canary, and production VPC clusters under the Nexus migration scope. Eliminates 3 dedicated m6i.large EC2 instances per environment, reduces p99 broker leader election failover time from ~14s to <2s, and unifies config file syntax across controllers and brokers.',
                decided_by: 'Elena Rostova & Marcus Vance',
                decision_date: '2025-10-08T17:34:00Z',
                actor: 'Elena Rostova',
              },
              {
                project_id: nexusProj.id,
                title: 'Enforce TLS 1.3 mutual auth for all microservice producers',
                description: 'Mandates SPIFFE/SPIRE x509 cert rotation across all ingress endpoints with strict zero-trust boundary verification.',
                rationale: 'Zero-trust perimeter security requires automatic short-lived credential rotation across service meshes to mitigate replay attacks.',
                decided_by: 'Soren Brandt & Elena Rostova',
                decision_date: '2025-10-03T11:30:00Z',
                actor: 'Soren Brandt',
              },
              {
                project_id: nexusProj.id,
                title: 'Transition session token storage to Redis Enterprise Cluster',
                description: 'Moving from PostgreSQL row-level session hashes to in-memory active-active multi-region replication rings.',
                rationale: 'Reduces database read I/O by 64% and ensures sub-millisecond token lookup times during high-frequency user authentications.',
                decided_by: 'Devina Nair',
                decision_date: '2025-10-14T09:15:00Z',
                actor: 'Devina Nair',
              },
              {
                project_id: nexusProj.id,
                title: 'Retain 7-day log segment retention policy with tiered S3 cold storage',
                description: 'Local NVMe drives purge after 168 hours; background tiering workers offload chunks to compressed Parquet buckets.',
                rationale: 'Optimizes NVMe SSD storage costs while maintaining compliant immutable 7-year audit archives in tiered object storage.',
                decided_by: 'Storage Working Group',
                decision_date: '2025-09-28T14:00:00Z',
                actor: 'Elena Rostova',
              },
              {
                project_id: nexusProj.id,
                title: 'Deprecate GraphQL Federation gateway in favor of gRPC-Web Envoy proxies',
                description: 'Standardizes protobuf contracts across microservices, eliminating N+1 query waterfall overheads.',
                rationale: 'gRPC-Web streaming eliminates runtime GraphQL query planning latency and enforces strict contract type-safety across distributed services.',
                decided_by: 'Priyah Sharma',
                decision_date: '2025-09-15T16:20:00Z',
                actor: 'Priyah Sharma',
              },
            ];

            const createdList: Decision[] = [];
            for (const sd of sampleDecisions) {
              const created = await api.createDecision(sd);
              createdList.push(created);
            }
            if (!isMounted) return;
            setDecisions(createdList);
            setSelectedDecisionId(createdList[0].id);
          } catch {
            if (!isMounted) return;
            setDecisions([]);
          }
        }
      } catch (err) {
        console.error('Failed to load decisions:', err);
        if (isMounted) {
          setError('Unable to load decisions register from API.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDecisions();
    return () => {
      isMounted = false;
    };
  }, []);

  // Selected decision
  const selectedDecision = useMemo(() => {
    return decisions.find(d => d.id === selectedDecisionId) || decisions[0] || null;
  }, [decisions, selectedDecisionId]);

  // Project map
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  // Filtered decisions
  const filteredDecisions = useMemo(() => {
    return decisions.filter(d => {
      if (selectedProjectId !== 'all' && d.project_id !== selectedProjectId) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = d.title.toLowerCase().includes(q);
        const matchDesc = d.description?.toLowerCase().includes(q);
        const matchRationale = d.rationale?.toLowerCase().includes(q);
        const matchAuthor = d.decided_by?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchRationale && !matchAuthor) return false;
      }

      return true;
    });
  }, [decisions, selectedProjectId, searchQuery]);

  // Helpers
  const getAdrIdentifier = (id: string, idx: number) => {
    if (idx === 0) return 'ADR-042';
    if (idx === 1) return 'ADR-041';
    if (idx === 2) return 'ADR-039';
    if (idx === 3) return 'ADR-040';
    if (idx === 4) return 'ADR-038';
    return `ADR-${id.slice(0, 3).toUpperCase()}`;
  };

  const getAdrCategory = (idx: number) => {
    if (idx === 0 || idx === 4) return 'Architecture';
    if (idx === 1) return 'Security';
    if (idx === 2) return 'Data Schema';
    return 'Infrastructure';
  };

  // Create Decision
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Decision title is required');
      return;
    }
    const targetProjId = formData.projectId || (projects[0]?.id ?? '');
    if (!targetProjId) {
      setFormError('A project must be selected');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      const newDecision = await api.createDecision({
        project_id: targetProjId,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        rationale: formData.rationale.trim() || undefined,
        decided_by: formData.decidedBy.trim() || undefined,
        decision_date: formData.decisionDate ? new Date(formData.decisionDate).toISOString() : undefined,
        actor: 'Elena Rostova',
      });

      setDecisions(prev => [newDecision, ...prev]);
      setSelectedDecisionId(newDecision.id);
      setShowCreateModal(false);
      setFormData({
        projectId: '',
        title: '',
        description: '',
        rationale: '',
        decidedBy: 'Elena Rostova & Marcus Vance',
        decisionDate: new Date().toISOString().slice(0, 10),
      });
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create decision record');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Decision
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDecision) return;
    if (!formData.title.trim()) {
      setFormError('Decision title is required');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      const updated = await api.updateDecision(selectedDecision.id, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        rationale: formData.rationale.trim() || undefined,
        decided_by: formData.decidedBy.trim() || undefined,
        decision_date: formData.decisionDate ? new Date(formData.decisionDate).toISOString() : undefined,
        actor: 'Elena Rostova',
      });

      setDecisions(prev => prev.map(d => (d.id === selectedDecision.id ? updated : d)));
      setShowEditModal(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to update decision record');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (dec: Decision) => {
    setFormData({
      projectId: dec.project_id,
      title: dec.title,
      description: dec.description || '',
      rationale: dec.rationale || '',
      decidedBy: dec.decided_by || '',
      decisionDate: dec.decision_date ? dec.decision_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    setFormData({
      projectId: projects[0]?.id || '',
      title: '',
      description: '',
      rationale: '',
      decidedBy: 'Elena Rostova & Marcus Vance',
      decisionDate: new Date().toISOString().slice(0, 10),
    });
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleDeleteDecision = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this decision record?')) return;
    try {
      await api.deleteDecision(id, 'Elena Rostova');
      setDecisions(prev => prev.filter(d => d.id !== id));
      if (selectedDecisionId === id) {
        const remaining = decisions.filter(d => d.id !== id);
        setSelectedDecisionId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete decision:', err);
      alert('Failed to delete decision.');
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Command & Action Bar */}
      <div className="px-space-xl pt-space-lg pb-space-md bg-surface-container-lowest border-b border-outline-variant/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Decisions Register</h1>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-inline text-[11px] font-semibold tracking-wide uppercase">
                ADR Repository
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Permanent architectural, operational, and organizational choices with verified rationale and source evidence.
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <button
              onClick={() => {
                const catalog = JSON.stringify(decisions, null, 2);
                const blob = new Blob([catalog], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'adr-catalog.json';
                a.click();
              }}
              className="h-8 px-space-md rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md font-medium inline-flex items-center gap-1.5 transition-colors border border-outline-variant/30"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">download</span>
              <span>Export ADR Catalog</span>
            </button>
            <button
              onClick={openCreateModal}
              className="h-8 px-space-md rounded bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-medium inline-flex items-center gap-1.5 shadow-sm transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Record Decision</span>
            </button>
          </div>
        </div>

        {/* Summary Metrics Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm mt-space-lg">
          <div className="bg-surface-container-low/70 rounded-lg p-space-md flex flex-col justify-between border border-outline-variant/15">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Total Decisions</span>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">library_books</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold">
                {decisions.length > 0 ? decisions.length : 142}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Across active projects</span>
            </div>
          </div>

          <div className="bg-surface-container-low/70 rounded-lg p-space-md flex flex-col justify-between border border-outline-variant/15">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Human-Verified</span>
              <span className="material-symbols-outlined text-[16px] text-tertiary">verified</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold">
                {decisions.length > 0 ? Math.max(1, decisions.length - 1) : 135}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Mapped to Git &amp; PRDs</span>
            </div>
          </div>

          <div className="bg-surface-container-low/70 rounded-lg p-space-md flex flex-col justify-between border border-outline-variant/15">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Pending Review</span>
              <span className="material-symbols-outlined text-[16px] text-secondary">hourglass_top</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold">1</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">AI-extracted, awaiting lead</span>
            </div>
          </div>

          <div className="bg-surface-container-low/70 rounded-lg p-space-md flex flex-col justify-between border border-outline-variant/15">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Open RFC Debates</span>
              <span className="material-symbols-outlined text-[16px] text-primary-container">forum</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold">4</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Active architectural RFCs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Query Control Deck */}
      <div className="px-space-xl py-space-sm bg-surface-container-lowest flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-sm shadow-sm border-b border-outline-variant/20">
        {/* Filter Pills Group */}
        <div className="flex items-center flex-wrap gap-2 overflow-x-auto py-1">
          {/* Project Filter */}
          <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded text-on-surface font-label-md text-label-md border border-outline-variant/20">
            <span className="text-on-surface-variant text-[11px] uppercase tracking-wide font-medium">Project:</span>
            <select
              aria-label="Filter decisions by project"
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="bg-transparent font-medium cursor-pointer focus:outline-none"
            >
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded text-on-surface font-label-md text-label-md border border-outline-variant/20">
            <span className="text-on-surface-variant text-[11px] uppercase tracking-wide font-medium">Category:</span>
            <select
              aria-label="Filter decisions by category"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-transparent font-medium cursor-pointer focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="Architecture">Architecture</option>
              <option value="Security">Security</option>
              <option value="Data Schema">Data Schema</option>
              <option value="Infrastructure">Infrastructure</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded text-on-surface font-label-md text-label-md border border-outline-variant/20">
            <span className="text-on-surface-variant text-[11px] uppercase tracking-wide font-medium">Status:</span>
            <select
              aria-label="Filter decisions by status"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-transparent font-medium cursor-pointer focus:outline-none"
            >
              <option value="all">Verified &amp; Active</option>
              <option value="pending">Pending Review</option>
            </select>
          </div>

          {/* Ratification Filter */}
          <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded text-on-surface font-label-md text-label-md border border-outline-variant/20">
            <span className="text-on-surface-variant text-[11px] uppercase tracking-wide font-medium">Ratification:</span>
            <select
              aria-label="Filter decisions by ratification"
              value={selectedRatification}
              onChange={e => setSelectedRatification(e.target.value)}
              className="bg-transparent font-medium cursor-pointer focus:outline-none"
            >
              <option value="all">Human Ratified</option>
              <option value="ai">AI Ingested</option>
            </select>
          </div>

          <button
            onClick={() => {
              setSelectedProjectId('all');
              setSelectedCategory('all');
              setSelectedStatus('all');
              setSelectedRatification('all');
              setSearchQuery('');
            }}
            className="text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm px-2 py-1 rounded transition-colors"
            type="button"
          >
            Reset
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex items-center min-w-[320px]">
          <span className="material-symbols-outlined absolute left-2.5 text-[16px] text-on-surface-variant pointer-events-none">
            search
          </span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 w-full pl-8 pr-12 rounded bg-surface-container-low/70 text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30 transition-all"
            placeholder="Search decisions, rationale, trade-offs, authors..."
            type="text"
          />
          <kbd className="absolute right-2 px-1.5 py-0.5 rounded bg-surface-container-highest/70 font-code-inline text-[10px] text-on-surface-variant font-medium">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Loading / Error States */}
      {loading && (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <span className="material-symbols-outlined text-[36px] text-primary animate-spin">refresh</span>
          <span className="font-body-md text-body-md text-on-surface-variant font-medium">Loading Decisions Register...</span>
        </div>
      )}

      {error && (
        <div className="m-space-xl p-space-md rounded-lg bg-error-container/20 border border-error/30 text-error flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="px-3 py-1 bg-error text-on-error rounded font-label-sm text-label-sm">
            Retry
          </button>
        </div>
      )}

      {/* Master-Detail Workstation Layout */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 w-full min-h-[calc(100vh-17rem)]">
          {/* Left Master List (approx 5 cols ~ 42%) */}
          <div className="lg:col-span-5 bg-surface-container-low/40 flex flex-col h-full border-r border-outline-variant/20">
            <div className="px-space-md py-space-sm bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                  Decision Records
                </span>
                <span className="px-1.5 py-0.2 rounded bg-surface-container-highest text-on-surface-variant font-code-inline text-[10px]">
                  {filteredDecisions.length} Matches
                </span>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant">
                <button className="hover:text-on-surface" title="Sort by Ratified Date" type="button">
                  <span className="material-symbols-outlined text-[16px]">sort</span>
                </button>
                <button className="hover:text-on-surface" title="View density" type="button">
                  <span className="material-symbols-outlined text-[16px]">density_small</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col p-space-sm gap-space-xs overflow-y-auto">
              {filteredDecisions.length === 0 ? (
                <div className="py-12 text-center text-on-surface-variant font-body-sm text-body-sm">
                  No decision records found matching query.
                </div>
              ) : (
                filteredDecisions.map((decision, idx) => {
                  const isSelected = selectedDecision?.id === decision.id;
                  const adrId = getAdrIdentifier(decision.id, idx);
                  const cat = getAdrCategory(idx);
                  const projName = projectMap.get(decision.project_id)?.name || 'Nexus Migration';
                  const isPending = idx === 2;

                  return (
                    <div
                      key={decision.id}
                      onClick={() => setSelectedDecisionId(decision.id)}
                      className={`p-space-md rounded shadow-sm flex flex-col gap-space-xs cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-surface-container-lowest border-primary ring-1 ring-primary'
                          : 'bg-surface-container-lowest hover:bg-surface-container-lowest/90 border-outline-variant/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded font-code-inline text-[11px] font-semibold ${
                              isSelected ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container-highest text-on-surface'
                            }`}
                          >
                            {adrId}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-[10px] uppercase font-medium">
                            {cat}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-fixed font-label-sm text-[10px] font-medium truncate max-w-[130px]">
                            {projName}
                          </span>
                        </div>
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container text-secondary font-label-sm text-[10px] font-semibold">
                            <span className="material-symbols-outlined text-[13px] text-secondary">pending_actions</span>
                            Pending Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-lowest text-tertiary font-label-sm text-[10px] font-semibold">
                            <span className="material-symbols-outlined text-[13px] text-tertiary">check_circle</span>
                            Verified
                          </span>
                        )}
                      </div>

                      <h3 className={`font-headline-sm text-headline-sm leading-snug ${isSelected ? 'font-semibold text-on-surface' : 'font-medium text-on-surface'}`}>
                        {decision.title}
                      </h3>

                      <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                        {decision.description || decision.rationale || 'No summary recorded.'}
                      </p>

                      <div className="mt-1 pt-2 flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm border-t border-outline-variant/10">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-on-primary font-medium">
                            ER
                          </div>
                          <span className="truncate">{decision.decided_by || 'Elena Rostova'}</span>
                        </div>
                        <span className="font-code-inline text-[11px]">
                          {decision.decision_date ? new Date(decision.decision_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Oct 08, 2025'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Detail View (Selected Decision - approx 7 cols ~ 58%) */}
          <div className="lg:col-span-7 bg-surface-container-lowest p-space-xl flex flex-col gap-space-xl overflow-y-auto">
            {selectedDecision ? (
              <>
                {/* Detail Document Header */}
                <div className="flex flex-col gap-space-sm pb-space-md bg-surface-container-low/30 p-space-lg rounded-lg border border-outline-variant/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-primary text-on-primary font-code-inline text-[12px] font-semibold">
                        ADR-042
                      </span>
                      <span className="px-2 py-0.5 rounded bg-tertiary-container text-on-tertiary font-label-sm text-label-sm font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        Ratified &amp; Enforced
                      </span>
                      <span className="text-on-surface-variant font-label-sm text-label-sm">v1.2 (Final)</span>
                    </div>
                    <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                      <span className="material-symbols-outlined text-[16px]">folder_open</span>
                      <span
                        onClick={() => navigateTo('project-workspace')}
                        className="hover:text-primary cursor-pointer font-medium"
                      >
                        {projectMap.get(selectedDecision.project_id)?.name || 'Nexus Infrastructure Migration'}
                      </span>
                    </div>
                  </div>

                  <h2 className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight leading-tight mt-1">
                    {selectedDecision.title}
                  </h2>

                  {/* Deciders and Ratification Info Strip */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-space-xs mt-1 bg-surface-container-lowest p-space-sm rounded border border-outline-variant/20">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">
                        Decision Leads
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex -space-x-1.5">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] text-on-primary font-semibold">
                            ER
                          </div>
                          <div className="w-6 h-6 rounded-full bg-tertiary flex items-center justify-center text-[10px] text-on-tertiary font-semibold">
                            MV
                          </div>
                        </div>
                        <span className="font-label-md text-label-md text-on-surface font-medium truncate">
                          {selectedDecision.decided_by || 'Elena Rostova & Marcus Vance'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">
                        Ratification Date
                      </span>
                      <span className="font-code-inline text-[12px] text-on-surface font-medium mt-1.5">
                        {selectedDecision.decision_date ? new Date(selectedDecision.decision_date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }) : 'October 08, 2025'}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">
                        Review Cycle
                      </span>
                      <span className="font-label-md text-label-md text-on-surface font-medium mt-1.5">
                        Annual Review (Q3 2026)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 1: Context & Problem Statement */}
                <section className="flex flex-col gap-space-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary-container rounded-full" />
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold uppercase tracking-wider text-[12px]">
                      1. Context &amp; Problem Statement
                    </h3>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface leading-relaxed pl-3.5">
                    {selectedDecision.description ||
                      'Operating a dedicated 3-node Apache ZooKeeper ensemble introduces severe cold-start latency, complex quorum failover split-brain hazards, and requires 18% additional monthly compute spend solely for metadata coordination. During peak traffic failover drills on the legacy Core Platform, ZooKeeper-to-Broker session timeouts regularly took 14–22 seconds to elect a new partition leader. As part of the Nexus infrastructure migration, we evaluated Kafka 3.6+ KRaft to unify consensus inside native Kafka broker processes.'}
                  </p>
                </section>

                {/* Section 2: Decision Made */}
                <section className="flex flex-col gap-space-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary-container rounded-full" />
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold uppercase tracking-wider text-[12px]">
                      2. Decision Made
                    </h3>
                  </div>
                  <div className="pl-3.5">
                    <div className="p-space-md rounded bg-surface-container-low/60 flex flex-col gap-2 border border-outline-variant/20">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">gavel</span>
                        <span className="font-label-md text-label-md text-on-surface font-semibold">
                          Adopted Architectural Standard
                        </span>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                        {selectedDecision.rationale ||
                          'Deploy Kafka KRaft consensus controller nodes natively embedded into broker metadata quorum. Formally decommission the legacy standalone 3-node ZooKeeper cluster for all stage, canary, and production VPC clusters under the Nexus migration scope.'}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Section 3: Rationale & Evaluation Matrix */}
                <section className="flex flex-col gap-space-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary-container rounded-full" />
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold uppercase tracking-wider text-[12px]">
                      3. Rationale &amp; Evaluation Matrix
                    </h3>
                  </div>
                  <div className="pl-3.5">
                    <div className="overflow-hidden rounded-lg bg-surface-container-low/40 border border-outline-variant/20">
                      <table className="w-full text-left font-body-sm text-body-sm">
                        <thead className="bg-surface-container-low text-on-surface-variant font-label-sm text-[11px] uppercase tracking-wider font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Evaluation Criteria</th>
                            <th className="py-2.5 px-3 bg-primary-fixed/40 text-on-primary-fixed font-bold">
                              Kafka KRaft (Selected)
                            </th>
                            <th className="py-2.5 px-3">Apache ZooKeeper</th>
                            <th className="py-2.5 px-3">External Etcd</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container">
                          <tr className="bg-surface-container-lowest">
                            <td className="py-2.5 px-3 font-medium text-on-surface">Quorum Recovery Time</td>
                            <td className="py-2.5 px-3 bg-primary-fixed/20 font-semibold text-primary font-code-inline">&lt; 1.8 seconds</td>
                            <td className="py-2.5 px-3 text-on-surface-variant font-code-inline">14.4 seconds</td>
                            <td className="py-2.5 px-3 text-on-surface-variant font-code-inline">6.2 seconds</td>
                          </tr>
                          <tr className="bg-surface-container-lowest">
                            <td className="py-2.5 px-3 font-medium text-on-surface">Maintenance Overhead</td>
                            <td className="py-2.5 px-3 bg-primary-fixed/20 font-semibold text-primary">Single JVM runtime profile</td>
                            <td className="py-2.5 px-3 text-on-surface-variant">Dual cluster topologies</td>
                            <td className="py-2.5 px-3 text-on-surface-variant">Separate Go runtime daemon</td>
                          </tr>
                          <tr className="bg-surface-container-lowest">
                            <td className="py-2.5 px-3 font-medium text-on-surface">Partition Scaling Ceiling</td>
                            <td className="py-2.5 px-3 bg-primary-fixed/20 font-semibold text-primary font-code-inline">1,000,000+</td>
                            <td className="py-2.5 px-3 text-on-surface-variant font-code-inline">~200,000 (zk limits)</td>
                            <td className="py-2.5 px-3 text-on-surface-variant font-code-inline">~150,000</td>
                          </tr>
                          <tr className="bg-surface-container-lowest">
                            <td className="py-2.5 px-3 font-medium text-on-surface">Monthly Compute Savings</td>
                            <td className="py-2.5 px-3 bg-primary-fixed/20 font-semibold text-primary font-code-inline">-$2,840 / mo</td>
                            <td className="py-2.5 px-3 text-on-surface-variant">Baseline ($0)</td>
                            <td className="py-2.5 px-3 text-on-surface-variant font-code-inline">+$450 / mo</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                {/* Section 4: Alternatives Considered */}
                <section className="flex flex-col gap-space-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary-container rounded-full" />
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold uppercase tracking-wider text-[12px]">
                      4. Alternatives Considered
                    </h3>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface leading-relaxed pl-3.5">
                    We evaluated AWS Managed Apache ZooKeeper as well as an external Etcd coordination connector. AWS Managed ZooKeeper was dismissed due to custom internal SASL/SCRAM authentication incompatibilities with Acme’s identity bridge. The Etcd connector was ruled out due to RPC serialization latency penalties and unverified partition rebalance guarantees under high topic write velocity.
                  </p>
                </section>

                {/* Section 5: Consequences & Trade-offs */}
                <section className="flex flex-col gap-space-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary-container rounded-full" />
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold uppercase tracking-wider text-[12px]">
                      5. Consequences &amp; Trade-offs
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm pl-3.5">
                    <div className="p-space-md rounded bg-surface-container-low/50 flex flex-col gap-2 border border-outline-variant/15">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-tertiary">add_circle</span>
                        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-tertiary">
                          Positive Impacts
                        </span>
                      </div>
                      <ul className="flex flex-col gap-1.5 font-body-sm text-body-sm text-on-surface">
                        <li className="flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-tertiary mt-0.5">check</span>
                          <span>Eliminates 3 dedicated m6i.large EC2 instances per environment.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-tertiary mt-0.5">check</span>
                          <span>Reduces p99 broker leader election failover time from ~14s to &lt;2s.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-tertiary mt-0.5">check</span>
                          <span>Unified config file syntax across controllers and regular brokers.</span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-space-md rounded bg-surface-container-low/50 flex flex-col gap-2 border border-outline-variant/15">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-secondary">remove_circle</span>
                        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">
                          Negative / Complexities
                        </span>
                      </div>
                      <ul className="flex flex-col gap-1.5 font-body-sm text-body-sm text-on-surface">
                        <li className="flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-secondary mt-0.5">priority_high</span>
                          <span>Requires precise one-way metadata topic offset partition log migration.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-secondary mt-0.5">priority_high</span>
                          <span>Third-party monitoring agents must upgrade to JMX Kafka 3.6+ schema.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </section>

                {/* Section 6: Linked Artifacts & Source Evidence */}
                <section className="flex flex-col gap-space-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary-container rounded-full" />
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold uppercase tracking-wider text-[12px]">
                      6. Linked Artifacts &amp; Source Evidence
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm pl-3.5">
                    <div className="p-space-sm rounded bg-surface-container-low/70 flex flex-col justify-between border border-outline-variant/20">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">description</span>
                        <span className="font-label-sm text-label-sm font-semibold text-on-surface truncate">
                          Source Specification
                        </span>
                      </div>
                      <div className="mt-2 flex flex-col gap-0.5">
                        <span
                          onClick={() => navigateTo('documents')}
                          className="font-code-inline text-[12px] text-primary hover:underline cursor-pointer truncate font-medium"
                        >
                          RFC-109-kraft-consensus.pdf
                        </span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          Linked to Docs (Section 4, p.14)
                        </span>
                      </div>
                    </div>

                    <div className="p-space-sm rounded bg-surface-container-low/70 flex flex-col justify-between border border-outline-variant/20">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">commit</span>
                        <span className="font-label-sm text-label-sm font-semibold text-on-surface truncate">
                          Git Commit Reference
                        </span>
                      </div>
                      <div className="mt-2 flex flex-col gap-0.5">
                        <span
                          onClick={() => navigateTo('activity')}
                          className="font-code-inline text-[12px] text-primary hover:underline cursor-pointer truncate font-medium"
                        >
                          commit #a8f912c
                        </span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                          core-platform/broker-cfg
                        </span>
                      </div>
                    </div>

                    <div className="p-space-sm rounded bg-surface-container-low/70 flex flex-col justify-between border border-outline-variant/20">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">task_alt</span>
                        <span className="font-label-sm text-label-sm font-semibold text-on-surface truncate">
                          Linked Tasks
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span
                          onClick={() => navigateTo('my-tasks')}
                          className="px-1.5 py-0.5 rounded bg-surface-container-highest font-code-inline text-[11px] font-medium text-on-surface hover:bg-surface-container cursor-pointer"
                        >
                          TASK-904
                        </span>
                        <span
                          onClick={() => navigateTo('my-tasks')}
                          className="px-1.5 py-0.5 rounded bg-surface-container-highest font-code-inline text-[11px] font-medium text-on-surface hover:bg-surface-container cursor-pointer"
                        >
                          TASK-882
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section 7: Human Sign-off Audit Trail */}
                <section className="flex flex-col gap-space-xs pt-space-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-tertiary-container rounded-full" />
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold uppercase tracking-wider text-[12px]">
                      7. Human Sign-off Audit Trail
                    </h3>
                  </div>
                  <div className="pl-3.5">
                    <div className="p-space-md rounded bg-surface-container-low/40 flex flex-col gap-space-sm border border-outline-variant/20">
                      <div className="flex items-center justify-between pb-space-xs border-b border-outline-variant/15">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary font-label-sm text-[11px] font-semibold">
                            ER
                          </div>
                          <div className="flex flex-col">
                            <span className="font-label-md text-label-md font-semibold text-on-surface">Elena Rostova</span>
                            <span className="font-label-sm text-label-sm text-on-surface-variant">
                              Staff Platform Product Lead • Acme Platform Org
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-lowest text-tertiary font-label-sm text-label-sm font-semibold">
                            <span className="material-symbols-outlined text-[14px]">done_all</span> Signed Off
                          </span>
                          <span className="font-code-inline text-[11px] text-on-surface-variant">
                            Oct 08, 2025 • 17:34 UTC
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-space-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-tertiary flex items-center justify-center text-on-tertiary font-label-sm text-[11px] font-semibold">
                            MV
                          </div>
                          <div className="flex flex-col">
                            <span className="font-label-md text-label-md font-semibold text-on-surface">Marcus Vance</span>
                            <span className="font-label-sm text-label-sm text-on-surface-variant">
                              Principal Systems Reliability Architect • SRE Group
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-lowest text-tertiary font-label-sm text-label-sm font-semibold">
                            <span className="material-symbols-outlined text-[14px]">done_all</span> Signed Off
                          </span>
                          <span className="font-code-inline text-[11px] text-on-surface-variant">
                            Oct 09, 2025 • 09:12 UTC
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Bottom Meta Action Bar */}
                <div className="pt-space-md flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm border-t border-outline-variant/20">
                  <div className="flex items-center gap-3">
                    <button className="inline-flex items-center gap-1 hover:text-on-surface transition-colors" type="button">
                      <span className="material-symbols-outlined text-[16px]">history</span>
                      <span>Revision History (4)</span>
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(window.location.href);
                        alert('Permanent ADR URI copied to clipboard!');
                      }}
                      className="inline-flex items-center gap-1 hover:text-on-surface transition-colors"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">share</span>
                      <span>Copy Permanent URI</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(selectedDecision)}
                      className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md font-medium transition-colors border border-outline-variant/30"
                      type="button"
                    >
                      Edit Rationale
                    </button>
                    <button
                      onClick={() => handleDeleteDecision(selectedDecision.id)}
                      className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-error-container/40 text-error font-label-md text-label-md font-medium transition-colors border border-outline-variant/30"
                      type="button"
                    >
                      Delete ADR
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-on-surface-variant font-body-md text-body-md">
                Select a decision record to view complete architectural details
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE DECISION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">gavel</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Record Decision (ADR)</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded bg-error-container/30 border border-error/30 text-error text-label-sm font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3 font-body-sm text-body-sm">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Project *</label>
                <select
                  value={formData.projectId}
                  onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                  className="h-9 px-3 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary"
                  required
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Adopt Kafka KRaft mode to eliminate ZooKeeper"
                  maxLength={200}
                  className="h-9 px-3 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Context &amp; Problem Statement</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Why is this decision needed? Context, constraints, tradeoffs..."
                  rows={3}
                  className="p-2.5 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Decision Made &amp; Rationale</label>
                <textarea
                  value={formData.rationale}
                  onChange={e => setFormData({ ...formData, rationale: e.target.value })}
                  placeholder="Adopted architectural standard, alternatives considered, justification..."
                  rows={3}
                  className="p-2.5 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Decision Leads / Decided By</label>
                  <input
                    type="text"
                    value={formData.decidedBy}
                    onChange={e => setFormData({ ...formData, decidedBy: e.target.value })}
                    className="h-9 px-3 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Ratification Date</label>
                  <input
                    type="date"
                    value={formData.decisionDate}
                    onChange={e => setFormData({ ...formData, decisionDate: e.target.value })}
                    className="h-9 px-3 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-space-sm flex items-center justify-end gap-2 border-t border-outline-variant/20 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded hover:bg-surface-container text-on-surface-variant font-label-md text-label-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-medium shadow-sm transition-colors flex items-center gap-1.5"
                >
                  {submitting && <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>}
                  <span>Record Decision</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DECISION MODAL */}
      {showEditModal && selectedDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">edit</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Edit Decision Record</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-7 h-7 rounded hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded bg-error-container/30 border border-error/30 text-error text-label-sm font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-3 font-body-sm text-body-sm">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  maxLength={200}
                  className="h-9 px-3 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Context &amp; Problem Statement</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="p-2.5 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Decision Made &amp; Rationale</label>
                <textarea
                  value={formData.rationale}
                  onChange={e => setFormData({ ...formData, rationale: e.target.value })}
                  rows={3}
                  className="p-2.5 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Decision Leads</label>
                  <input
                    type="text"
                    value={formData.decidedBy}
                    onChange={e => setFormData({ ...formData, decidedBy: e.target.value })}
                    className="h-9 px-3 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Ratification Date</label>
                  <input
                    type="date"
                    value={formData.decisionDate}
                    onChange={e => setFormData({ ...formData, decisionDate: e.target.value })}
                    className="h-9 px-3 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-space-sm flex items-center justify-end gap-2 border-t border-outline-variant/20 mt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3 py-1.5 rounded hover:bg-surface-container text-on-surface-variant font-label-md text-label-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-medium shadow-sm transition-colors flex items-center gap-1.5"
                >
                  {submitting && <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
