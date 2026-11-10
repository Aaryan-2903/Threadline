import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/useNavigation';
import { StatusBadge } from '../components/common/StatusBadge';
import { ProgressBar } from '../components/common/ProgressBar';
import { api } from '../api/client';
import { isValidUUID } from '../utils/uuid';
import type { Project, Task, Decision, DocumentItem, Activity } from '../types';

export const ProjectWorkspaceScreen: React.FC = () => {
  const { selectedProjectId, setSelectedProjectId, navigate } = useNavigation();

  const [project, setProject] = useState<Project | null>(null);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'decisions' | 'documents' | 'activity'>('overview');

  // Load project and associated knowledge
  useEffect(() => {
    let isMounted = true;
    async function loadWorkspaceData() {
      try {
        setLoading(true);
        const allProjects = await api.getProjects();
        if (!isMounted) return;
        setProjectsList(allProjects || []);

        if (!allProjects || allProjects.length === 0) {
          setProject(null);
          setLoading(false);
          return;
        }

        const targetId =
          isValidUUID(selectedProjectId) && allProjects.some((p) => p.id === selectedProjectId)
            ? selectedProjectId
            : allProjects[0].id;
        const currentProj = allProjects.find((p) => p.id === targetId) || allProjects[0];
        setProject(currentProj);

        const [projTasks, projDecisions, projDocs, projActs] = await Promise.all([
          api.getProjectTasks(currentProj.id),
          api.getProjectDecisions(currentProj.id),
          api.getDocuments(currentProj.id),
          api.getProjectActivities(currentProj.id),
        ]);

        if (!isMounted) return;
        setTasks(projTasks || []);
        setDecisions(projDecisions || []);
        setDocuments(projDocs || []);
        setActivities(projActs || []);
      } catch (err) {
        console.warn('Failed to load workspace data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadWorkspaceData();
    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <div className="flex items-center gap-2 text-outline">
          <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
          <span className="font-label-md text-label-md">Loading continuity workspace...</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="w-full px-space-xl py-space-xl max-w-4xl mx-auto">
        <div className="bg-surface-container-lowest p-space-xl rounded-lg shadow-sm text-center space-y-space-md border border-surface-container">
          <div className="w-14 h-14 mx-auto rounded-full bg-surface-container flex items-center justify-center text-outline">
            <span className="material-symbols-outlined text-[32px]">folder_off</span>
          </div>
          <div className="space-y-1">
            <h2 className="font-headline-md text-headline-md text-on-surface">No Projects Available</h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
              You need to initialize a project before exploring the workspace inspector.
            </p>
          </div>
          <button
            onClick={() => navigate('my-projects')}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-xs transition-colors cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Go to My Projects</span>
          </button>
        </div>
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === 'done');
  const blockedTasks = tasks.filter((t) => t.status === 'blocked');
  const progressPercent = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Sticky Workspace Context Sub-Nav */}
      <div className="sticky top-14 z-20 bg-surface-container-lowest shadow-xs border-b border-surface-container">
        <div className="w-full px-space-xl flex items-center justify-between overflow-x-auto">
          <div className="flex items-center space-x-1 py-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-space-xs px-space-md py-2 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-surface-container text-primary font-medium'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">overview</span>
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-space-xs px-space-md py-2 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-surface-container text-primary font-medium'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">task_alt</span>
              <span>Tasks</span>
              <span className="font-code-inline text-[11px] px-1.5 py-0.2 bg-surface-container-high text-on-surface-variant rounded">
                {tasks.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('decisions')}
              className={`flex items-center gap-space-xs px-space-md py-2 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                activeTab === 'decisions'
                  ? 'bg-surface-container text-primary font-medium'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">gavel</span>
              <span>Decisions</span>
              <span className="font-code-inline text-[11px] px-1.5 py-0.2 bg-surface-container-high text-on-surface-variant rounded">
                {decisions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-space-xs px-space-md py-2 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                activeTab === 'documents'
                  ? 'bg-surface-container text-primary font-medium'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">article</span>
              <span>Documents</span>
              <span className="font-code-inline text-[11px] px-1.5 py-0.2 bg-surface-container-high text-on-surface-variant rounded">
                {documents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              className={`flex items-center gap-space-xs px-space-md py-2 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                activeTab === 'activity'
                  ? 'bg-surface-container text-primary font-medium'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              <span>Activity</span>
              <span className="font-code-inline text-[11px] px-1.5 py-0.2 bg-surface-container-high text-on-surface-variant rounded">
                {activities.length}
              </span>
            </button>
          </div>

          {/* Project Switcher */}
          {projectsList.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-outline uppercase font-label-sm">Project:</span>
              <select
                value={project.id}
                onChange={(e) => {
                  const p = projectsList.find((item) => item.id === e.target.value);
                  if (p) {
                    setProject(p);
                    if (setSelectedProjectId) setSelectedProjectId(p.id);
                    navigate('project-workspace', p.id);
                  }
                }}
                className="h-7 px-2 bg-surface-container-low border border-surface-container rounded text-on-surface font-body-sm text-[12px] focus:outline-none"
              >
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Primary Workspace Content */}
      <div className="w-full px-space-xl py-space-lg space-y-space-md max-w-[1520px] mx-auto">
        {/* Header Banner */}
        <div className="bg-surface-container-lowest p-space-xl rounded-lg shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-space-lg border border-surface-container">
          <div className="space-y-space-sm">
            <div className="flex items-center gap-space-sm text-outline font-label-sm text-label-sm">
              <span className="font-code-inline uppercase tracking-widest text-[11px] text-primary font-bold">
                Project Workspace
              </span>
              <span>/</span>
              <span className="font-code-inline text-on-surface">{project.name}</span>
            </div>

            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              {project.name}
            </h1>

            <div className="flex flex-wrap items-center gap-space-sm pt-1">
              <StatusBadge variant={project.status} />

              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-surface-container-low text-on-surface-variant font-label-sm text-[12px]">
                <span className="material-symbols-outlined text-[14px] text-outline">event</span>
                <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
              </div>

              {blockedTasks.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-error-container/40 text-error font-label-sm text-[12px]">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  <span>{blockedTasks.length} Blocked Tasks</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-space-sm shrink-0">
            <button
              onClick={() => navigate('handover-reports')}
              className="flex items-center gap-1.5 px-space-md h-9 bg-surface-container hover:bg-surface-container-high text-on-surface rounded font-label-md text-label-md shadow-xs transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Handover Report</span>
            </button>

            <button
              onClick={() => navigate('continuity-map')}
              className="flex items-center gap-1.5 px-space-md h-9 bg-primary-container text-on-primary rounded font-label-md text-label-md shadow-xs hover:bg-primary transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">hub</span>
              <span>Continuity Map</span>
            </button>
          </div>
        </div>

        {/* 4 Health Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-surface-container space-y-1">
            <span className="font-label-sm text-outline uppercase tracking-wider text-[11px]">Tasks Progress</span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="font-headline-lg text-headline-lg text-on-surface font-semibold">{progressPercent}%</span>
              <span className="text-[12px] text-outline font-code-inline">{completedTasks.length}/{tasks.length} done</span>
            </div>
            <ProgressBar progress={progressPercent} />
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-surface-container space-y-1">
            <span className="font-label-sm text-outline uppercase tracking-wider text-[11px]">Decisions (ADRs)</span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="font-headline-lg text-headline-lg text-on-surface font-semibold">{decisions.length}</span>
              <span className="text-[11px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">Recorded</span>
            </div>
            <p className="text-[11px] text-outline">Permanent architectural choices</p>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-surface-container space-y-1">
            <span className="font-label-sm text-outline uppercase tracking-wider text-[11px]">Source Documents</span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="font-headline-lg text-headline-lg text-on-surface font-semibold">{documents.length}</span>
              <span className="text-[11px] text-tertiary bg-surface-container px-1.5 py-0.5 rounded font-medium">Ingested</span>
            </div>
            <p className="text-[11px] text-outline">PDF & DOCX knowledge anchors</p>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-surface-container space-y-1">
            <span className="font-label-sm text-outline uppercase tracking-wider text-[11px]">Logged Activities</span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="font-headline-lg text-headline-lg text-on-surface font-semibold">{activities.length}</span>
              <span className="text-[11px] text-secondary bg-surface-container px-1.5 py-0.5 rounded font-medium">Events</span>
            </div>
            <p className="text-[11px] text-outline">Audit-ready timeline entries</p>
          </div>
        </div>

        {/* Dynamic Tab Body */}
        {activeTab === 'overview' && (
          <div className="space-y-space-md">
            {/* Scope Overview Card */}
            <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm border border-surface-container space-y-space-sm">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Scope & Objectives</h2>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {project.description || 'No description has been added for this project. Update the project in My Projects to record objectives and scope.'}
              </p>
            </div>

            {/* Recent Tasks & Decisions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
              <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-surface-container space-y-space-sm">
                <div className="flex items-center justify-between pb-1 border-b border-surface-container">
                  <h3 className="font-label-md text-label-md font-semibold text-on-surface">Active Tasks</h3>
                  <button onClick={() => navigate('my-tasks')} className="text-primary hover:text-primary-container text-xs cursor-pointer">
                    View All
                  </button>
                </div>
                {tasks.length === 0 ? (
                  <p className="text-sm text-outline py-4 text-center">No tasks recorded for this project.</p>
                ) : (
                  <div className="divide-y divide-surface-container">
                    {tasks.slice(0, 4).map((t) => (
                      <div key={t.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-on-surface truncate">{t.title}</p>
                          <p className="text-[11px] text-outline">Assignee: {t.assignee || 'Unassigned'}</p>
                        </div>
                        <StatusBadge variant={t.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-surface-container space-y-space-sm">
                <div className="flex items-center justify-between pb-1 border-b border-surface-container">
                  <h3 className="font-label-md text-label-md font-semibold text-on-surface">Recent Decisions</h3>
                  <button onClick={() => navigate('decisions')} className="text-primary hover:text-primary-container text-xs cursor-pointer">
                    View All
                  </button>
                </div>
                {decisions.length === 0 ? (
                  <p className="text-sm text-outline py-4 text-center">No decisions recorded for this project.</p>
                ) : (
                  <div className="divide-y divide-surface-container">
                    {decisions.slice(0, 4).map((d) => (
                      <div key={d.id} className="py-2 space-y-0.5">
                        <p className="text-sm font-medium text-on-surface truncate">{d.title}</p>
                        <p className="text-[11px] text-outline">{d.decided_by || 'Verified'} • {new Date(d.decision_date || d.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm border border-surface-container space-y-space-md">
            <div className="flex items-center justify-between border-b border-surface-container pb-space-sm">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Project Tasks ({tasks.length})</h2>
              <button onClick={() => navigate('my-tasks')} className="px-3 h-8 rounded bg-primary text-on-primary font-label-md text-label-md cursor-pointer">
                Manage in My Tasks
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-outline text-sm text-center py-8">No tasks recorded for this project yet.</p>
            ) : (
              <div className="divide-y divide-surface-container">
                {tasks.map((task) => (
                  <div key={task.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-on-surface text-sm">{task.title}</span>
                        <StatusBadge variant={task.priority} />
                        <StatusBadge variant={task.status} />
                      </div>
                      {task.description && <p className="text-xs text-outline line-clamp-1">{task.description}</p>}
                      <p className="text-[11px] text-outline">Assignee: {task.assignee || 'Unassigned'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'decisions' && (
          <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm border border-surface-container space-y-space-md">
            <div className="flex items-center justify-between border-b border-surface-container pb-space-sm">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Architectural Decisions ({decisions.length})</h2>
              <button onClick={() => navigate('decisions')} className="px-3 h-8 rounded bg-primary text-on-primary font-label-md text-label-md cursor-pointer">
                Manage in Decisions
              </button>
            </div>
            {decisions.length === 0 ? (
              <p className="text-outline text-sm text-center py-8">No decisions recorded for this project yet.</p>
            ) : (
              <div className="divide-y divide-surface-container">
                {decisions.map((dec) => (
                  <div key={dec.id} className="py-3 space-y-1">
                    <h3 className="font-medium text-on-surface text-sm">{dec.title}</h3>
                    {dec.rationale && <p className="text-xs text-on-surface-variant line-clamp-2">{dec.rationale}</p>}
                    <p className="text-[11px] text-outline">{dec.decided_by || 'Verified'} • {new Date(dec.decision_date || dec.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm border border-surface-container space-y-space-md">
            <div className="flex items-center justify-between border-b border-surface-container pb-space-sm">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Documents ({documents.length})</h2>
              <button onClick={() => navigate('documents')} className="px-3 h-8 rounded bg-primary text-on-primary font-label-md text-label-md cursor-pointer">
                Upload in Documents Hub
              </button>
            </div>
            {documents.length === 0 ? (
              <p className="text-outline text-sm text-center py-8">No documents uploaded for this project yet.</p>
            ) : (
              <div className="divide-y divide-surface-container">
                {documents.map((doc) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                      <div>
                        <p className="text-sm font-medium text-on-surface">{doc.filename}</p>
                        <p className="text-[11px] text-outline">Author: {doc.author || 'User'} • {doc.extracted_claims_count ?? 0} claims extracted</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm border border-surface-container space-y-space-md">
            <div className="flex items-center justify-between border-b border-surface-container pb-space-sm">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Project Activity Feed ({activities.length})</h2>
              <button onClick={() => navigate('activity')} className="px-3 h-8 rounded bg-primary text-on-primary font-label-md text-label-md cursor-pointer">
                View Full Timeline
              </button>
            </div>
            {activities.length === 0 ? (
              <p className="text-outline text-sm text-center py-8">No activities recorded for this project yet.</p>
            ) : (
              <div className="divide-y divide-surface-container">
                {activities.map((act) => (
                  <div key={act.id} className="py-2.5 flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">history</span>
                    <div className="min-w-0">
                      <p className="text-sm text-on-surface">{act.description}</p>
                      <p className="text-[11px] text-outline">{act.actor || 'System'} • {new Date(act.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
