import React, { useEffect, useState, useCallback } from 'react';
import type { ConflictItem, Project } from '../types';
import { api } from '../api/client';
import { useAuth } from '../context/useAuth';
import { useNavigation } from '../context/useNavigation';
import { AuditTrailModal } from '../components/common/AuditTrailModal';

export const ConflictsScreen: React.FC = () => {
  const { selectedProjectId: navProjectId } = useNavigation();
  const { user } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(navProjectId || '');
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved' | 'dismissed'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal State
  const [resolvingConflict, setResolvingConflict] = useState<ConflictItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submittingResolution, setSubmittingResolution] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // 1. Fetch Projects
  useEffect(() => {
    let mounted = true;
    api.getProjects()
      .then((projs) => {
        if (!mounted) return;
        setProjects(projs);
        if (projs.length > 0 && !selectedProjectId) {
          setSelectedProjectId(navProjectId || projs[0].id);
        }
      })
      .catch((err) => console.warn('Failed to load projects:', err));
    return () => {
      mounted = false;
    };
  }, [navProjectId, selectedProjectId]);

  // 2. Fetch Conflicts for selected project
  const loadConflicts = useCallback(async (projId: string) => {
    if (!projId) return;
    setLoading(true);
    setError(null);
    try {
      const items = await api.getConflicts(projId);
      setConflicts(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch conflicts';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadConflicts(selectedProjectId);
    }
  }, [selectedProjectId, loadConflicts]);

  // 3. Trigger Conflict Detection
  const handleDetect = async () => {
    if (!selectedProjectId) return;
    setDetecting(true);
    setError(null);
    try {
      const res = await api.detectConflicts(selectedProjectId);
      setConflicts(res.conflicts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Conflict detection failed';
      setError(msg);
    } finally {
      setDetecting(false);
    }
  };

  // 4. Resolve / Dismiss Conflict
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingConflict) return;

    setSubmittingResolution(true);
    setError(null);
    try {
      const updated = await api.resolveConflict(resolvingConflict.id, {
        status: 'resolved',
        resolution_notes: resolutionNotes.trim(),
        resolved_by: user ? user.username : 'Project Owner',
      });
      setConflicts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setResolvingConflict(null);
      setResolutionNotes('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve conflict';
      setError(msg);
    } finally {
      setSubmittingResolution(false);
    }
  };

  const handleQuickStatusChange = async (conflict: ConflictItem, newStatus: 'resolved' | 'dismissed' | 'open') => {
    setError(null);
    try {
      const updated = await api.resolveConflict(conflict.id, {
        status: newStatus,
        resolution_notes: newStatus === 'open' ? 'Reopened for investigation' : conflict.resolution_notes,
        resolved_by: user ? user.username : 'Project Owner',
      });
      setConflicts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to update conflict status to ${newStatus}`;
      setError(msg);
    }
  };

  // Filtering
  const filteredConflicts = conflicts.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (typeFilter !== 'all' && c.conflict_type !== typeFilter) return false;
    return true;
  });

  const openCount = conflicts.filter((c) => c.status === 'open').length;
  const resolvedCount = conflicts.filter((c) => c.status === 'resolved').length;
  const dismissedCount = conflicts.filter((c) => c.status === 'dismissed').length;

  const userRole = user?.role;
  const canResolve = Boolean(userRole && (userRole === 'admin' || userRole === 'project_owner'));

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'superseded_decision':
        return 'Superseded Decision';
      case 'conflicting_deadline':
        return 'Conflicting Deadline';
      case 'conflicting_assignee':
        return 'Conflicting Assignee';
      case 'contradictory_claim':
        return 'Contradictory Claim';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'superseded_decision':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'conflicting_deadline':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'conflicting_assignee':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'contradictory_claim':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'medium':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'low':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Advanced Conflict Detection & Resolution</h1>
              <p className="text-sm text-gray-500">
                Identify contradictory specifications, superseded decisions, and clashing task deadlines with audit provenance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAuditModal(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Audit Log
          </button>
          <button
            onClick={handleDetect}
            disabled={detecting || !selectedProjectId}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            {detecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scanning Evidence...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Scan & Detect Conflicts
              </>
            )}
          </button>
        </div>
      </div>

      {/* Project Selector Bar & Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-center">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Selected Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Open Conflicts</p>
            <p className="text-2xl font-black text-rose-600 mt-1">{openCount}</p>
          </div>
          <span className="p-3 rounded-full bg-rose-50 text-rose-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resolved</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{resolvedCount}</p>
          </div>
          <span className="p-3 rounded-full bg-emerald-50 text-emerald-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dismissed</p>
            <p className="text-2xl font-black text-gray-500 mt-1">{dismissedCount}</p>
          </div>
          <span className="p-3 rounded-full bg-gray-100 text-gray-500">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">×</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Status Filters */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-gray-500 mr-1">Status:</span>
          {(['all', 'open', 'resolved', 'dismissed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Type Filter Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-gray-500">Conflict Category:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          >
            <option value="all">All Categories</option>
            <option value="superseded_decision">Superseded Decisions</option>
            <option value="conflicting_deadline">Conflicting Deadlines</option>
            <option value="conflicting_assignee">Conflicting Task Assignees</option>
            <option value="contradictory_claim">Contradictory Claims</option>
          </select>
        </div>
      </div>

      {/* Conflicts List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 text-sm">
          <div className="inline-block animate-spin w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full mb-3" />
          <p>Loading project conflicts...</p>
        </div>
      ) : filteredConflicts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">No Conflicts Found</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {conflicts.length === 0
              ? 'No conflicts have been identified in this project yet. Click "Scan & Detect Conflicts" to run the detection engine.'
              : 'No conflicts match the selected filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredConflicts.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-xl border transition-all shadow-xs p-6 ${
                item.status === 'open'
                  ? 'border-amber-200 hover:border-amber-300'
                  : 'border-gray-200 opacity-90'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${getTypeBadgeClass(item.conflict_type)}`}>
                      {getTypeLabel(item.conflict_type)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${getSeverityBadgeClass(item.severity)}`}>
                      Severity: {item.severity.toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider ${
                      item.status === 'open'
                        ? 'bg-rose-100 text-rose-800'
                        : item.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      Status: {item.status}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-bold text-gray-900 leading-snug">{item.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>

                  {/* Evidence Snippet */}
                  {item.evidence_snippet && (
                    <div className="p-3.5 bg-gray-50/80 rounded-lg border-l-4 border-amber-400 text-xs font-mono text-gray-700 mt-3">
                      <div className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-1">
                        Deterministic Evidence Trail:
                      </div>
                      "{item.evidence_snippet}"
                    </div>
                  )}

                  {/* Resolution History Callout */}
                  {item.status === 'resolved' && (
                    <div className="p-3.5 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-900 mt-3 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Resolved by {item.resolved_by || 'Project Owner'}</span>
                        {item.resolved_at && (
                          <span className="font-normal text-emerald-700">on {new Date(item.resolved_at).toLocaleString()}</span>
                        )}
                      </div>
                      <p className="text-emerald-800 pl-5">
                        <span className="font-semibold">Resolution Notes:</span> {item.resolution_notes || 'No resolution notes specified.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-row md:flex-col items-center gap-2 shrink-0">
                  {item.status === 'open' && (
                    <>
                      <button
                        onClick={() => {
                          setResolvingConflict(item);
                          setResolutionNotes('');
                        }}
                        disabled={!canResolve}
                        title={!canResolve ? "Only Project Owners or Admins can resolve conflicts" : ""}
                        className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Resolve Conflict
                      </button>
                      <button
                        onClick={() => handleQuickStatusChange(item, 'dismissed')}
                        disabled={!canResolve}
                        className="w-full px-3 py-1.5 border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-gray-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </>
                  )}

                  {item.status !== 'open' && (
                    <button
                      onClick={() => handleQuickStatusChange(item, 'open')}
                      disabled={!canResolve}
                      className="px-3 py-1.5 border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-gray-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Reopen Conflict
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolution Modal */}
      {resolvingConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-base font-bold text-gray-900">Resolve Conflict</h3>
              <button
                onClick={() => setResolvingConflict(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Record the agreed architectural compromise or succession decision. This will be preserved in the immutable handover audit log.
            </p>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs font-medium text-gray-800 mb-4">
              <span className="font-bold text-gray-600">Target Conflict:</span> {resolvingConflict.title}
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Resolution Notes / Rationale <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Deprecated legacy monolithic MySQL in favor of distributed CockroachDB cluster per RFC-42."
                  className="w-full text-xs p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingConflict(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResolution || !resolutionNotes.trim()}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  {submittingResolution ? 'Saving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      <AuditTrailModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        projectId={selectedProjectId}
      />
    </div>
  );
};
