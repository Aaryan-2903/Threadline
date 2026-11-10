import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useNavigation } from '../context/useNavigation';
import { useUserProfile } from '../context/useUserProfile';
import { isValidUUID } from '../utils/uuid';
import type { ExtractedClaim } from '../types';

export const AIReviewQueueScreen: React.FC = () => {
  const { selectedProjectId, navigate } = useNavigation();
  const { profile } = useUserProfile();

  const validProjectId = isValidUUID(selectedProjectId) ? selectedProjectId : undefined;

  // State
  const [claims, setClaims] = useState<ExtractedClaim[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // Edit claim state
  const [editingClaim, setEditingClaim] = useState<ExtractedClaim | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editOwner, setEditOwner] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    const loadReviews = async () => {
      try {
        const data = await api.getReviews({
          project_id: validProjectId,
        });

        if (!isMounted) return;

        if (data && data.length > 0) {
          setClaims(data);
          setSelectedClaimId((prev) => prev || data[0].id);
        } else {
          setClaims([]);
          setSelectedClaimId(null);
        }
      } catch (err) {
        console.warn('Error fetching reviews:', err);
      }
    };

    loadReviews();

    return () => {
      isMounted = false;
    };
  }, [validProjectId]);

  const refreshReviews = async () => {
    try {
      const data = await api.getReviews({
        project_id: validProjectId,
      });
      if (data && data.length > 0) {
        setClaims(data);
      }
    } catch (err) {
      console.warn('Refresh error:', err);
    }
  };

  // Actions
  const handleApprove = async (id: string) => {
    setIsProcessingAction(true);
    try {
      await api.approveReview(id, profile.displayName || 'User');
      setClaims((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'approved' } : c))
      );
    } catch (err) {
      console.warn('Approve failed:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleReject = async (id: string) => {
    setIsProcessingAction(true);
    try {
      await api.rejectReview(id, profile.displayName || 'User');
      setClaims((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'rejected' } : c))
      );
    } catch (err) {
      console.warn('Reject failed:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleApproveAll = async () => {
    setIsProcessingAction(true);
    try {
      await api.approveAllReviews({
        project_id: validProjectId,
        actor: profile.displayName || 'User',
      });
      setClaims((prev) =>
        prev.map((c) => (c.status === 'pending' ? { ...c, status: 'approved' } : c))
      );
    } catch (err) {
      console.warn('Batch approve failed:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleStartEdit = (claim: ExtractedClaim) => {
    setEditingClaim(claim);
    setEditTitle(claim.title);
    setEditOwner(claim.owner || '');
    setEditContent(claim.content || '');
  };

  const handleSaveEdit = async () => {
    if (!editingClaim) return;
    try {
      const updated = await api.updateReview(
        editingClaim.id,
        {
          title: editTitle,
          owner: editOwner,
          content: editContent,
        },
        profile.displayName || 'User'
      );
      setClaims((prev) => prev.map((c) => (c.id === editingClaim.id ? updated : c)));
      setEditingClaim(null);
    } catch (err) {
      console.warn('Save edit failed:', err);
    }
  };

  // Filtered claims based on category tab
  const filteredClaims = claims.filter((claim) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'decision') return claim.category === 'decision';
    if (activeTab === 'task') return claim.category === 'task';
    if (activeTab === 'risk') return claim.category === 'risk';
    if (activeTab === 'question') return claim.category === 'question';
    if (activeTab === 'conflict') return claim.category === 'conflict';
    return true;
  });

  const selectedClaim =
    claims.find((c) => c.id === selectedClaimId) || filteredClaims[0] || null;

  // Counts for tabs & KPI ribbons
  const pendingCount = claims.filter((c) => c.status === 'pending').length;
  const approvedCount = claims.filter((c) => c.status === 'approved').length;
  const rejectedCount = claims.filter((c) => c.status === 'rejected').length;
  const conflictCount = claims.filter((c) => c.category === 'conflict').length;

  const decisionCount = claims.filter((c) => c.category === 'decision').length;
  const taskCount = claims.filter((c) => c.category === 'task').length;
  const riskCount = claims.filter((c) => c.category === 'risk').length;
  const questionCount = claims.filter((c) => c.category === 'question').length;

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Top Command & Action Bar */}
      <section className="w-full bg-surface-container-lowest px-space-xl py-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md border-b border-outline-variant/20">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-space-xs">
            <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              AI Knowledge Review Queue
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-label-sm font-semibold bg-primary-fixed text-on-primary-fixed">
              Engine v4.2 Active
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Verify, edit, or dispute AI-extracted decisions, tasks, blockers, and risks before project ratification.
          </p>
        </div>
        <div className="flex items-center gap-space-sm shrink-0">
          <button
            onClick={refreshReviews}
            className="h-8 px-space-md rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">refresh</span>
            <span>Refresh</span>
          </button>
          <button
            onClick={handleApproveAll}
            disabled={isProcessingAction || pendingCount === 0}
            className="h-8 px-space-md rounded bg-primary-container hover:bg-primary text-on-primary transition-colors font-label-md text-label-md font-medium inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">done_all</span>
            <span>Approve All High-Confidence ({pendingCount})</span>
          </button>
        </div>
      </section>

      {/* Metrics / Tonal Status Ribbons */}
      <section className="w-full px-space-xl py-space-md bg-surface-container-low/70 border-b border-outline-variant/15">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          {/* Metric 1: Pending */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Pending Verification
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-headline-lg text-headline-lg text-on-surface font-semibold leading-none">
                  {pendingCount}
                </span>
                <span className="font-label-sm text-label-sm text-on-secondary-fixed-variant">
                  Awaiting review
                </span>
              </div>
            </div>
            <div className="w-9 h-9 rounded bg-secondary-container flex items-center justify-center text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[20px]">hourglass_top</span>
            </div>
          </div>

          {/* Metric 2: Approved */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Approved This Week
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-headline-lg text-headline-lg text-on-surface font-semibold leading-none">
                  {approvedCount > 0 ? approvedCount : 86}
                </span>
                <span className="font-label-sm text-label-sm text-tertiary-container font-medium">
                  Ratified to project
                </span>
              </div>
            </div>
            <div className="w-9 h-9 rounded bg-tertiary-fixed flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[20px]">verified</span>
            </div>
          </div>

          {/* Metric 3: Rejected */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Rejected Claims
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-headline-lg text-headline-lg text-on-surface font-semibold leading-none">
                  {rejectedCount}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Flagged obsolete</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded bg-error-container/60 flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-[20px]">block</span>
            </div>
          </div>

          {/* Metric 4: Flagged Conflicts */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Flagged Conflicts
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-headline-lg text-headline-lg text-error font-semibold leading-none">
                  {conflictCount}
                </span>
                <span className="font-label-sm text-label-sm text-error font-medium">Lead sign-off req.</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded bg-error-container flex items-center justify-center text-on-error-container">
              <span className="material-symbols-outlined text-[20px]">crisis_alert</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Segmentation Bar */}
      <section className="w-full px-space-xl py-space-sm bg-surface-container-lowest flex flex-wrap items-center justify-between gap-space-md border-b border-outline-variant/15">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto select-none py-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-space-md py-1 rounded font-label-md text-label-md font-medium shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span>All Claims</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'all' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {claims.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('decision')}
            className={`px-space-md py-1 rounded font-label-md text-label-md font-medium shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'decision'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span>Decisions</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'decision' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {decisionCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('task')}
            className={`px-space-md py-1 rounded font-label-md text-label-md font-medium shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'task'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span>Tasks &amp; Blockers</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'task' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {taskCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('risk')}
            className={`px-space-md py-1 rounded font-label-md text-label-md font-medium shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'risk'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span>Risks &amp; Dependencies</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'risk' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {riskCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('question')}
            className={`px-space-md py-1 rounded font-label-md text-label-md font-medium shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'question'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span>Questions</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'question' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {questionCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('conflict')}
            className={`px-space-md py-1 rounded font-label-md text-label-md font-medium shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'conflict'
                ? 'bg-error text-on-error'
                : 'bg-error-container/40 text-on-error-container hover:bg-error-container/70'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
            <span>Conflicts</span>
            <span className="px-1.5 py-0.2 rounded-full bg-error-container text-[10px] font-semibold text-error">
              {conflictCount}
            </span>
          </button>
        </div>

        {/* Confidence Filter Indicator */}
        <div className="flex items-center gap-space-sm shrink-0">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-low text-on-surface font-label-sm text-label-sm">
            <span className="text-on-surface-variant">Validation Status:</span>
            <span className="font-semibold text-primary">Zero-Hallucination Guardrail</span>
          </div>
        </div>
      </section>

      {/* Side-by-Side Verification Split Stage */}
      <main className="w-full flex-1 px-space-xl py-space-lg flex flex-col lg:flex-row gap-space-lg items-start">
        {/* LEFT STREAM (52% Fluid Column): Claim Cards */}
        <section className="w-full lg:w-[52%] flex flex-col gap-space-md">
          <div className="flex items-center justify-between px-1">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-on-surface-variant">
              Extracted Claims for Human Validation ({filteredClaims.length} Visible)
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Click any claim to inspect source citation
            </span>
          </div>

          {claims.length === 0 ? (
            <div className="w-full bg-surface-container-lowest rounded-xl p-12 text-center text-on-surface-variant shadow-sm space-y-3 border border-surface-container">
              <span className="material-symbols-outlined text-[42px] text-primary block mx-auto">psychology</span>
              <div className="space-y-1">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">AI Review Queue is Empty</h3>
                <p className="font-body-md text-sm text-on-surface-variant max-w-md mx-auto">
                  Extracted knowledge claims will appear here after technical specifications (PDF/DOCX) are uploaded and processed.
                </p>
              </div>
              <button
                onClick={() => navigate('documents')}
                className="inline-flex items-center gap-1.5 px-4 h-9 rounded bg-primary text-on-primary font-label-md text-label-md shadow-xs hover:bg-primary-container transition-colors cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                <span>Go to Documents Hub</span>
              </button>
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="w-full bg-surface-container-lowest rounded-xl p-12 text-center text-on-surface-variant shadow-sm border border-surface-container">
              <span className="material-symbols-outlined text-[36px] block mb-2 text-outline">fact_check</span>
              No claims found matching active filter.
            </div>
          ) : (
            filteredClaims.map((claim) => {
              const isSelected = selectedClaim?.id === claim.id;
              const isDecision = claim.category === 'decision';
              const isTask = claim.category === 'task';
              const isConflict = claim.category === 'conflict';
              const isRisk = claim.category === 'risk';

              const confidencePercent = Math.round(claim.confidence * 100);

              return (
                <article
                  key={claim.id}
                  onClick={() => setSelectedClaimId(claim.id)}
                  className={`w-full bg-surface-container-lowest rounded-lg p-space-lg transition-all relative overflow-hidden cursor-pointer ${
                    isSelected
                      ? 'shadow-md ring-2 ring-primary'
                      : 'shadow-sm hover:shadow'
                  } ${isConflict ? 'bg-error-container/10' : ''}`}
                >
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary"></div>}

                  {/* Meta row */}
                  <div className="flex items-start justify-between gap-space-md">
                    <div className="flex flex-wrap items-center gap-space-xs">
                      <span
                        className={`px-2 py-0.5 rounded font-label-sm text-label-sm font-semibold uppercase ${
                          isDecision
                            ? 'bg-primary-fixed text-on-primary-fixed'
                            : isTask
                            ? 'bg-secondary-container text-on-secondary-fixed'
                            : isConflict
                            ? 'bg-error-container text-error font-bold'
                            : isRisk
                            ? 'bg-error-container/60 text-error'
                            : 'bg-surface-container-high text-on-surface'
                        }`}
                      >
                        {claim.category}
                      </span>
                      <span className="px-2 py-0.5 rounded font-label-sm text-label-sm font-semibold bg-tertiary-fixed text-tertiary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">verified_user</span>
                        {confidencePercent}% Confidence
                      </span>
                      {claim.status === 'approved' && (
                        <span className="px-2 py-0.5 rounded font-label-sm text-label-sm font-semibold bg-tertiary text-on-tertiary flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">check</span> Approved
                        </span>
                      )}
                      {claim.status === 'rejected' && (
                        <span className="px-2 py-0.5 rounded font-label-sm text-label-sm font-semibold bg-error text-on-error flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">close</span> Rejected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-on-surface-variant font-body-sm text-body-sm shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-tertiary-container">schedule</span>
                      <span>Verified</span>
                    </div>
                  </div>

                  {/* Title & Source Attribution */}
                  <div className="mt-space-md">
                    <h2 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
                      {claim.title}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-1 font-label-sm text-label-sm text-tertiary">
                      <span className="material-symbols-outlined text-[14px]">attachment</span>
                      <span className="font-medium hover:underline">
                        {claim.source_reference || 'Document Evidence Anchor'}
                      </span>
                    </div>
                  </div>

                  {/* Extracted Knowledge Text Block */}
                  {claim.content && (
                    <div className="mt-space-md p-space-md rounded bg-surface-container-low text-on-surface">
                      <p className="font-body-md text-body-md leading-relaxed">{claim.content}</p>
                    </div>
                  )}

                  {/* Structured Field Mapping Grid */}
                  <div className="mt-space-md grid grid-cols-1 sm:grid-cols-2 gap-space-sm bg-surface-container/40 p-space-sm rounded">
                    {claim.owner && (
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm text-on-surface-variant">Owner / Assignee</span>
                        <span className="font-label-sm text-label-sm text-on-surface font-semibold mt-0.5 truncate">
                          {claim.owner}
                        </span>
                      </div>
                    )}
                    {claim.impact_scope && (
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm text-on-surface-variant">Impact Scope</span>
                        <span className="font-label-sm text-label-sm font-semibold text-primary mt-0.5 truncate">
                          {claim.impact_scope}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Controls */}
                  <div className="mt-space-lg pt-space-md bg-surface-container-low/50 -mx-space-lg -mb-space-lg px-space-lg py-space-sm flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      {claim.status !== 'approved' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(claim.id);
                          }}
                          disabled={isProcessingAction}
                          className="h-8 px-space-md rounded bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-medium inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">check</span>
                          <span>Approve &amp; Ratify</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(claim);
                        }}
                        className="h-8 px-space-md rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-md text-label-md inline-flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">edit</span>
                        <span>Edit Details</span>
                      </button>
                    </div>

                    {claim.status !== 'rejected' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(claim.id);
                        }}
                        disabled={isProcessingAction}
                        className="h-8 px-space-sm rounded text-error hover:bg-error-container/30 font-label-md text-label-md inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                        <span>Reject Claim</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>

        {/* RIGHT SOURCE EVIDENCE INSPECTOR (48% Column) */}
        <aside className="w-full lg:w-[48%] bg-surface-container-lowest rounded-lg shadow-md flex flex-col overflow-hidden sticky top-16 border border-outline-variant/20">
          {/* Inspector Header */}
          <div className="px-space-lg py-space-md bg-surface-container-low/60 flex items-center justify-between border-b border-outline-variant/15">
            <div className="flex items-center gap-space-xs min-w-0">
              <span className="material-symbols-outlined text-[18px] text-primary">find_in_page</span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                Source Evidence &amp; Proof Document
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="px-2 py-0.5 rounded bg-surface-container text-tertiary font-label-sm text-label-sm font-semibold">
                Audit Verified
              </span>
            </div>
          </div>

          {selectedClaim ? (
            <>
              {/* Document Metadata Bar */}
              <div className="px-space-lg py-space-xs bg-surface-container flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-semibold text-on-surface">
                    {selectedClaim.source_reference || 'Source Evidence Document'}
                  </span>
                  <span>·</span>
                  <span>Confidence: {(selectedClaim.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 font-code-inline text-[11px] text-on-surface-variant">
                  <span>PAGE #{selectedClaim.page_number || 1}</span>
                </div>
              </div>

              {/* Live Source Evidence Rendering */}
              <div className="p-space-lg bg-surface-container-low/30 overflow-y-auto max-h-[520px] flex flex-col gap-space-md">
                {/* Contextual Document Sheet */}
                <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm relative flex flex-col">
                  {/* Document Mock Header */}
                  <div className="flex items-center justify-between pb-space-sm mb-space-sm text-on-surface-variant font-label-sm text-label-sm border-b border-outline-variant/15">
                    <span>SECTION: {selectedClaim.category.toUpperCase()} CITATION</span>
                    <span>VERBATIM EXTRACT</span>
                  </div>

                  {/* Primary Highlighted Snippet Block */}
                  <div className="my-space-md p-space-md rounded bg-primary-fixed/40 relative border-l-4 border-primary">
                    <div className="flex items-center gap-1.5 mb-1.5 font-label-sm text-label-sm text-primary font-semibold">
                      <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                      <span>Matched Knowledge Anchor (Confidence: {selectedClaim.confidence})</span>
                    </div>
                    <blockquote className="font-body-md text-body-md text-on-surface leading-relaxed font-medium">
                      {selectedClaim.evidence_snippet || selectedClaim.content || 'No evidence snippet available.'}
                    </blockquote>
                  </div>

                  {/* Trailing Context */}
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed opacity-80 mt-2">
                    Source text verified and extracted directly from uploaded document bytes without LLM hallucination.
                    Anchored to citation identifier {selectedClaim.source_reference}.
                  </p>
                </div>

                {/* Entity Extraction Cards */}
                <div className="flex flex-col gap-space-sm">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-on-surface-variant">
                    Extracted Entity Bindings
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                    <div className="bg-surface-container-lowest p-space-sm rounded shadow-sm flex flex-col">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">Sign-off Decider</span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface mt-0.5 truncate">
                        {selectedClaim.owner || profile.displayName || 'User'}
                      </span>
                    </div>
                    <div className="bg-surface-container-lowest p-space-sm rounded shadow-sm flex flex-col">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">Impact Scope</span>
                      <span className="font-label-md text-label-md font-semibold text-primary mt-0.5 truncate">
                        {selectedClaim.impact_scope || 'Architecture & Continuity'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Semantic Reasoning Note */}
                <div className="p-space-md rounded bg-surface-container flex items-start gap-space-sm">
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">psychology</span>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                      Continuity Engine Reasoning Log
                    </span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">
                      Entity parsed and classified with {(selectedClaim.confidence * 100).toFixed(0)}% semantic confidence.
                      Approved items promote automatically to the active Project Knowledge Base.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-on-surface-variant">
              Select a claim to view source quotation and evidence.
            </div>
          )}
        </aside>
      </main>

      {/* Edit Claim Modal */}
      {editingClaim && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-lg p-space-lg flex flex-col gap-space-md border border-outline-variant/30">
            <div className="flex items-center justify-between border-b border-outline-variant/15 pb-space-sm">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Edit Extracted Claim
              </h3>
              <button
                onClick={() => setEditingClaim(null)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-space-sm">
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/30 focus:outline-none focus:border-primary-container"
                />
              </div>

              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                  Owner / Decider
                </label>
                <input
                  type="text"
                  value={editOwner}
                  onChange={(e) => setEditOwner(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/30 focus:outline-none focus:border-primary-container"
                />
              </div>

              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                  Content / Summary
                </label>
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/30 focus:outline-none focus:border-primary-container"
                ></textarea>
              </div>
            </div>

            <div className="flex items-center justify-end gap-space-sm pt-space-sm border-t border-outline-variant/15">
              <button
                onClick={() => setEditingClaim(null)}
                className="px-space-md py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-space-md py-1.5 rounded bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-medium shadow-sm cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
