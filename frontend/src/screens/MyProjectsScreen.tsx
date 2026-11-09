import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/useNavigation';
import { StatusBadge } from '../components/common/StatusBadge';
import { OwnerTransitionBadge } from '../components/common/OwnerTransitionBadge';
import { ProgressBar } from '../components/common/ProgressBar';
import { api } from '../api/client';
import type { Project } from '../types';

// Default projects matching the exact Stitch design
const initialProjects: Project[] = [
  {
    id: 'INF-109',
    name: 'Nexus Infrastructure Migration',
    code: 'INF-109',
    description: 'Migrating multi-tenant event bus to Kafka clusters without downtime',
    status: 'in_handover',
    created_at: '2025-08-15T10:00:00Z',
    updated_at: '2025-10-24T09:42:00Z',
    progress: 82,
    decisions_count: 42,
    total_tasks: 22,
    completed_tasks: 18,
    documents_count: 8,
    health_status: 'review_required',
    health_label: 'Handover in Progress (85% verified)',
    outgoing_owner: { name: 'Elena R.', avatar: '', role: 'Staff PM (Outgoing)' },
    incoming_owner: { name: 'Marcus V.', avatar: '', role: 'Principal SRE (Incoming)' },
    handover_days_left: 12,
    last_activity: '2h ago',
  },
  {
    id: 'BIL-402',
    name: 'Checkout & Billing Service v2',
    code: 'BIL-402',
    description: 'Decoupling payment gateway abstractions and usage billing',
    status: 'active',
    created_at: '2025-07-20T10:00:00Z',
    updated_at: '2025-10-24T08:00:00Z',
    progress: 91,
    decisions_count: 28,
    total_tasks: 22,
    completed_tasks: 14,
    documents_count: 12,
    health_status: 'verified',
    health_label: 'Continuity High (98%)',
    outgoing_owner: { name: 'David Lin', avatar: '', role: 'Active Project Lead' },
    incoming_owner: { name: 'Elena R.', avatar: '', role: 'Reviewer' },
    last_activity: '4h ago',
  },
  {
    id: 'SEC-88',
    name: 'Enterprise RBAC & Directory Sync',
    code: 'SEC-88',
    description: 'SCIM v2 and Okta/Azure AD enterprise identity federation',
    status: 'in_handover',
    created_at: '2025-06-10T10:00:00Z',
    updated_at: '2025-10-23T14:00:00Z',
    progress: 64,
    decisions_count: 56,
    total_tasks: 34,
    completed_tasks: 9,
    documents_count: 15,
    health_status: 'high_risk',
    health_label: 'Review Required (2 blockers)',
    outgoing_owner: { name: 'Sarah W.', avatar: '', role: 'Architect (Outgoing)' },
    incoming_owner: { name: 'Sophia C.', avatar: '', role: 'Lead (Incoming)' },
    handover_days_left: 4,
    last_activity: '1d ago',
  },
  {
    id: 'UX-331',
    name: 'Customer Onboarding Flow Redesign',
    code: 'UX-331',
    description: 'Drop-off remediation and self-serve team invite funnel',
    status: 'active',
    created_at: '2025-09-01T10:00:00Z',
    updated_at: '2025-10-23T10:00:00Z',
    progress: 45,
    decisions_count: 16,
    total_tasks: 20,
    completed_tasks: 9,
    documents_count: 6,
    health_status: 'verified',
    health_label: 'Continuity Normal (88%)',
    outgoing_owner: { name: 'Alex M.', avatar: '', role: 'Lead Product Designer' },
    incoming_owner: { name: 'Priya N.', avatar: '', role: 'Product Manager' },
    last_activity: '1d ago',
  },
  {
    id: 'COR-12',
    name: 'Core Platform Observability Pipeline',
    code: 'COR-12',
    description: 'OpenTelemetry collector routing and cost-effective cold tier ingestion',
    status: 'completed',
    created_at: '2025-04-12T10:00:00Z',
    updated_at: '2025-10-15T10:00:00Z',
    progress: 100,
    decisions_count: 34,
    total_tasks: 40,
    completed_tasks: 40,
    documents_count: 18,
    health_status: 'verified',
    health_label: 'Handover Completed (100%)',
    outgoing_owner: { name: 'Soren B.', avatar: '', role: 'Staff SRE' },
    incoming_owner: { name: 'Elena R.', avatar: '', role: 'PM' },
    last_activity: '1w ago',
  },
  {
    id: 'LEG-01',
    name: 'Legacy RabbitMQ Deprecation Archive',
    code: 'LEG-01',
    description: 'Historic operational runbooks and consumer decommission records',
    status: 'archived',
    created_at: '2024-11-05T10:00:00Z',
    updated_at: '2025-09-10T10:00:00Z',
    progress: 100,
    decisions_count: 19,
    total_tasks: 15,
    completed_tasks: 15,
    documents_count: 9,
    health_status: 'verified',
    health_label: 'Archived',
    outgoing_owner: { name: 'Elena R.', avatar: '', role: 'Owner' },
    incoming_owner: { name: 'Core Team', avatar: '', role: 'Team' },
    last_activity: '1mo ago',
  },
];

export const MyProjectsScreen: React.FC = () => {
  const { navigate } = useNavigation();
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'in_handover' | 'completed' | 'archived'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [projectList, setProjectList] = useState<Project[]>(initialProjects);


  // Try fetching projects from backend on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const backendProjects = await api.getProjects();
        if (backendProjects && backendProjects.length > 0) {
          // Merge with mock design attributes
          const merged = backendProjects.map((bp, i) => {
            const template = initialProjects[i % initialProjects.length];
            return {
              ...template,
              ...bp,
              code: bp.name.slice(0, 3).toUpperCase() + '-' + (100 + i),
            };
          });
          setProjectList(merged);
        }
      } catch {
        // Use default projects
      }
    }
    loadProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await api.createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
      });

      const newProj: Project = {
        id: created.id,
        name: created.name,
        code: 'PRJ-' + Math.floor(Math.random() * 900 + 100),
        description: created.description || 'Newly initialized knowledge continuity workspace',
        status: 'active',
        created_at: created.created_at,
        updated_at: created.updated_at,
        progress: 0,
        decisions_count: 0,
        total_tasks: 0,
        completed_tasks: 0,
        documents_count: 0,
        health_status: 'verified',
        health_label: 'Initialized (100%)',
        outgoing_owner: { name: 'Elena R.', avatar: '', role: 'Creator' },
        incoming_owner: { name: 'Elena R.', avatar: '', role: 'Owner' },
        last_activity: 'Just now',
      };

      setProjectList([newProj, ...projectList]);
      setNewProjectName('');
      setNewProjectDesc('');
      setShowCreateModal(false);
    } catch {
      // Local fallback creation
      const fallbackProj: Project = {
        id: 'PRJ-' + Date.now(),
        name: newProjectName.trim(),
        code: 'PRJ-' + Math.floor(Math.random() * 900 + 100),
        description: newProjectDesc.trim() || 'Newly initialized knowledge continuity workspace',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        progress: 0,
        decisions_count: 0,
        total_tasks: 0,
        completed_tasks: 0,
        documents_count: 0,
        health_status: 'verified',
        health_label: 'Initialized (100%)',
        outgoing_owner: { name: 'Elena R.', avatar: '', role: 'Creator' },
        incoming_owner: { name: 'Elena R.', avatar: '', role: 'Owner' },
        last_activity: 'Just now',
      };
      setProjectList([fallbackProj, ...projectList]);
      setNewProjectName('');
      setNewProjectDesc('');
      setShowCreateModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProjects = projectList.filter((proj) => {
    // Tab filter
    if (activeTab === 'active' && proj.status !== 'active') return false;
    if (activeTab === 'in_handover' && proj.status !== 'in_handover') return false;
    if (activeTab === 'completed' && proj.status !== 'completed') return false;
    if (activeTab === 'archived' && proj.status !== 'archived') return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        proj.name.toLowerCase().includes(q) ||
        (proj.code && proj.code.toLowerCase().includes(q)) ||
        (proj.description && proj.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col w-full">
      {/* Top Command & Action Bar */}
      <div className="w-full bg-surface-container-lowest px-space-xl py-space-lg shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-md">
          {/* Title & Metrics Counter */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-space-sm flex-wrap">
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                Projects
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-code-inline text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                {projectList.length} Workstreams
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-low text-secondary font-label-sm text-[11px]">
                <span className="material-symbols-outlined text-[13px] text-tertiary">
                  verified_user
                </span>
                96.4% Health Index
              </span>
            </div>
            <p className="font-body-md text-body-md text-outline">
              All active workstreams, ownership mapping, and knowledge continuity health.
            </p>
          </div>

          {/* Global Controls */}
          <div className="flex flex-wrap items-center gap-space-sm">
            {/* Search Input */}
            <div className="relative flex items-center min-w-[240px]">
              <span className="material-symbols-outlined absolute left-2.5 text-outline text-[16px]">
                search
              </span>
              <input
                className="w-full h-8 pl-8 pr-12 rounded bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-body-sm transition-all focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary shadow-sm"
                placeholder="Search projects, owners, tags..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <kbd className="absolute right-2 font-code-inline text-[10px] px-1.5 py-0.5 rounded bg-surface-container-lowest text-outline shadow-sm pointer-events-none">
                ⌘K
              </kbd>
            </div>

            {/* Filter Triggers */}
            <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded">
              <button
                className="h-7 px-2.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest text-label-sm font-label-sm flex items-center gap-1 transition-colors cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">tune</span>
                <span>Filters</span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5"></span>
              </button>
            </div>

            {/* View Mode Segmented Switch */}
            <div className="flex items-center bg-surface-container-low p-0.5 rounded">
              <button
                onClick={() => setViewMode('table')}
                className={`h-7 px-2 rounded flex items-center justify-center transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-outline hover:text-on-surface'
                }`}
                title="Dense Table View"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">view_headline</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`h-7 px-2 rounded flex items-center justify-center transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-outline hover:text-on-surface'
                }`}
                title="Bento Grid View"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">grid_view</span>
              </button>
            </div>

            {/* Primary CTA */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-8 px-3 rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Create Project</span>
            </button>
          </div>
        </div>

        {/* Quick Status Sub-navigation */}
        <div className="mt-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pt-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`relative px-3 py-1.5 rounded font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'all'
                  ? 'text-primary font-semibold bg-surface-container'
                  : 'text-outline hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <span>All Projects</span>
              <span
                className={`px-1.5 py-0.2 rounded font-code-inline text-[10px] ${
                  activeTab === 'all'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {projectList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'active'
                  ? 'text-primary font-semibold bg-surface-container'
                  : 'text-outline hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <span>Active</span>
              <span className="px-1.5 py-0.2 rounded font-code-inline text-[10px] bg-surface-container-high text-on-surface-variant">
                {projectList.filter((p) => p.status === 'active').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('in_handover')}
              className={`px-3 py-1.5 rounded font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'in_handover'
                  ? 'text-amber-800 font-semibold bg-amber-100'
                  : 'text-amber-700 bg-amber-50/70 hover:bg-amber-100/70'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>In Handover</span>
              <span className="px-1.5 py-0.2 rounded font-code-inline text-[10px] bg-amber-200/80 text-amber-900 font-semibold">
                {projectList.filter((p) => p.status === 'in_handover').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 rounded font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'completed'
                  ? 'text-primary font-semibold bg-surface-container'
                  : 'text-outline hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <span>Completed</span>
              <span className="px-1.5 py-0.2 rounded font-code-inline text-[10px] bg-surface-container-high text-on-surface-variant">
                {projectList.filter((p) => p.status === 'completed').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('archived')}
              className={`px-3 py-1.5 rounded font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'archived'
                  ? 'text-primary font-semibold bg-surface-container'
                  : 'text-outline hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <span>Archived</span>
              <span className="px-1.5 py-0.2 rounded font-code-inline text-[10px] bg-surface-container-high text-on-surface-variant">
                {projectList.filter((p) => p.status === 'archived').length}
              </span>
            </button>
          </div>

          {/* Quick Metrics Strip */}
          <div className="hidden xl:flex items-center gap-space-lg text-outline font-code-inline text-[11px]">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-tertiary">swap_horiz</span>
              <span>2 Scheduled Handovers</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-error">
                notification_important
              </span>
              <span>1 Risk Flagged</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-secondary">update</span>
              <span>Synced 2m ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Operational Project Registry Section */}
      <div className="p-space-lg flex-1">
        {viewMode === 'table' ? (
          <div className="w-full bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden flex flex-col">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="h-9 bg-surface-container-low text-outline font-label-sm text-[11px] uppercase tracking-wider select-none">
                    <th className="w-8 pl-space-md pr-0 text-center" scope="col">
                      <input
                        className="w-3.5 h-3.5 rounded bg-surface-container-lowest text-primary accent-primary cursor-pointer"
                        type="checkbox"
                      />
                    </th>
                    <th className="px-3 min-w-[280px]" scope="col">
                      Project & Objectives
                    </th>
                    <th className="px-3 min-w-[220px]" scope="col">
                      Leadership & Succession
                    </th>
                    <th className="px-3 min-w-[190px]" scope="col">
                      Continuity Health
                    </th>
                    <th className="px-3 min-w-[170px]" scope="col">
                      Knowledge Assets
                    </th>
                    <th className="px-3 min-w-[130px]" scope="col">
                      Handover Progress
                    </th>
                    <th className="px-3 w-[120px] text-right pr-space-md" scope="col">
                      Activity & Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container font-body-sm text-body-sm text-on-surface">
                  {filteredProjects.map((proj) => (
                    <tr
                      key={proj.id}
                      className="h-14 hover:bg-surface-container-low/70 transition-colors group cursor-pointer"
                      onClick={() => navigate('project-workspace', proj.id)}
                    >
                      <td
                        className="pl-space-md pr-0 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          className="w-3.5 h-3.5 rounded bg-surface-container-lowest text-primary accent-primary cursor-pointer"
                          type="checkbox"
                        />
                      </td>

                      {/* Project & Objectives */}
                      <td className="px-3 py-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-6 h-6 mt-0.5 rounded bg-primary-container/10 text-primary flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[15px]">dns</span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors truncate font-semibold">
                                {proj.name}
                              </span>
                              {proj.code && (
                                <span className="px-1.5 py-0.2 rounded bg-surface-container font-code-inline text-[10px] text-secondary">
                                  {proj.code}
                                </span>
                              )}
                            </div>
                            <span className="text-outline truncate text-[12px] font-body-sm max-w-sm">
                              {proj.description}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Leadership & Succession */}
                      <td className="px-3 py-2">
                        {proj.outgoing_owner && proj.incoming_owner ? (
                          <OwnerTransitionBadge
                            outgoing={proj.outgoing_owner}
                            incoming={proj.incoming_owner}
                            note={
                              proj.handover_days_left
                                ? `Handover scheduled in ${proj.handover_days_left} days`
                                : undefined
                            }
                          />
                        ) : (
                          <span className="text-outline text-xs">Elena Rostova</span>
                        )}
                      </td>

                      {/* Continuity Health */}
                      <td className="px-3 py-2">
                        {proj.health_label ? (
                          <div
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-label-sm text-[11px] font-medium ${
                              proj.health_status === 'verified'
                                ? 'bg-emerald-50 text-emerald-800'
                                : proj.health_status === 'review_required'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-rose-50 text-rose-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                proj.health_status === 'verified'
                                  ? 'bg-emerald-500'
                                  : proj.health_status === 'review_required'
                                  ? 'bg-amber-500 animate-ping'
                                  : 'bg-rose-500'
                              }`}
                            ></span>
                            <span>{proj.health_label}</span>
                          </div>
                        ) : (
                          <StatusBadge variant={proj.status} />
                        )}
                      </td>

                      {/* Knowledge Assets */}
                      <td className="px-3 py-2 font-code-inline text-[11px] text-secondary">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex items-center gap-0.5 text-on-surface font-medium"
                            title="Decisions captured"
                          >
                            <span className="material-symbols-outlined text-[13px] text-outline">
                              gavel
                            </span>{' '}
                            {proj.decisions_count ?? 12}
                          </span>
                          <span className="text-outline">/</span>
                          <span
                            className="flex items-center gap-0.5 text-on-surface font-medium"
                            title="Tasks mapped"
                          >
                            <span className="material-symbols-outlined text-[13px] text-outline">
                              check_circle
                            </span>{' '}
                            {proj.total_tasks ?? 18}
                          </span>
                          <span className="text-outline">/</span>
                          <span
                            className="flex items-center gap-0.5 text-on-surface font-medium"
                            title="Reference Docs"
                          >
                            <span className="material-symbols-outlined text-[13px] text-outline">
                              description
                            </span>{' '}
                            {proj.documents_count ?? 6}
                          </span>
                        </div>
                      </td>

                      {/* Handover Progress */}
                      <td className="px-3 py-2">
                        <div className="w-full flex flex-col gap-1 max-w-[120px]">
                          <div className="flex items-center justify-between text-[10px] font-code-inline">
                            <span className="text-secondary font-medium">Transfer</span>
                            <span className="font-semibold text-primary">{proj.progress ?? 50}%</span>
                          </div>
                          <ProgressBar progress={proj.progress ?? 50} />
                        </div>
                      </td>

                      {/* Activity & Actions */}
                      <td className="px-3 py-2 text-right pr-space-md">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-outline text-[11px] font-code-inline mr-1 hidden sm:inline">
                            {proj.last_activity || '2h ago'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('project-workspace', proj.id);
                            }}
                            className="h-7 px-2 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-[11px] transition-colors cursor-pointer"
                            type="button"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Bento Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
            {filteredProjects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => navigate('project-workspace', proj.id)}
                className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between space-y-space-md group"
              >
                <div className="space-y-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.2 rounded bg-surface-container font-code-inline text-[10px] text-secondary">
                      {proj.code}
                    </span>
                    <StatusBadge variant={proj.status} />
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors font-semibold">
                    {proj.name}
                  </h3>
                  <p className="font-body-sm text-body-sm text-outline line-clamp-2">
                    {proj.description}
                  </p>
                </div>

                <div className="space-y-space-sm pt-2 border-t border-surface-container">
                  {proj.outgoing_owner && proj.incoming_owner && (
                    <OwnerTransitionBadge
                      outgoing={proj.outgoing_owner}
                      incoming={proj.incoming_owner}
                    />
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-code-inline text-outline">
                      <span>Knowledge Transfer</span>
                      <span className="font-bold text-primary">{proj.progress}%</span>
                    </div>
                    <ProgressBar progress={proj.progress ?? 0} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-lg shadow-xl w-full max-w-md p-space-lg space-y-space-md animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Create Continuity Workstream
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-space-md">
              <div className="space-y-1">
                <label className="font-label-md text-label-md text-on-surface font-medium block">
                  Project Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  placeholder="e.g. Nexus Infrastructure Migration"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full h-9 px-3 rounded bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-label-md text-label-md text-on-surface font-medium block">
                  Objectives & Scope (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief description of handover scope and goals..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full p-3 rounded bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-space-sm pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-8 px-3 rounded text-on-surface-variant hover:bg-surface-container-low font-label-md text-label-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newProjectName.trim()}
                  className="h-8 px-4 rounded bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary font-label-md text-label-md shadow-sm transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
