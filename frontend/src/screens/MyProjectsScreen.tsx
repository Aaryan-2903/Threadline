import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/useNavigation';
import { useUserProfile } from '../context/useUserProfile';
import { StatusBadge } from '../components/common/StatusBadge';
import { ProgressBar } from '../components/common/ProgressBar';
import { api } from '../api/client';
import type { Project, Task, Decision, DocumentItem } from '../types';

export const MyProjectsScreen: React.FC = () => {
  const { navigate } = useNavigation();
  const { profile } = useUserProfile();

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [projectList, setProjectList] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [backendProjects, backendTasks, backendDecisions, backendDocuments] = await Promise.all([
          api.getProjects(),
          api.getTasks(),
          api.getDecisions(),
          api.getDocuments(),
        ]);
        if (!isMounted) return;
        setProjectList(backendProjects || []);
        setTasks(backendTasks || []);
        setDecisions(backendDecisions || []);
        setDocuments(backendDocuments || []);
      } catch (err) {
        console.warn('Failed to load project data:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
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

      setProjectList([created, ...projectList]);
      setNewProjectName('');
      setNewProjectDesc('');
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project? All associated tasks and decisions will be permanently removed.')) {
      return;
    }

    try {
      await api.deleteProject(id);
      setProjectList((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const filteredProjects = projectList.filter((proj) => {
    if (activeTab === 'active' && proj.status !== 'active') return false;
    if (activeTab === 'archived' && proj.status !== 'archived') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        proj.name.toLowerCase().includes(q) ||
        (proj.description && proj.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Top Command & Action Bar */}
      <div className="w-full bg-surface-container-lowest px-space-xl py-space-lg shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-md">
          {/* Title & Metrics Counter */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-space-sm flex-wrap">
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                My Projects
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-code-inline text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                {projectList.length} {projectList.length === 1 ? 'Project' : 'Projects'}
              </span>
            </div>
            <p className="font-body-md text-body-md text-outline">
              Manage your engineering continuity workspaces, architectural decisions, and handover readiness.
            </p>
          </div>

          {/* Global Controls */}
          <div className="flex flex-wrap items-center gap-space-sm">
            {/* Search Input */}
            <div className="relative flex items-center min-w-[220px]">
              <span className="material-symbols-outlined absolute left-2.5 text-outline text-[16px]">
                search
              </span>
              <input
                className="w-full h-8 pl-8 pr-3 rounded bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-body-sm transition-all focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary shadow-xs"
                placeholder="Search projects..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* View Mode Switch */}
            <div className="flex items-center bg-surface-container-low p-0.5 rounded">
              <button
                onClick={() => setViewMode('table')}
                className={`h-7 px-2 rounded flex items-center justify-center transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-outline hover:text-on-surface'
                }`}
                title="Table View"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">view_headline</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`h-7 px-2 rounded flex items-center justify-center transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-outline hover:text-on-surface'
                }`}
                title="Grid View"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">grid_view</span>
              </button>
            </div>

            {/* Primary CTA */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-8 px-3 rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Create Project</span>
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="mt-space-md flex items-center gap-1 pt-2 border-t border-surface-container">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'text-primary font-semibold bg-surface-container'
                : 'text-outline hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <span>All Projects</span>
            <span className="px-1.5 py-0.2 rounded font-code-inline text-[10px] bg-surface-container-high text-on-surface-variant">
              {projectList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1 rounded font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer ${
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
            onClick={() => setActiveTab('archived')}
            className={`px-3 py-1 rounded font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer ${
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
      </div>

      {/* Main Content Area */}
      <div className="p-space-lg flex-1">
        {projectList.length === 0 && !loading ? (
          <div className="w-full bg-surface-container-lowest rounded-lg shadow-sm p-space-xl text-center space-y-space-md border border-surface-container">
            <div className="w-12 h-12 mx-auto rounded-full bg-surface-container flex items-center justify-center text-outline">
              <span className="material-symbols-outlined text-[28px]">folder_off</span>
            </div>
            <div className="space-y-1">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">No projects created yet</h3>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
                Create a continuity project workspace to organize architectural decisions, track handover tasks, and synthesize reports.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 h-9 rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-xs transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Create First Project</span>
            </button>
          </div>
        ) : filteredProjects.length === 0 && !loading ? (
          <div className="w-full bg-surface-container-lowest rounded-lg shadow-sm p-space-lg text-center space-y-2 border border-surface-container">
            <p className="font-label-md text-label-md text-on-surface">No matching projects found</p>
            <p className="font-body-sm text-sm text-outline">Try adjusting your search query or tab filter.</p>
          </div>
        ) : viewMode === 'table' ? (
          /* Clean, Streamlined Table */
          <div className="w-full bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden flex flex-col border border-surface-container">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="h-9 bg-surface-container-low text-outline font-label-sm text-[11px] uppercase tracking-wider select-none border-b border-surface-container">
                    <th className="px-4 py-2 font-medium">Project Name & Objectives</th>
                    <th className="px-4 py-2 font-medium w-28">Status</th>
                    <th className="px-4 py-2 font-medium w-48">Handover Progress</th>
                    <th className="px-4 py-2 font-medium w-44">Knowledge Assets</th>
                    <th className="px-4 py-2 font-medium w-32">Created</th>
                    <th className="px-4 py-2 font-medium text-right w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container font-body-sm text-body-sm text-on-surface">
                  {filteredProjects.map((proj) => {
                    const projTasks = tasks.filter((t) => t.project_id === proj.id);
                    const completedTasks = projTasks.filter((t) => t.status === 'done');
                    const projDecisions = decisions.filter((d) => d.project_id === proj.id);
                    const projDocs = documents.filter((doc) => doc.project_id === proj.id);
                    const progressPercent =
                      projTasks.length > 0 ? Math.round((completedTasks.length / projTasks.length) * 100) : 0;

                    return (
                      <tr
                        key={proj.id}
                        className="hover:bg-surface-container-low/60 transition-colors group cursor-pointer"
                        onClick={() => navigate('project-workspace', proj.id)}
                      >
                        {/* Name & Description */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="material-symbols-outlined text-outline text-[20px] mt-0.5 group-hover:text-primary transition-colors shrink-0">
                              folder_open
                            </span>
                            <div className="min-w-0">
                              <span className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors block truncate font-semibold">
                                {proj.name}
                              </span>
                              <span className="text-outline truncate text-[12px] font-body-sm block max-w-md">
                                {proj.description || 'No description provided'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge variant={proj.status} />
                        </td>

                        {/* Progress */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="w-36 space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-outline font-code-inline">
                              <span>{progressPercent}%</span>
                              <span>
                                {completedTasks.length}/{projTasks.length} tasks
                              </span>
                            </div>
                            <ProgressBar progress={progressPercent} />
                          </div>
                        </td>

                        {/* Knowledge Assets */}
                        <td className="px-4 py-3 whitespace-nowrap font-code-inline text-[11px] text-on-surface-variant">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1" title="Decisions recorded">
                              <span className="material-symbols-outlined text-[14px] text-emerald-700">gavel</span>
                              <span>{projDecisions.length}</span>
                            </span>
                            <span className="flex items-center gap-1" title="Documents ingested">
                              <span className="material-symbols-outlined text-[14px] text-tertiary">description</span>
                              <span>{projDocs.length}</span>
                            </span>
                          </div>
                        </td>

                        {/* Created Date */}
                        <td className="px-4 py-3 whitespace-nowrap text-[12px] text-outline">
                          {new Date(proj.created_at).toLocaleDateString()}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => navigate('project-workspace', proj.id)}
                              className="h-7 px-2 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-[11px] transition-colors cursor-pointer"
                              type="button"
                              title="Open project workspace"
                            >
                              Open
                            </button>
                            <button
                              onClick={(e) => handleDeleteProject(proj.id, e)}
                              className="h-7 w-7 rounded hover:bg-error-container/20 text-outline hover:text-error transition-colors flex items-center justify-center cursor-pointer"
                              type="button"
                              title="Delete project"
                            >
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
            {filteredProjects.map((proj) => {
              const projTasks = tasks.filter((t) => t.project_id === proj.id);
              const completedTasks = projTasks.filter((t) => t.status === 'done');
              const projDecisions = decisions.filter((d) => d.project_id === proj.id);
              const projDocs = documents.filter((doc) => doc.project_id === proj.id);
              const progressPercent =
                projTasks.length > 0 ? Math.round((completedTasks.length / projTasks.length) * 100) : 0;

              return (
                <div
                  key={proj.id}
                  onClick={() => navigate('project-workspace', proj.id)}
                  className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between space-y-space-md border border-surface-container group"
                >
                  <div className="space-y-space-xs">
                    <div className="flex items-center justify-between">
                      <StatusBadge variant={proj.status} />
                      <button
                        onClick={(e) => handleDeleteProject(proj.id, e)}
                        className="text-outline hover:text-error p-1 rounded"
                        title="Delete project"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>

                    <h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors font-semibold truncate pt-1">
                      {proj.name}
                    </h3>
                    <p className="font-body-sm text-body-sm text-outline line-clamp-2">
                      {proj.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="space-y-space-xs pt-space-xs border-t border-surface-container">
                    <div className="flex items-center justify-between text-[11px] text-outline font-code-inline">
                      <span>Tasks: {completedTasks.length}/{projTasks.length}</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <ProgressBar progress={progressPercent} />

                    <div className="flex items-center justify-between text-[11px] text-outline pt-2">
                      <span>{projDecisions.length} decisions • {projDocs.length} docs</span>
                      <span>{new Date(proj.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-lg shadow-lg w-full max-w-md overflow-hidden border border-surface-container">
            <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">create_new_folder</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Create New Project</h3>
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
                  placeholder="e.g. Distributed Ingestion Engine"
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
                  placeholder="Project scope, key stakeholders, and architecture goals..."
                  className="w-full p-space-md rounded bg-surface-container-lowest border border-outline-variant text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="p-space-sm rounded bg-surface-container-low border border-surface-container text-outline text-[12px] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">person</span>
                <span>Created by: <strong className="text-on-surface">{profile.displayName || 'User'}</strong></span>
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
