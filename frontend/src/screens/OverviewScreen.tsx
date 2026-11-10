import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/useNavigation';
import { useUserProfile } from '../context/useUserProfile';
import { StatusBadge } from '../components/common/StatusBadge';
import { MetricCard } from '../components/common/MetricCard';
import { api } from '../api/client';
import type { Project, Task, Decision, DocumentItem, ExtractedClaim } from '../types';

export const OverviewScreen: React.FC = () => {
  const { navigate } = useNavigation();
  const { profile } = useUserProfile();

  const [taskFilter, setTaskFilter] = useState<'all' | 'blocked' | 'high'>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [reviews, setReviews] = useState<ExtractedClaim[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal for quick project creation from Overview
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [projRes, taskRes, decRes, docRes, revRes] = await Promise.all([
          api.getProjects(),
          api.getTasks(),
          api.getDecisions(),
          api.getDocuments(),
          api.getReviews(),
        ]);

        if (!isMounted) return;
        setProjects(projRes || []);
        setTasks(taskRes || []);
        setDecisions(decRes || []);
        setDocuments(docRes || []);
        setReviews(revRes || []);
      } catch (err) {
        console.warn('Failed to load overview data from backend:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      setIsSubmitting(true);
      const created = await api.createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
      });

      setProjects((prev) => [created, ...prev]);
      setNewProjectName('');
      setNewProjectDesc('');
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Real calculations
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const blockedTasks = tasks.filter((t) => t.status === 'blocked');
  const highPriTasks = tasks.filter((t) => t.priority === 'urgent' || t.priority === 'high');
  const pendingReviews = reviews.filter((r) => r.status === 'pending');

  const filteredTasks = tasks.filter((task) => {
    if (taskFilter === 'blocked') return task.status === 'blocked';
    if (taskFilter === 'high') return task.priority === 'urgent' || task.priority === 'high';
    return task.status !== 'done';
  });

  // Project map for quick lookup
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // Dynamic greeting
  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  });

  return (
    <div className="flex flex-col w-full pb-16">
      <div className="w-full px-space-lg py-space-md space-y-space-md max-w-[1520px] mx-auto">
        {/* Top Context & Action Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded shadow-sm">
          <div className="space-y-0.5">
            <div className="flex items-center gap-space-xs text-outline font-label-sm text-label-sm uppercase tracking-wider">
              <span>Knowledge Continuity Workspace</span>
              <span>·</span>
              <span className="text-primary font-medium">CodersInPune Hackathon</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              {greeting}, {profile.displayName || 'User'}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {projects.length === 0
                ? 'Welcome to Threadline — initialize your first project workspace to begin capturing verifiable project continuity.'
                : `Here is your knowledge continuity status across ${projects.length} ${
                    projects.length === 1 ? 'active project' : 'active projects'
                  }.`}
            </p>
          </div>
          <div className="flex items-center gap-space-sm self-start md:self-auto shrink-0">
            <button
              onClick={() => navigate('handover-reports')}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-surface-container-lowest border border-surface-container-high text-on-surface font-label-md text-label-md shadow-xs hover:bg-surface-container-low transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-outline">description</span>
              <span>Generate Handover</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded bg-primary text-on-primary font-label-md text-label-md shadow-xs hover:bg-primary-container transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Create Project</span>
            </button>
          </div>
        </div>

        {/* Dynamic Summary Metrics (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <MetricCard
            title="Total Projects"
            value={projects.length}
            icon="folder_managed"
            iconColor="text-primary"
            badge={
              projects.length > 0 ? (
                <span className="font-label-sm text-label-sm text-primary font-medium">
                  {projects.filter((p) => p.status === 'active').length} active
                </span>
              ) : undefined
            }
            footerLeft={projects.length === 0 ? 'No projects initialized' : `${projects.length} in database`}
            footerRight="Workspace"
          />
          <MetricCard
            title="Open Tasks"
            value={openTasks.length}
            icon="task_alt"
            iconColor={blockedTasks.length > 0 ? 'text-error' : 'text-primary'}
            badge={
              blockedTasks.length > 0 ? (
                <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-error-container text-error font-medium">
                  {blockedTasks.length} blocked
                </span>
              ) : undefined
            }
            footerLeft={`${tasks.filter((t) => t.status === 'done').length} completed`}
            footerRight={highPriTasks.length > 0 ? `${highPriTasks.length} high priority` : 'All nominal'}
          />
          <MetricCard
            title="Decisions Recorded"
            value={decisions.length}
            icon="gavel"
            iconColor="text-emerald-700"
            badge={
              decisions.length > 0 ? (
                <span className="font-label-sm text-label-sm text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
                  Verified ADRs
                </span>
              ) : undefined
            }
            footerLeft={decisions.length === 0 ? '0 recorded' : 'Audit-ready ADRs'}
            footerRight="Traceable"
          />
          <MetricCard
            title="Documents Ingested"
            value={documents.length}
            icon="article"
            iconColor="text-tertiary"
            badge={
              pendingReviews.length > 0 ? (
                <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-medium">
                  {pendingReviews.length} in review
                </span>
              ) : undefined
            }
            footerLeft={documents.length === 0 ? 'PDF/DOCX engine' : `${documents.length} files parsed`}
            footerRight="AI Engine"
          />
        </div>

        {/* First-time Empty State or Active Projects */}
        {projects.length === 0 && !loading ? (
          <div className="bg-surface-container-lowest rounded shadow-sm p-space-xl text-center space-y-space-lg">
            <div className="max-w-xl mx-auto space-y-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary-fixed flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[32px]">hub</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Welcome to Threadline
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Threadline preserves engineering continuity during developer and lead handovers.
                Extract architectural decisions, track open blockers, and synthesize publication-ready handover dossiers directly from your codebase and project documents.
              </p>
            </div>

            {/* Quick Start Guidance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md max-w-5xl mx-auto text-left">
              <div className="p-space-md rounded bg-surface-container-low border border-surface-container space-y-2">
                <div className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="font-label-md text-label-md font-semibold text-on-surface">Create a Project</h3>
                <p className="font-body-sm text-[12px] text-on-surface-variant">
                  Initialize a dedicated workspace for your team or service migration.
                </p>
              </div>

              <div className="p-space-md rounded bg-surface-container-low border border-surface-container space-y-2">
                <div className="w-8 h-8 rounded bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h3 className="font-label-md text-label-md font-semibold text-on-surface">Upload Documents</h3>
                <p className="font-body-sm text-[12px] text-on-surface-variant">
                  Ingest RFCs, architecture specs, or meeting transcripts (PDF/DOCX).
                </p>
              </div>

              <div className="p-space-md rounded bg-surface-container-low border border-surface-container space-y-2">
                <div className="w-8 h-8 rounded bg-tertiary text-on-tertiary flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h3 className="font-label-md text-label-md font-semibold text-on-surface">Review Knowledge</h3>
                <p className="font-body-sm text-[12px] text-on-surface-variant">
                  Verify or reject AI-extracted decisions, tasks, and conflicting claims.
                </p>
              </div>

              <div className="p-space-md rounded bg-surface-container-low border border-surface-container space-y-2">
                <div className="w-8 h-8 rounded bg-emerald-700 text-on-primary flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <h3 className="font-label-md text-label-md font-semibold text-on-surface">Export Handover</h3>
                <p className="font-body-sm text-[12px] text-on-surface-variant">
                  Inspect the interactive Continuity Map and download official PDF dossiers.
                </p>
              </div>
            </div>

            <div className="pt-space-sm">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-medium shadow-sm transition-colors cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Create Your First Project</span>
              </button>
            </div>
          </div>
        ) : (
          /* Active Projects Table */
          <div className="bg-surface-container-lowest rounded shadow-sm overflow-hidden">
            <div className="px-space-md py-space-sm bg-surface-container-low/60 flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-on-surface">Continuity Projects</span>
                <span className="font-label-sm text-[11px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                  {projects.length} Total
                </span>
              </div>
              <button
                onClick={() => navigate('my-projects')}
                className="text-primary hover:text-primary-container font-label-sm text-label-sm font-medium flex items-center gap-1 cursor-pointer"
                type="button"
              >
                <span>Manage All Projects</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-outline font-label-sm text-[11px] uppercase tracking-wider h-8">
                    <th className="px-space-md font-medium">Project Name</th>
                    <th className="px-space-md font-medium">Status</th>
                    <th className="px-space-md font-medium">Tasks Progress</th>
                    <th className="px-space-md font-medium">Decisions</th>
                    <th className="px-space-md font-medium">Created</th>
                    <th className="px-space-md font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface font-body-sm text-body-sm">
                  {projects.map((proj) => {
                    const projTasks = tasks.filter((t) => t.project_id === proj.id);
                    const projCompleted = projTasks.filter((t) => t.status === 'done');
                    const projDecisions = decisions.filter((d) => d.project_id === proj.id);
                    const progressPercent =
                      projTasks.length > 0 ? Math.round((projCompleted.length / projTasks.length) * 100) : 0;

                    return (
                      <tr
                        key={proj.id}
                        className="hover:bg-surface-container-low/50 transition-colors group"
                      >
                        <td className="px-space-md py-3">
                          <div
                            onClick={() => navigate('project-workspace', proj.id)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-outline text-[18px] group-hover:text-primary transition-colors">
                              folder_open
                            </span>
                            <div className="min-w-0">
                              <span className="font-medium text-on-surface block truncate hover:text-primary">
                                {proj.name}
                              </span>
                              {proj.description && (
                                <span className="text-[11px] text-outline block truncate max-w-md">
                                  {proj.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-space-md py-3 whitespace-nowrap">
                          <StatusBadge variant={proj.status} />
                        </td>
                        <td className="px-space-md py-3 whitespace-nowrap">
                          <div className="w-32 space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-outline">
                              <span>{progressPercent}%</span>
                              <span>
                                {projCompleted.length}/{projTasks.length} tasks
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-space-md py-3 whitespace-nowrap">
                          <span className="font-label-sm text-[12px] text-on-surface">
                            {projDecisions.length} recorded
                          </span>
                        </td>
                        <td className="px-space-md py-3 whitespace-nowrap text-[12px] text-outline">
                          {new Date(proj.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-space-md py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => navigate('project-workspace', proj.id)}
                            className="inline-flex items-center gap-1 text-primary hover:text-primary-container font-label-sm text-label-sm font-medium cursor-pointer"
                            type="button"
                          >
                            <span>Open</span>
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Split View Grid: Left Tasks & Right Decisions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
          {/* Left Column: Real Critical & Open Tasks */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded shadow-sm flex flex-col justify-between">
            <div>
              <div className="p-space-md bg-surface-container-low/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">
                    Tasks & Unfinished Work
                  </h2>
                  <p className="font-body-sm text-body-sm text-outline">
                    {tasks.length === 0
                      ? 'No tasks created yet'
                      : `Tracking ${openTasks.length} open items across projects`}
                  </p>
                </div>
                {tasks.length > 0 && (
                  <div className="flex items-center gap-1 bg-surface-container p-0.5 rounded shrink-0">
                    <button
                      onClick={() => setTaskFilter('all')}
                      className={`px-2 py-0.5 rounded font-label-sm text-label-sm font-medium transition-colors cursor-pointer ${
                        taskFilter === 'all'
                          ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                          : 'text-outline hover:text-on-surface'
                      }`}
                      type="button"
                    >
                      All ({openTasks.length})
                    </button>
                    <button
                      onClick={() => setTaskFilter('blocked')}
                      className={`px-2 py-0.5 rounded font-label-sm text-label-sm font-medium transition-colors cursor-pointer ${
                        taskFilter === 'blocked'
                          ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                          : 'text-outline hover:text-on-surface'
                      }`}
                      type="button"
                    >
                      Blocked ({blockedTasks.length})
                    </button>
                    <button
                      onClick={() => setTaskFilter('high')}
                      className={`px-2 py-0.5 rounded font-label-sm text-label-sm font-medium transition-colors cursor-pointer ${
                        taskFilter === 'high'
                          ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                          : 'text-outline hover:text-on-surface'
                      }`}
                      type="button"
                    >
                      High Pri ({highPriTasks.length})
                    </button>
                  </div>
                )}
              </div>

              {filteredTasks.length === 0 ? (
                <div className="p-space-lg text-center space-y-2">
                  <span className="material-symbols-outlined text-[32px] text-outline">assignment_late</span>
                  <p className="font-label-md text-label-md text-on-surface font-medium">No tasks found</p>
                  <p className="font-body-sm text-[12px] text-on-surface-variant max-w-sm mx-auto">
                    {tasks.length === 0
                      ? 'Tasks appear here after they are created or extracted from uploaded documents.'
                      : 'No tasks match the active filter criteria.'}
                  </p>
                  <button
                    onClick={() => navigate('my-tasks')}
                    className="inline-flex items-center gap-1 mt-2 text-primary hover:text-primary-container font-label-sm text-label-sm font-medium cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Add Task</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-surface-container">
                  {filteredTasks.slice(0, 6).map((task) => (
                    <div
                      key={task.id}
                      className="p-space-md hover:bg-surface-container-low/40 transition-colors flex items-start justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="material-symbols-outlined text-outline text-[18px] mt-0.5">
                          {task.status === 'blocked' ? 'report' : 'check_circle_outline'}
                        </span>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              onClick={() => navigate('my-tasks')}
                              className="font-label-md text-label-md font-medium text-on-surface group-hover:text-primary transition-colors cursor-pointer"
                            >
                              {task.title}
                            </span>
                            <StatusBadge variant={task.priority} />
                            <StatusBadge variant={task.status} />
                          </div>
                          <div className="flex items-center gap-space-sm text-[11px] text-outline flex-wrap">
                            <span className="flex items-center gap-1 text-on-surface-variant font-medium">
                              <span className="material-symbols-outlined text-[13px]">folder</span>
                              {projectMap.get(task.project_id)?.name || 'Project'}
                            </span>
                            {task.due_date && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[13px]">schedule</span>
                                  {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              </>
                            )}
                            {task.assignee && (
                              <>
                                <span>•</span>
                                <span>Assignee: {task.assignee}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-space-md bg-surface-container-low/60 rounded-b flex items-center justify-between border-t border-surface-container">
              <span className="font-label-sm text-label-sm text-outline">
                {tasks.length > 0 ? `Showing up to 6 of ${tasks.length} total tasks` : '0 tasks'}
              </span>
              <button
                onClick={() => navigate('my-tasks')}
                className="text-primary hover:text-primary-container font-label-md text-label-md font-medium flex items-center gap-1 cursor-pointer"
                type="button"
              >
                <span>View All Tasks</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Right Column: Real Decision Stream (ADRs) */}
          <div className="lg:col-span-5 bg-surface-container-lowest rounded shadow-sm flex flex-col justify-between">
            <div>
              <div className="p-space-md bg-surface-container-low/60 flex items-center justify-between border-b border-surface-container">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">
                    Recent Decision Stream (ADRs)
                  </h2>
                  <p className="font-body-sm text-body-sm text-outline">
                    {decisions.length === 0
                      ? 'No decisions recorded yet'
                      : 'Architectural choices & verified rationale'}
                  </p>
                </div>
                <button
                  onClick={() => navigate('decisions')}
                  className="p-1 hover:bg-surface-container rounded text-outline hover:text-on-surface cursor-pointer"
                  title="View Registry"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                </button>
              </div>

              {decisions.length === 0 ? (
                <div className="p-space-lg text-center space-y-2">
                  <span className="material-symbols-outlined text-[32px] text-outline">gavel</span>
                  <p className="font-label-md text-label-md text-on-surface font-medium">No decisions recorded</p>
                  <p className="font-body-sm text-[12px] text-on-surface-variant max-w-xs mx-auto">
                    Record key architecture decisions or approve extracted ADRs to prevent technical amnesia during handovers.
                  </p>
                  <button
                    onClick={() => navigate('decisions')}
                    className="inline-flex items-center gap-1 mt-2 text-primary hover:text-primary-container font-label-sm text-label-sm font-medium cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Record Decision</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-surface-container">
                  {decisions.slice(0, 4).map((dec) => (
                    <div
                      key={dec.id}
                      onClick={() => navigate('decisions')}
                      className="p-space-md hover:bg-surface-container-low/40 transition-colors cursor-pointer space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-code-inline text-[11px] font-bold text-primary">ADR</span>
                        <span className="font-label-sm text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-semibold uppercase">
                          Recorded
                        </span>
                      </div>
                      <h3 className="font-label-md text-label-md font-semibold text-on-surface hover:text-primary transition-colors line-clamp-1">
                        {dec.title}
                      </h3>
                      {dec.rationale && (
                        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                          {dec.rationale}
                        </p>
                      )}
                      <div className="pt-1 flex items-center justify-between text-[11px] text-outline">
                        <span>{projectMap.get(dec.project_id)?.name || 'Project'}</span>
                        <span className="font-medium text-on-surface">{dec.decided_by || 'Verified'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-space-md bg-surface-container-low/60 rounded-b flex items-center justify-between border-t border-surface-container">
              <span className="font-label-sm text-label-sm text-outline">
                {decisions.length} total recorded decisions
              </span>
              <button
                onClick={() => navigate('decisions')}
                className="text-primary hover:text-primary-container font-label-md text-label-md font-medium flex items-center gap-1 cursor-pointer"
                type="button"
              >
                <span>View Full Catalog</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Project Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-lg shadow-lg w-full max-w-md overflow-hidden border border-surface-container">
            <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">create_new_folder</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Create Project</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-outline hover:text-on-surface p-1 rounded"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-space-lg space-y-space-md">
              <div className="space-y-1">
                <label className="block font-label-md text-label-md font-medium text-on-surface">
                  Project Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Payment Gateway V2"
                  className="w-full h-9 px-space-md rounded bg-surface-container-lowest border border-outline-variant text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-label-md text-label-md font-medium text-on-surface">
                  Description <span className="text-outline text-xs">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Goals, architecture scope, and key deliverables..."
                  className="w-full p-space-md rounded bg-surface-container-lowest border border-outline-variant text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="pt-space-sm flex items-center justify-end gap-space-sm border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-space-md h-8 rounded text-on-surface-variant hover:bg-surface-container-low font-label-md text-label-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newProjectName.trim()}
                  className="px-space-md h-8 rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
