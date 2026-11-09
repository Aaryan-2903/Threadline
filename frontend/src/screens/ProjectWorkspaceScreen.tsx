import React, { useState } from 'react';
import { useNavigation } from '../context/useNavigation';
import { StatusBadge } from '../components/common/StatusBadge';
import { ProgressBar } from '../components/common/ProgressBar';

export const ProjectWorkspaceScreen: React.FC = () => {
  const { navigate } = useNavigation();
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    'overview' | 'tasks' | 'decisions' | 'activity' | 'documents' | 'review' | 'handover'
  >('overview');

  return (
    <div className="flex flex-col w-full">
      {/* Sticky Workspace Context Sub-Nav */}
      <div className="sticky top-14 z-20 bg-surface-container-lowest shadow-sm">
        <div className="w-full px-space-xl flex items-center justify-between overflow-x-auto">
          <div className="flex items-center space-x-1 py-1">
            <button
              onClick={() => setActiveWorkspaceTab('overview')}
              className={`flex items-center gap-space-xs px-space-md py-2 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                activeWorkspaceTab === 'overview'
                  ? 'bg-surface-container text-primary font-medium shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">overview</span>
              <span>Overview</span>
            </button>

            <button
              onClick={() => {
                setActiveWorkspaceTab('tasks');
                navigate('my-tasks');
              }}
              className="flex items-center gap-space-xs px-space-md py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">task_alt</span>
              <span>Tasks</span>
              <span className="font-code-inline text-[11px] px-1.5 py-0.2 bg-surface-container-high text-on-surface-variant rounded">
                18
              </span>
            </button>

            <button
              onClick={() => {
                setActiveWorkspaceTab('decisions');
                navigate('decisions');
              }}
              className="flex items-center gap-space-xs px-space-md py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">gavel</span>
              <span>Decisions</span>
              <span className="font-code-inline text-[11px] px-1.5 py-0.2 bg-surface-container-high text-on-surface-variant rounded">
                42
              </span>
            </button>

            <button
              onClick={() => {
                setActiveWorkspaceTab('activity');
                navigate('activity');
              }}
              className="flex items-center gap-space-xs px-space-md py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              <span>Activity</span>
              <span className="font-code-inline text-[11px] px-1.5 py-0.2 bg-surface-container-high text-on-surface-variant rounded">
                128
              </span>
            </button>

            <button
              onClick={() => {
                setActiveWorkspaceTab('documents');
                navigate('documents');
              }}
              className="flex items-center gap-space-xs px-space-md py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">article</span>
              <span>Documents</span>
              <span className="font-code-inline text-[11px] px-1.5 py-0.2 bg-surface-container-high text-on-surface-variant rounded">
                8
              </span>
            </button>

            <button
              onClick={() => {
                setActiveWorkspaceTab('review');
                navigate('ai-review-queue');
              }}
              className="flex items-center gap-space-xs px-space-md py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">psychology</span>
              <span>Knowledge Review</span>
              <span className="font-code-inline text-[11px] px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-semibold">
                6 pending
              </span>
            </button>

            <button
              onClick={() => {
                setActiveWorkspaceTab('handover');
                navigate('handover-reports');
              }}
              className="flex items-center gap-space-xs px-space-md py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
              <span>Handover</span>
              <span className="font-label-sm text-[10px] tracking-wide uppercase px-1.5 py-0.5 bg-primary-fixed text-primary font-bold rounded">
                Draft Ready
              </span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <span className="font-code-inline text-[11px] text-outline">WORKSPACE ID: PRJ-NX-841</span>
            <span className="w-1 h-1 rounded-full bg-outline"></span>
            <span className="font-code-inline text-[11px] text-outline">v2.4-STABLE</span>
          </div>
        </div>
      </div>

      {/* Primary Workspace Content Canvas */}
      <div className="w-full px-space-xl py-space-xl space-y-space-xl">
        {/* Header Banner Section */}
        <div className="bg-surface-container-lowest p-space-xl rounded-lg shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-space-lg">
          <div className="space-y-space-md">
            <div className="flex flex-wrap items-center gap-space-sm text-outline font-label-sm text-label-sm">
              <span className="font-code-inline uppercase tracking-widest text-[11px] text-primary font-bold">
                Migration Initiative
              </span>
              <span>/</span>
              <span>Infrastructure SRE Core</span>
              <span>/</span>
              <span className="font-code-inline text-on-surface">AWS-EAST-CLUSTER</span>
            </div>

            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Nexus Infrastructure Migration
            </h1>

            {/* Metadata Pills */}
            <div className="flex flex-wrap items-center gap-space-sm pt-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-800 font-label-sm text-label-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                <span className="font-semibold">Status: In Handover</span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[15px] text-primary">arrow_forward</span>
                <span className="text-outline">Target:</span>
                <span className="font-semibold text-on-surface">Marcus Vance (Principal SRE)</span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[15px] text-outline">event</span>
                <span className="text-outline">Due:</span>
                <span className="font-semibold text-on-surface">Oct 24, 2025</span>
                <span className="font-code-inline text-[11px] text-error bg-error-container/30 px-1 py-0.2 rounded font-semibold">
                  (12 days left)
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-900 font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[15px] text-emerald-700">verified</span>
                <span>Knowledge Retention Score:</span>
                <span className="font-headline-sm text-emerald-800">92%</span>
              </div>
            </div>
          </div>

          {/* Action Panel */}
          <div className="flex flex-wrap items-center gap-space-sm shrink-0 self-start xl:self-center">
            <button
              onClick={() => navigate('handover-reports')}
              className="flex items-center gap-1.5 px-space-md h-9 bg-surface-container hover:bg-surface-container-high text-on-surface rounded font-label-md text-label-md shadow-sm transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Export Handover Report</span>
            </button>

            <button
              onClick={() => navigate('decisions')}
              className="flex items-center gap-1.5 px-space-md h-9 bg-surface-container hover:bg-surface-container-high text-on-surface rounded font-label-md text-label-md shadow-sm transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>+ Add Decision</span>
            </button>

            <button
              onClick={() => navigate('my-tasks')}
              className="flex items-center gap-1.5 px-space-md h-9 bg-primary hover:bg-primary-container text-on-primary rounded font-label-md text-label-md shadow-sm transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>+ Add Task</span>
            </button>
          </div>
        </div>

        {/* Executive Summary & Continuity Context Card */}
        <div className="bg-surface-container-lowest p-space-xl rounded-lg shadow-sm space-y-space-lg">
          <div className="flex items-center justify-between pb-space-sm">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary text-[20px]">feed</span>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Executive Summary & Scope Overview
              </h2>
            </div>
            <span className="font-code-inline text-[11px] text-outline">
              AUDITED BY CONTINUITY ENGINE 42M AGO
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
            <div className="lg:col-span-8 space-y-space-md">
              <p className="font-body-lg text-body-lg text-on-surface leading-relaxed">
                <span className="font-semibold text-primary">Purpose & Scope:</span> Complete enterprise migration of legacy self-hosted RabbitMQ messaging clusters to AWS Managed Kafka (MSK). Scope includes structural migration of 14 broker nodes, upgrading service event payloads from unstructured JSON to Protobuf v3 schemas with schema-registry strict validation, and eliminating cross-region p99 latency spikes during consumer group rebalance routines.
              </p>

              <div className="p-space-md bg-surface-container-low rounded flex flex-wrap items-center gap-space-lg text-on-surface-variant font-label-md text-label-md">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-outline">Target Architecture:</span>
                  <span className="font-code-inline font-medium text-on-surface">AWS MSK v3.6.0 (KRaft)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <span className="text-outline">Schema Registry:</span>
                  <span className="font-code-inline font-medium text-on-surface">Confluent Cloud Registry Enterprise</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-outline">Traffic Cutover Date:</span>
                  <span className="font-code-inline font-medium text-on-surface">2025-10-22 03:00 UTC</span>
                </div>
              </div>
            </div>

            {/* Leadership Handover Relay Card */}
            <div className="lg:col-span-4 bg-surface-container p-space-md rounded space-y-space-sm">
              <div className="font-label-sm text-label-sm text-outline uppercase tracking-wider text-[10px] font-semibold">
                Leadership Handover Relay
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs shrink-0">
                    ER
                  </div>
                  <div className="min-w-0">
                    <p className="font-label-md text-label-md font-semibold text-on-surface truncate">
                      Elena Rostova
                    </p>
                    <p className="font-label-sm text-label-sm text-outline truncate text-[11px]">
                      Staff PM (Outgoing)
                    </p>
                  </div>
                </div>

                <div className="flex items-center px-1">
                  <span className="material-symbols-outlined text-primary text-[20px]">sync_alt</span>
                </div>

                <div className="flex items-center gap-2 min-w-0 text-right">
                  <div className="min-w-0">
                    <p className="font-label-md text-label-md font-semibold text-on-surface truncate">
                      Marcus Vance
                    </p>
                    <p className="font-label-sm text-label-sm text-outline truncate text-[11px]">
                      Principal SRE (Incoming)
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary flex items-center justify-center font-bold text-xs shrink-0">
                    MV
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] font-label-sm text-outline">
                <span>Relay Progress</span>
                <span className="font-code-inline font-bold text-on-surface">88% Transferred</span>
              </div>
              <ProgressBar progress={88} color="bg-primary" />
            </div>
          </div>
        </div>

        {/* Knowledge Continuity Health Cards (4 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg">
          {/* Card 1: Recorded Decisions */}
          <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm space-y-space-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Recorded Decisions
              </span>
              <span className="p-1 rounded bg-surface-container-low text-primary">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">
                42
              </span>
              <span className="font-label-sm text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
                100% verified
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-outline">
              Every architectural choice mapped directly to canonical ADR registry entries.
            </p>
            <div className="pt-1">
              <ProgressBar progress={100} color="bg-emerald-600" />
            </div>
          </div>

          {/* Card 2: Unfinished Tasks */}
          <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm space-y-space-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Unfinished Tasks
              </span>
              <span className="p-1 rounded bg-amber-50 text-amber-700">
                <span className="material-symbols-outlined text-[18px]">pending_actions</span>
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">
                18
              </span>
              <span className="font-label-sm text-[11px] text-error bg-error-container/30 px-1.5 py-0.5 rounded font-medium">
                4 Critical Blockers
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-outline">
              14 operational follow-ups in backlog; 4 gate check items on critical path.
            </p>
            <div className="pt-1">
              <ProgressBar progress={78} color="bg-amber-500" />
            </div>
          </div>

          {/* Card 3: Identified Risks */}
          <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm space-y-space-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Identified Risks
              </span>
              <span className="p-1 rounded bg-error-container/30 text-error">
                <span className="material-symbols-outlined text-[18px]">warning</span>
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">
                3
              </span>
              <span className="font-label-sm text-[11px] text-error font-medium">High Severity</span>
            </div>
            <p className="font-body-sm text-body-sm text-outline truncate" title="Kafka consumer rebalancing edge-cases during failover">
              Kafka rebalance edge cases during failover.
            </p>
            <div className="pt-1">
              <ProgressBar progress={60} color="bg-error" />
            </div>
          </div>

          {/* Card 4: Unresolved Questions */}
          <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm space-y-space-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Open Questions
              </span>
              <span className="p-1 rounded bg-surface-container-low text-tertiary">
                <span className="material-symbols-outlined text-[18px]">help</span>
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">
                2
              </span>
              <span className="font-label-sm text-[11px] text-tertiary bg-secondary-container px-1.5 py-0.5 rounded font-medium">
                Vendor Dependent
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-outline">
              Awaiting AWS TAM guidance on multi-VPC latency limits.
            </p>
            <div className="pt-1">
              <ProgressBar progress={30} color="bg-tertiary" />
            </div>
          </div>
        </div>

        {/* Two-Column Deep Context: Blockers vs. ADRs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-xl">
          {/* Left Column: Critical Handover Path & Blockers */}
          <div className="bg-surface-container-lowest rounded-lg shadow-sm flex flex-col justify-between">
            <div className="p-space-lg">
              <div className="flex items-center justify-between pb-space-md">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[20px]">
                    error_outline
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Critical Handover Path & Blockers
                  </h3>
                </div>
                <span className="font-label-sm text-[11px] px-2 py-0.5 rounded bg-error-container/20 text-error font-semibold">
                  3 Active Blockers
                </span>
              </div>

              {/* Blocker List */}
              <div className="space-y-space-sm">
                <div className="p-space-md bg-surface-container-low rounded flex flex-col gap-space-xs hover:bg-surface-container transition-colors">
                  <div className="flex items-center justify-between gap-space-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-error"></span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        Staging VPC peering packet loss under 50k req/s load test
                      </span>
                    </div>
                    <StatusBadge variant="urgent" />
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant pl-4">
                    MTU mismatch identified between Kubernetes CNI and AWS transit gateway. MTU renegotiation test script authored.
                  </p>
                  <div className="flex items-center justify-between pt-1 pl-4 font-label-sm text-label-sm text-outline">
                    <div className="flex items-center gap-2">
                      <span>Owner:</span>
                      <span className="font-medium text-on-surface">Marcus Vance (Principal SRE)</span>
                    </div>
                    <span className="font-code-inline text-[11px] text-on-surface-variant">TASK-904</span>
                  </div>
                </div>

                <div className="p-space-md bg-surface-container-low rounded flex flex-col gap-space-xs hover:bg-surface-container transition-colors">
                  <div className="flex items-center justify-between gap-space-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        Legacy audit log schema compatibility with MSK Connect
                      </span>
                    </div>
                    <StatusBadge variant="high" />
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant pl-4">
                    12 internal services emit unstructured timestamps without UTC timezone tags. Requires Protobuf converter filter.
                  </p>
                  <div className="flex items-center justify-between pt-1 pl-4 font-label-sm text-label-sm text-outline">
                    <div className="flex items-center gap-2">
                      <span>Owner:</span>
                      <span className="font-medium text-on-surface">Elena Rostova (Staff PM)</span>
                    </div>
                    <span className="font-code-inline text-[11px] text-on-surface-variant">TASK-882</span>
                  </div>
                </div>

                <div className="p-space-md bg-surface-container-low rounded flex flex-col gap-space-xs hover:bg-surface-container transition-colors">
                  <div className="flex items-center justify-between gap-space-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-outline"></span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        Access credentials transfer for Confluent Cloud registry
                      </span>
                    </div>
                    <StatusBadge variant="medium" />
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant pl-4">
                    Service principals need migration from Vault dev mount to production HashiCorp Vault tenant with rotated secrets.
                  </p>
                  <div className="flex items-center justify-between pt-1 pl-4 font-label-sm text-label-sm text-outline">
                    <div className="flex items-center gap-2">
                      <span>Owner:</span>
                      <span className="font-medium text-on-surface">DevOps Core Team</span>
                    </div>
                    <span className="font-code-inline text-[11px] text-on-surface-variant">TASK-830</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-space-md bg-surface-container-low rounded-b-lg flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline">
                All blockers must be green before Oct 20 cutover review.
              </span>
              <button
                onClick={() => navigate('my-tasks')}
                className="text-primary hover:text-primary-container font-label-md text-label-md font-medium flex items-center gap-1 cursor-pointer"
                type="button"
              >
                <span>View All 18 Tasks</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Right Column: Key Architectural Decisions (ADRs) */}
          <div className="bg-surface-container-lowest rounded-lg shadow-sm flex flex-col justify-between">
            <div className="p-space-lg">
              <div className="flex items-center justify-between pb-space-md">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    architecture
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Key Architectural Decisions (ADRs)
                  </h3>
                </div>
                <span className="font-label-sm text-[11px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-code-inline">
                  42 TOTAL ARCHIVED
                </span>
              </div>

              <div className="space-y-space-sm">
                <div
                  onClick={() => navigate('decisions')}
                  className="p-space-md bg-surface-container-low rounded flex flex-col gap-space-xs hover:bg-surface-container transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-code-inline font-bold text-primary text-[12px]">
                        ADR-042
                      </span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        Adopt Kafka KRaft mode to eliminate ZooKeeper operational overhead
                      </span>
                    </div>
                    <span className="font-label-sm text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-semibold uppercase">
                      Approved
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Eliminates 3 separate quorum consensus nodes, reducing monthly cloud egress costs by 18% and simplifying failover metadata sync.
                  </p>
                  <div className="flex items-center justify-between pt-1 font-label-sm text-label-sm text-outline">
                    <span>Ratified: Oct 08, 2025 by Marcus Vance & Arch Council</span>
                    <span className="flex items-center gap-1 text-primary">
                      <span className="material-symbols-outlined text-[13px]">link</span>
                      <span>docs/adr/042-kraft.md</span>
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => navigate('decisions')}
                  className="p-space-md bg-surface-container-low rounded flex flex-col gap-space-xs hover:bg-surface-container transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-code-inline font-bold text-primary text-[12px]">
                        ADR-041
                      </span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        Enforce TLS 1.3 mutual auth for all microservice producers
                      </span>
                    </div>
                    <span className="font-label-sm text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-semibold uppercase">
                      Approved
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Mandates x509 cert validation via cert-manager. Disables legacy SASL/PLAIN fallback across production ingress listeners.
                  </p>
                  <div className="flex items-center justify-between pt-1 font-label-sm text-label-sm text-outline">
                    <span>Ratified: Oct 03, 2025 by Elena Rostova & SecOps</span>
                    <span className="flex items-center gap-1 text-primary">
                      <span className="material-symbols-outlined text-[13px]">link</span>
                      <span>docs/adr/041-mTLS.md</span>
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => navigate('decisions')}
                  className="p-space-md bg-surface-container-low rounded flex flex-col gap-space-xs hover:bg-surface-container transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-code-inline font-bold text-primary text-[12px]">
                        ADR-040
                      </span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        Dead letter queue backoff & exponential retry policy
                      </span>
                    </div>
                    <span className="font-label-sm text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-semibold uppercase">
                      Approved
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Defines strict maximum unacknowledged retry windows with DLQ routing after 5 failed attempts.
                  </p>
                  <div className="flex items-center justify-between pt-1 font-label-sm text-label-sm text-outline">
                    <span>Ratified: Sep 28, 2025 by David Lin</span>
                    <span className="flex items-center gap-1 text-primary">
                      <span className="material-symbols-outlined text-[13px]">link</span>
                      <span>docs/adr/040-dlq.md</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-space-md bg-surface-container-low rounded-b-lg flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline">
                All decisions cryptographically linked to Git commits.
              </span>
              <button
                onClick={() => navigate('decisions')}
                className="text-primary hover:text-primary-container font-label-md text-label-md font-medium flex items-center gap-1 cursor-pointer"
                type="button"
              >
                <span>Browse Full ADR Catalog</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

