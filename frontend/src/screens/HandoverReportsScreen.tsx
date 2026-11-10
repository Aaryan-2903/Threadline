import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useNavigation } from '../context/useNavigation';
import { useUserProfile } from '../context/useUserProfile';
import { isValidUUID } from '../utils/uuid';
import type { HandoverReport, Project } from '../types';

export const HandoverReportsScreen: React.FC = () => {
  const { selectedProjectId, setSelectedProjectId, navigate } = useNavigation();
  const { profile } = useUserProfile();

  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>(
    isValidUUID(selectedProjectId) ? selectedProjectId : ''
  );
  const [currentReport, setCurrentReport] = useState<HandoverReport | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Successor state
  const [successorName, setSuccessorName] = useState<string>('');
  const [successorRole, setSuccessorRole] = useState<string>('');
  const [isSavingSuccessor, setIsSavingSuccessor] = useState<boolean>(false);
  const [successorFeedback, setSuccessorFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const applyReportState = (report: HandoverReport | null) => {
    setCurrentReport(report);
    if (report?.content?.overview) {
      const incoming = report.content.overview.incoming_owner;
      const role = report.content.overview.incoming_owner_role;
      setSuccessorName(incoming && incoming !== 'Not assigned' ? incoming : '');
      setSuccessorRole(role || '');
    } else {
      setSuccessorName('');
      setSuccessorRole('');
    }
  };

  // Load projects list
  useEffect(() => {
    let isMounted = true;
    api.getProjects().then((projs) => {
      if (!isMounted) return;
      setProjects(projs || []);
      if (projs && projs.length > 0) {
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

  // Load existing reports for active project
  useEffect(() => {
    let isMounted = true;
    if (!activeProjectId || !isValidUUID(activeProjectId)) return;

    const loadReports = async () => {
      try {
        const reports = await api.getHandoverReports(activeProjectId);
        if (!isMounted) return;

        if (reports && reports.length > 0) {
          applyReportState(reports[0]);
        } else {
          // If no report generated yet, compile automatically
          const actorName = profile.displayName || 'Aryan Mandal';
          const newReport = await api.generateHandoverReport(activeProjectId, actorName);
          if (isMounted) {
            applyReportState(newReport);
          }
        }
      } catch (err) {
        console.warn('Error loading reports:', err);
      }
    };

    loadReports();

    return () => {
      isMounted = false;
    };
  }, [activeProjectId, profile.displayName]);

  // Generate or regenerate report
  const handleGenerateReport = async () => {
    if (!activeProjectId || !isValidUUID(activeProjectId)) return;
    setIsGenerating(true);
    setError(null);
    setSuccessorFeedback(null);
    try {
      const actorName = profile.displayName || 'Aryan Mandal';
      const cleanSuccessor = successorName.trim() || undefined;
      const cleanRole = successorRole.trim() || undefined;
      const newReport = await api.generateHandoverReport(
        activeProjectId,
        actorName,
        cleanSuccessor,
        cleanRole
      );
      applyReportState(newReport);
    } catch (err: any) {
      setError(err.message || 'Failed to generate handover report.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Update successor directly on existing report
  const handleSaveSuccessor = async () => {
    if (!currentReport || !isValidUUID(currentReport.id)) return;
    setIsSavingSuccessor(true);
    setError(null);
    setSuccessorFeedback(null);
    try {
      const cleanSuccessor = successorName.trim() || 'Not assigned';
      const cleanRole = successorRole.trim() || undefined;
      const updatedReport = await api.updateReportSuccessor(currentReport.id, {
        incoming_owner: cleanSuccessor,
        incoming_owner_role: cleanRole,
      });
      applyReportState(updatedReport);
      setSuccessorFeedback({
        type: 'success',
        message: cleanSuccessor === 'Not assigned' ? 'Successor cleared (Not assigned).' : `Successor updated: ${cleanSuccessor}`,
      });
      setTimeout(() => setSuccessorFeedback(null), 4000);
    } catch (err: any) {
      setSuccessorFeedback({
        type: 'error',
        message: err.message || 'Failed to update successor.',
      });
    } finally {
      setIsSavingSuccessor(false);
    }
  };

  // Export PDF trigger
  const handleExportPdf = () => {
    if (!currentReport) return;
    const downloadUrl = api.getHandoverReportPdfUrl(currentReport.id);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${currentReport.title.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const content = currentReport?.content;

  return (
    <div className="flex flex-col w-full pb-20">
      {/* Top Command & Action Bar */}
      <section className="w-full bg-surface-container-lowest px-space-xl py-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md border-b border-outline-variant/15 shadow-sm">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-space-xs flex-wrap">
            <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Handover Reports
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-label-sm font-semibold bg-tertiary-fixed text-tertiary">
              Audit Ready
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-label-sm font-semibold bg-secondary-container text-on-secondary-fixed">
              Integrity Guardrail Active
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Compiled knowledge continuity reports, executive briefings, and signed-off succession dossiers.
          </p>
        </div>

        <div className="flex items-center gap-space-sm shrink-0 flex-wrap">
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
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="h-8 px-space-md rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md font-medium inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>{isGenerating ? 'Compiling Dossier...' : 'Regenerate Dossier'}</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={!currentReport}
            className="h-8 px-space-md rounded bg-primary-container hover:bg-primary text-on-primary transition-colors font-label-md text-label-md font-medium inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            <span>Export Official PDF</span>
          </button>
        </div>
      </section>

      {/* Successor Designation & Relay Config Bar */}
      <section className="w-full bg-surface-container-lowest px-space-xl py-space-sm border-b border-outline-variant/15 flex flex-col md:flex-row md:items-center justify-between gap-space-md shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">person_check</span>
          </span>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                Incoming Successor Relay
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-surface-container text-on-surface-variant">
                Explicit Assignment
              </span>
            </div>
            <span className="text-[12px] text-on-surface-variant truncate">
              Specify incoming owner and title. Persists in report, ownership matrix, and exported PDF.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={successorName}
              onChange={(e) => setSuccessorName(e.target.value)}
              placeholder="Incoming owner name..."
              aria-label="Incoming successor name"
              className="h-8 px-2.5 rounded bg-surface-container-low text-on-surface text-[12px] border border-outline-variant/30 focus:border-primary focus:bg-surface-container-lowest focus:outline-none w-44 transition-colors"
            />
            <input
              type="text"
              value={successorRole}
              onChange={(e) => setSuccessorRole(e.target.value)}
              placeholder="Role / Title (e.g. Lead SRE)..."
              aria-label="Incoming successor role or title"
              className="h-8 px-2.5 rounded bg-surface-container-low text-on-surface text-[12px] border border-outline-variant/30 focus:border-primary focus:bg-surface-container-lowest focus:outline-none w-44 transition-colors"
            />
          </div>

          {currentReport && (
            <button
              onClick={handleSaveSuccessor}
              disabled={isSavingSuccessor}
              className="h-8 px-3 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-[12px] font-medium border border-outline-variant/30 shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">
                {isSavingSuccessor ? 'hourglass_top' : 'save'}
              </span>
              <span>{isSavingSuccessor ? 'Saving...' : 'Save Successor'}</span>
            </button>
          )}

          {successorFeedback && (
            <span
              className={`text-[11px] font-medium inline-flex items-center gap-1 ${
                successorFeedback.type === 'success' ? 'text-primary' : 'text-error'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {successorFeedback.type === 'success' ? 'check_circle' : 'error'}
              </span>
              {successorFeedback.message}
            </span>
          )}
        </div>
      </section>

      {/* Metric Ribbons */}
      {content && (
        <section className="w-full px-space-xl py-space-md bg-surface-container-low/70 border-b border-outline-variant/15">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Handover Velocity
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-headline-lg text-headline-lg text-on-surface font-semibold leading-none">
                    {content.overview.progress_percentage}%
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {content.status.completed_tasks} of {content.status.total_tasks} tasks done
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded bg-primary-fixed flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Verified Decisions
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-headline-lg text-headline-lg text-on-surface font-semibold leading-none">
                    {content.status.decisions_count}
                  </span>
                  <span className="font-label-sm text-label-sm text-tertiary-container font-medium">
                    Ratified &amp; locked
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded bg-tertiary-fixed flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[20px]">gavel</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Active Risks &amp; Blockers
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-headline-lg text-headline-lg text-error font-semibold leading-none">
                    {content.status.risks_count}
                  </span>
                  <span className="font-label-sm text-label-sm text-error font-medium">
                    {content.status.blocked_tasks} tasks blocked
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded bg-error-container flex items-center justify-center text-on-error-container">
                <span className="material-symbols-outlined text-[20px]">warning</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex flex-col min-w-0 pr-2">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Successor Relay
                </span>
                <div className="flex flex-col mt-1">
                  <span
                    className="font-headline-sm text-headline-sm font-semibold text-on-surface truncate"
                    title={content.overview.incoming_owner || 'Not assigned'}
                  >
                    {content.overview.incoming_owner || 'Not assigned'}
                  </span>
                  {content.overview.incoming_owner_role && content.overview.incoming_owner !== 'Not assigned' ? (
                    <span
                      className="font-label-sm text-label-sm text-on-surface-variant truncate"
                      title={content.overview.incoming_owner_role}
                    >
                      {content.overview.incoming_owner_role}
                    </span>
                  ) : (
                    <span className="font-label-sm text-label-sm text-on-surface-variant/70">
                      {content.overview.incoming_owner && content.overview.incoming_owner !== 'Not assigned'
                        ? 'Designated successor'
                        : 'No successor designated'}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-9 h-9 rounded bg-secondary-container flex items-center justify-center text-on-secondary-fixed shrink-0">
                <span className="material-symbols-outlined text-[20px]">person_check</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Dossier Presentation Sheet */}
      <div className="px-space-xl py-space-lg flex justify-center">
        {error && (
          <div className="w-full max-w-4xl p-4 mb-4 rounded-lg bg-error-container text-error flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        {content ? (
          <div className="w-full max-w-4xl bg-surface-container-lowest rounded-xl shadow-md p-space-xl flex flex-col gap-space-xl border border-outline-variant/20">
            {/* Dossier Title Header */}
            <div className="flex flex-col gap-2 pb-space-lg border-b border-outline-variant/20">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-code-inline text-[11px] font-bold uppercase tracking-wider text-primary">
                  Threadline Project Knowledge Continuity Dossier
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Generated: {content.overview.generated_at}
                </span>
              </div>
              <h1 className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">
                {content.overview.project_name}
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {content.overview.description}
              </p>
            </div>

            {/* Section 1: Executive Summary */}
            <div className="p-space-lg rounded-xl bg-primary-fixed/30 border border-primary/20 flex flex-col gap-2">
              <span className="font-label-sm text-[11px] uppercase font-bold text-primary tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                1. Executive Summary &amp; Overview
              </span>
              <p className="font-body-md text-body-md text-on-surface leading-relaxed font-medium">
                {content.overview.executive_summary}
              </p>
              <div className="flex items-center gap-4 text-[12px] text-on-surface-variant pt-2 border-t border-primary/10 flex-wrap">
                <span>
                  <strong>Outgoing Owner:</strong> {content.overview.outgoing_owner || 'Not assigned'}
                </span>
                <span>•</span>
                <span>
                  <strong>Incoming Owner:</strong>{' '}
                  <span className="text-on-surface font-semibold">
                    {content.overview.incoming_owner || 'Not assigned'}
                  </span>
                  {content.overview.incoming_owner_role && content.overview.incoming_owner !== 'Not assigned' && (
                    <span className="text-on-surface-variant font-normal">
                      {' '}
                      ({content.overview.incoming_owner_role})
                    </span>
                  )}
                </span>
                <span>•</span>
                <span className="text-primary font-semibold">
                  Health: {content.overview.health_score}
                </span>
              </div>
            </div>

            {/* Section 2: Key Verified Decisions */}
            <div className="flex flex-col gap-space-sm">
              <h2 className="font-headline-md text-headline-md text-on-surface font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">gavel</span>
                2. Key Verified Decisions &amp; Rationale
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Architectural mandates and governance sign-offs verified by the project working group.
              </p>

              {content.decisions.length === 0 ? (
                <p className="text-on-surface-variant text-[13px] italic">No verified decisions recorded.</p>
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  {content.decisions.map((dec) => (
                    <div
                      key={dec.id}
                      className="p-space-md rounded-lg bg-surface-container-low/70 border border-outline-variant/15 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                          {dec.title}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-tertiary-fixed text-tertiary">
                          Ratified
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                        {dec.rationale}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-on-surface-variant pt-1">
                        <span>Decided by: <strong>{dec.decided_by || 'Working Group'}</strong></span>
                        {dec.decision_date && <span>• Date: {dec.decision_date}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Completed Work vs Pending/Blocked Tasks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
              {/* Completed Work */}
              <div className="flex flex-col gap-space-sm">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-tertiary">check_circle</span>
                  3. Completed Work ({content.completed_work.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {content.completed_work.length === 0 ? (
                    <p className="text-on-surface-variant text-[12px] italic">No completed tasks yet.</p>
                  ) : (
                    content.completed_work.map((task) => (
                      <div
                        key={task.id}
                        className="p-2.5 rounded bg-surface-container-low text-[12px] flex items-center justify-between"
                      >
                        <span className="font-medium text-on-surface truncate">{task.title}</span>
                        <span className="text-on-surface-variant shrink-0">{task.assignee || 'Unassigned'}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Pending and Blocked */}
              <div className="flex flex-col gap-space-sm">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-error">schedule</span>
                  4. Pending &amp; Blocked Tasks ({content.pending_and_blocked_tasks.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {content.pending_and_blocked_tasks.length === 0 ? (
                    <p className="text-on-surface-variant text-[12px] italic">All tasks completed.</p>
                  ) : (
                    content.pending_and_blocked_tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`p-2.5 rounded text-[12px] flex flex-col gap-1 ${
                          task.status === 'blocked'
                            ? 'bg-error-container/20 border-l-2 border-error'
                            : 'bg-surface-container-low'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-on-surface truncate">{task.title}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              task.status === 'blocked' ? 'bg-error text-on-error' : 'bg-surface-container'
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                          <span>Assignee: {task.assignee || 'Unassigned'}</span>
                          <span>Due: {task.due_date || 'No deadline'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Section 5: Ownership Matrix */}
            <div className="flex flex-col gap-space-sm">
              <h2 className="font-headline-md text-headline-md text-on-surface font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">groups</span>
                5. Ownership &amp; Succession Matrix
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-surface-container text-on-surface-variant uppercase text-[11px] border-b border-outline-variant/20">
                      <th className="py-2 px-3">Owner / Engineer</th>
                      <th className="py-2 px-3">Role</th>
                      <th className="py-2 px-3">Active Tasks</th>
                      <th className="py-2 px-3">Decisions Signed</th>
                      <th className="py-2 px-3 text-right">Handover Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low">
                    {content.ownership_matrix.map((own) => (
                      <tr key={own.name} className="hover:bg-surface-container-low/50">
                        <td className="py-2 px-3 font-semibold text-on-surface">{own.name}</td>
                        <td className="py-2 px-3 text-on-surface-variant">{own.role}</td>
                        <td className="py-2 px-3">{own.assigned_tasks_count}</td>
                        <td className="py-2 px-3">{own.decisions_signed_count}</td>
                        <td className="py-2 px-3 text-right text-primary font-medium">{own.handover_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 6: Risks and Blockers (Confirmed) */}
            <div className="flex flex-col gap-space-sm">
              <h2 className="font-headline-md text-headline-md text-on-surface font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-error">warning</span>
                6. Operational Risks &amp; Blockers (Confirmed)
              </h2>
              {content.risks_and_blockers.length === 0 ? (
                <p className="text-on-surface-variant text-[13px] italic">No active risks or blockers identified.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {content.risks_and_blockers.map((r) => (
                    <div
                      key={r.id}
                      className="p-space-md rounded-lg bg-error-container/10 border border-error/20 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-headline-sm text-headline-sm text-error font-semibold">
                          {r.title}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-error text-on-error">
                          {r.severity}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-on-surface-variant">
                        Impact: {r.impact_scope}
                      </span>
                      {r.evidence_snippet && (
                        <blockquote className="text-[11px] text-on-surface italic bg-surface-container-lowest p-2 rounded border-l-2 border-error">
                          "{r.evidence_snippet}"
                        </blockquote>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 7: Recommended Next Actions (Inferred) */}
            <div className="flex flex-col gap-space-sm">
              <h2 className="font-headline-md text-headline-md text-on-surface font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">psychology</span>
                7. Recommended Next Actions (Inferred Recommendations)
              </h2>
              <div className="flex flex-col gap-2">
                {content.recommended_next_actions.map((act, i) => (
                  <div
                    key={i}
                    className="p-space-sm rounded-lg bg-surface-container-low flex items-center justify-between text-[12px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary-container text-on-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-medium text-on-surface">{act.action}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-on-surface-variant shrink-0">
                      <span>Owner: <strong>{act.target_owner}</strong></span>
                      <span>({act.suggested_timeframe})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 8: Source Documents & Citations */}
            <div className="flex flex-col gap-space-sm pt-space-md border-t border-outline-variant/15">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">description</span>
                8. Source Documents &amp; Evidence References ({content.source_documents.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {content.source_documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2 rounded bg-surface-container-low text-[11px] flex flex-col gap-0.5"
                  >
                    <span className="font-semibold text-on-surface truncate">{doc.filename}</span>
                    <span className="text-on-surface-variant">
                      {doc.file_type.toUpperCase()} • {doc.page_count} pgs • {doc.extracted_claims_count} claims
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-16 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] block mb-2 text-outline">
              assignment_turned_in
            </span>
            <p className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              {projects.length === 0 ? 'No Projects Available' : 'No Handover Report Generated Yet'}
            </p>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1 mb-4">
              {projects.length === 0
                ? 'Create a project in My Projects to begin capturing knowledge and compile official handover dossiers.'
                : 'Select a project and click "Compile Handover Dossier" to compile verified decisions, tasks, and ownership relays.'}
            </p>
            {projects.length === 0 ? (
              <button
                onClick={() => navigate('my-projects')}
                className="px-4 py-2 rounded bg-primary text-on-primary font-medium shadow-sm hover:bg-primary-container transition-colors cursor-pointer"
              >
                Go to My Projects
              </button>
            ) : (
              <button
                onClick={handleGenerateReport}
                disabled={isGenerating || !activeProjectId}
                className="px-4 py-2 rounded bg-primary text-on-primary font-medium shadow-sm hover:bg-primary-container transition-colors cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? 'Compiling...' : 'Generate Handover Dossier'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
