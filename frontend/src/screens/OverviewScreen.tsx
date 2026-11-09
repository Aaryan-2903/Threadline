import React, { useState } from 'react';
import { useNavigation } from '../context/useNavigation';
import { StatusBadge } from '../components/common/StatusBadge';
import { MetricCard } from '../components/common/MetricCard';

export const OverviewScreen: React.FC = () => {
  const { navigate } = useNavigation();
  const [taskFilter, setTaskFilter] = useState<'all' | 'blocked' | 'high'>('all');

  const projects = [
    {
      id: 'INF-109',
      name: 'Nexus Infrastructure Migration',
      subtitle: 'K8s v1.28 • Multi-region cluster migration',
      icon: 'deployed_code',
      status: 'In Handover',
      progress: 82,
      progressText: '18/22 Tasks',
      progressColor: 'bg-amber-600',
      team: [
        { initials: 'ER', name: 'Elena R. (Outgoing)', bg: 'bg-primary text-on-primary' },
        { initials: 'MT', name: 'Marcus T. (Incoming)', bg: 'bg-tertiary-container text-on-tertiary' },
        { initials: 'SK', name: 'Sophia K. (Auditor)', bg: 'bg-surface-container-highest text-on-surface-variant' },
      ],
      memberCount: '3 members',
      lastActivity: 'Decision on Kafka clustering',
      lastActivitySub: '2h ago by Marcus T.',
      health: 'Verified',
      healthVariant: 'verified',
    },
    {
      id: 'BIL-402',
      name: 'Checkout & Billing Service v2',
      subtitle: 'PCI-DSS Level 1 • Stripe Elements v3',
      icon: 'credit_card',
      status: 'Active',
      progress: 64,
      progressText: '14/22 Tasks',
      progressColor: 'bg-primary-container',
      team: [
        { initials: 'DL', name: 'David L.', bg: 'bg-surface-container-highest text-on-surface-variant' },
        { initials: 'ER', name: 'Elena R.', bg: 'bg-primary text-on-primary' },
      ],
      memberCount: '2 members',
      lastActivity: '3 tasks extracted from PRD',
      lastActivitySub: '4h ago via AI Doc Engine',
      health: '1 question pending',
      healthVariant: 'question',
    },
    {
      id: 'SEC-88',
      name: 'Enterprise RBAC Architecture',
      subtitle: 'OAuth2.1, SCIM 2.0 • Okta integration',
      icon: 'security',
      status: 'Review',
      progress: 91,
      progressText: '31/34 Tasks',
      progressColor: 'bg-purple-600',
      team: [
        { initials: 'SW', name: 'Sarah W.', bg: 'bg-tertiary text-on-tertiary' },
        { initials: 'ER', name: 'Elena R.', bg: 'bg-primary text-on-primary' },
      ],
      memberCount: 'Sarah → Elena',
      lastActivity: 'Handover generated yesterday',
      lastActivitySub: 'Awaiting peer validation',
      health: 'Complete',
      healthVariant: 'completed',
    },
    {
      id: 'UX-331',
      name: 'Customer Onboarding Redesign',
      subtitle: 'Self-serve workspace initialization',
      icon: 'supervised_user_circle',
      status: 'Active',
      progress: 45,
      progressText: '9/20 Tasks',
      progressColor: 'bg-primary-container',
      team: [
        { initials: 'AM', name: 'Alex M.', bg: 'bg-surface-container-highest text-on-surface-variant' },
        { initials: 'PN', name: 'Priya N.', bg: 'bg-surface-container-highest text-on-surface-variant' },
      ],
      memberCount: '2 members',
      lastActivity: "Doc 'v2_spec.pdf' processed",
      lastActivitySub: 'Yesterday by Priya N.',
      health: 'Verified',
      healthVariant: 'verified',
    },
  ];

  const criticalTasks = [
    {
      id: 'TASK-1',
      title: 'Finalize IdP token revocation policy',
      priority: 'Urgent',
      project: 'Enterprise RBAC',
      due: 'Due Tomorrow',
      dueError: true,
      owner: 'Elena Rostova',
      type: 'high',
    },
    {
      id: 'TASK-904',
      title: 'Staging VPC peering packet loss under 50k req/s load test',
      priority: 'Urgent',
      project: 'Nexus Infrastructure Migration',
      due: '2d overdue',
      dueError: true,
      owner: 'Marcus Vance',
      type: 'blocked',
    },
    {
      id: 'TASK-882',
      title: 'Legacy audit log schema compatibility with MSK Connect',
      priority: 'High',
      project: 'Nexus Infrastructure Migration',
      due: 'Oct 24',
      dueError: false,
      owner: 'Elena Rostova',
      type: 'high',
    },
    {
      id: 'TASK-830',
      title: 'Access credentials transfer for Confluent Cloud registry',
      priority: 'Medium',
      project: 'Nexus Infrastructure Migration',
      due: 'Oct 22',
      dueError: false,
      owner: 'DevOps Core Team',
      type: 'all',
    },
  ];

  const filteredTasks = criticalTasks.filter((task) => {
    if (taskFilter === 'blocked') return task.type === 'blocked';
    if (taskFilter === 'high') return task.priority === 'Urgent' || task.priority === 'High';
    return true;
  });

  return (
    <div className="flex flex-col w-full">
      <div className="w-full px-space-lg py-space-md space-y-space-md max-w-[1520px] mx-auto">
        {/* Top Context & Action Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded shadow-sm">
          <div className="space-y-0.5">
            <div className="flex items-center gap-space-xs text-outline font-label-sm text-label-sm uppercase tracking-wider">
              <span>Enterprise Continuity Workspace</span>
              <span>·</span>
              <span className="text-primary font-medium">Core Platform Org</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Good morning, Elena
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Here is your knowledge continuity status across 6 active workstreams. 2 handovers require verification before Friday freeze.
            </p>
          </div>
          <div className="flex items-center gap-space-sm self-start md:self-auto shrink-0">
            <button
              onClick={() => navigate('handover-reports')}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md shadow-sm hover:bg-surface-container-low transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-outline">description</span>
              <span>Generate Handover</span>
            </button>
            <button
              onClick={() => navigate('my-projects')}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded bg-primary-container text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Create Project</span>
            </button>
          </div>
        </div>

        {/* Summary Metrics (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <MetricCard
            title="Active Projects"
            value="6"
            icon="folder_managed"
            badge={<span className="font-label-sm text-label-sm text-primary font-medium">+2 in transition</span>}
            footerLeft="Target completion Q2"
            footerRight="83% velocity"
            sparkline={true}
          />
          <MetricCard
            title="Open Tasks"
            value="38"
            icon="task_alt"
            badge={<span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-error-container text-error font-medium">4 blocked</span>}
            footerLeft="Unassigned: 3 items"
            footerRight="12 completed today"
          />
          <MetricCard
            title="Decisions Recorded"
            value="142"
            icon="gavel"
            badge={<span className="font-label-sm text-label-sm text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">+12 this wk</span>}
            footerLeft="Auto-extracted from docs"
            footerRight="94.8% auto-indexed"
          />
          <MetricCard
            title="Pending Handovers"
            value="2"
            icon="assignment_late"
            iconColor="text-amber-700"
            badge={<span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-medium">Attention needed</span>}
            footerLeft="Nexus (85%), Billing v2 (Ready)"
            footerRight="→"
          />
        </div>

        {/* Knowledge Continuity Health Banner */}
        <div className="bg-surface-container-lowest rounded p-space-md shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
            <div className="flex items-start sm:items-center gap-space-md">
              <div className="w-10 h-10 rounded bg-primary-fixed flex items-center justify-center shrink-0 text-primary">
                <span className="material-symbols-outlined text-[22px]">hub</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-headline-sm text-on-surface">Knowledge Continuity Health</span>
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold tracking-tight">
                    94% Verifiable
                  </span>
                  <span className="text-outline text-[12px] hidden sm:inline">• 0 orphaned assets</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Continuity engine links decisions, architecture changes, and owner shifts directly to Git commits and tickets.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-4 shrink-0 bg-surface-container-low p-2 rounded">
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                <div className="text-left">
                  <div className="font-label-sm text-label-sm font-semibold text-on-surface">142 Decisions</div>
                  <div className="font-label-sm text-[10px] text-outline">Source evidence verified</div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                <div className="text-left">
                  <div className="font-label-sm text-label-sm font-semibold text-on-surface">3 Questions</div>
                  <div className="font-label-sm text-[10px] text-outline">Pending arch signoff</div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="w-2 h-2 rounded-full bg-error shrink-0"></span>
                <div className="text-left">
                  <div className="font-label-sm text-label-sm font-semibold text-on-surface">4 Departure Risks</div>
                  <div className="font-label-sm text-[10px] text-outline">Tasks without backup</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Projects Table */}
        <div className="bg-surface-container-lowest rounded shadow-sm overflow-hidden">
          <div className="px-space-md py-space-sm bg-surface-container-low/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-headline-sm text-on-surface">Active Continuity Projects</span>
              <span className="font-label-sm text-[11px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                6 Active
              </span>
            </div>
            <div className="flex items-center gap-space-xs text-outline font-label-sm text-label-sm">
              <button
                onClick={() => navigate('my-projects')}
                className="px-2 py-1 rounded hover:bg-surface-container text-on-surface-variant transition-colors flex items-center gap-1 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">filter_list</span>
                <span>Filter</span>
              </button>
              <button
                className="px-2 py-1 rounded hover:bg-surface-container text-on-surface-variant transition-colors flex items-center gap-1 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">sort</span>
                <span>Sort: Handover Risk</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-outline font-label-sm text-[11px] uppercase tracking-wider h-8">
                  <th className="px-space-md font-medium">Project Name</th>
                  <th className="px-space-md font-medium">Status</th>
                  <th className="px-space-md font-medium">Handover Progress</th>
                  <th className="px-space-md font-medium">Transfer Team</th>
                  <th className="px-space-md font-medium">Latest Activity</th>
                  <th className="px-space-md font-medium text-right">Continuity Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-on-surface font-body-sm text-body-sm">
                {projects.map((proj) => (
                  <tr
                    key={proj.id}
                    onClick={() => navigate('project-workspace', proj.id)}
                    className="hover:bg-surface-container-low/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-space-md py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-outline text-[16px] group-hover:text-primary transition-colors">
                          {proj.icon}
                        </span>
                        <div className="min-w-0">
                          <span className="font-medium text-on-surface block truncate">
                            {proj.name}
                          </span>
                          <span className="text-[11px] text-outline">{proj.subtitle}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-space-md py-2.5 whitespace-nowrap">
                      <StatusBadge variant={proj.status} />
                    </td>
                    <td className="px-space-md py-2.5 whitespace-nowrap">
                      <div className="w-36 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-outline">
                          <span>{proj.progress}%</span>
                          <span>{proj.progressText}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                          <div
                            className={`h-full rounded-full ${proj.progressColor}`}
                            style={{ width: `${proj.progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-space-md py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center -space-x-1.5">
                          {proj.team.map((member, mIdx) => (
                            <div
                              key={mIdx}
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium ring-2 ring-surface-container-lowest ${member.bg}`}
                              title={member.name}
                            >
                              {member.initials}
                            </div>
                          ))}
                        </div>
                        <span className="text-[11px] text-outline ml-1">{proj.memberCount}</span>
                      </div>
                    </td>
                    <td className="px-space-md py-2.5 whitespace-nowrap">
                      <div className="text-on-surface truncate max-w-xs text-[12px]">
                        {proj.lastActivity}
                      </div>
                      <div className="text-[11px] text-outline">{proj.lastActivitySub}</div>
                    </td>
                    <td className="px-space-md py-2.5 text-right whitespace-nowrap">
                      <StatusBadge variant={proj.healthVariant} label={proj.health} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Split View Grid: Left Tasks & Right Decision Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
          {/* Left Column: Critical Tasks */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded shadow-sm flex flex-col justify-between">
            <div>
              <div className="p-space-md bg-surface-container-low/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">
                    My Critical Tasks & Unfinished Work
                  </h2>
                  <p className="font-body-sm text-body-sm text-outline">
                    High liability items requiring Elena's sign-off before handover release
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-surface-container p-0.5 rounded shrink-0">
                  <button
                    onClick={() => setTaskFilter('all')}
                    className={`px-2 py-0.5 rounded font-label-sm text-label-sm font-medium transition-colors cursor-pointer ${
                      taskFilter === 'all'
                        ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                        : 'text-outline hover:text-on-surface'
                    }`}
                    type="button"
                  >
                    All (8)
                  </button>
                  <button
                    onClick={() => setTaskFilter('blocked')}
                    className={`px-2 py-0.5 rounded font-label-sm text-label-sm font-medium transition-colors cursor-pointer ${
                      taskFilter === 'blocked'
                        ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                        : 'text-outline hover:text-on-surface'
                    }`}
                    type="button"
                  >
                    Blocked (1)
                  </button>
                  <button
                    onClick={() => setTaskFilter('high')}
                    className={`px-2 py-0.5 rounded font-label-sm text-label-sm font-medium transition-colors cursor-pointer ${
                      taskFilter === 'high'
                        ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                        : 'text-outline hover:text-on-surface'
                    }`}
                    type="button"
                  >
                    High Pri (3)
                  </button>
                </div>
              </div>

              <div className="divide-y divide-surface-container">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-space-md hover:bg-surface-container-low/40 transition-colors flex items-start justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        className="mt-0.5 w-4 h-4 rounded border-0 bg-surface-container hover:bg-primary-container text-transparent hover:text-on-primary flex items-center justify-center transition-colors cursor-pointer"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[13px]">check</span>
                      </button>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            onClick={() => navigate('my-tasks')}
                            className="font-label-md text-label-md font-medium text-on-surface group-hover:text-primary transition-colors cursor-pointer"
                          >
                            {task.title}
                          </span>
                          <StatusBadge variant={task.priority} />
                        </div>
                        <div className="flex items-center gap-space-sm text-[11px] text-outline flex-wrap">
                          <span className="flex items-center gap-1 text-on-surface-variant font-medium">
                            <span className="material-symbols-outlined text-[13px]">folder</span>
                            {task.project}
                          </span>
                          <span>•</span>
                          <span className={`font-medium flex items-center gap-0.5 ${task.dueError ? 'text-error' : 'text-outline'}`}>
                            <span className="material-symbols-outlined text-[13px]">schedule</span>
                            {task.due}
                          </span>
                          <span>•</span>
                          <span>Owner: {task.owner}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 hover:bg-surface-container rounded cursor-pointer" title="Reassign" type="button">
                        <span className="material-symbols-outlined text-[16px]">person_add</span>
                      </button>
                      <button className="p-1 hover:bg-surface-container rounded cursor-pointer" title="Add Note" type="button">
                        <span className="material-symbols-outlined text-[16px]">chat_bubble_outline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-space-md bg-surface-container-low/60 rounded-b flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline">
                Showing priority items across 4 active projects
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

          {/* Right Column: Key Architectural Decisions Stream */}
          <div className="lg:col-span-5 bg-surface-container-lowest rounded shadow-sm flex flex-col justify-between">
            <div>
              <div className="p-space-md bg-surface-container-low/60 flex items-center justify-between">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">
                    Recent Decision Stream (ADRs)
                  </h2>
                  <p className="font-body-sm text-body-sm text-outline">
                    Permanent architectural choices & verified rationale
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

              <div className="divide-y divide-surface-container">
                <div
                  onClick={() => navigate('decisions')}
                  className="p-space-md hover:bg-surface-container-low/40 transition-colors cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-code-inline text-[11px] font-bold text-primary">ADR-042</span>
                    <span className="font-label-sm text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-semibold uppercase">
                      Approved
                    </span>
                  </div>
                  <h3 className="font-label-md text-label-md font-semibold text-on-surface hover:text-primary transition-colors">
                    Adopt Kafka KRaft mode to eliminate ZooKeeper operational overhead
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                    Eliminates 3 separate quorum consensus nodes, reducing monthly cloud egress costs by 18% and simplifying failover metadata sync.
                  </p>
                  <div className="pt-1 flex items-center justify-between text-[11px] text-outline">
                    <span>Oct 08 • Nexus Migration</span>
                    <span className="font-medium text-on-surface">Elena Rostova</span>
                  </div>
                </div>

                <div
                  onClick={() => navigate('decisions')}
                  className="p-space-md hover:bg-surface-container-low/40 transition-colors cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-code-inline text-[11px] font-bold text-primary">ADR-041</span>
                    <span className="font-label-sm text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-semibold uppercase">
                      Approved
                    </span>
                  </div>
                  <h3 className="font-label-md text-label-md font-semibold text-on-surface hover:text-primary transition-colors">
                    Enforce TLS 1.3 mutual auth for all microservice producers
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                    Mandates x509 cert validation via cert-manager. Disables legacy SASL/PLAIN fallback across production ingress listeners.
                  </p>
                  <div className="pt-1 flex items-center justify-between text-[11px] text-outline">
                    <span>Oct 03 • Security</span>
                    <span className="font-medium text-on-surface">SecOps Core</span>
                  </div>
                </div>

                <div
                  onClick={() => navigate('decisions')}
                  className="p-space-md hover:bg-surface-container-low/40 transition-colors cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-code-inline text-[11px] font-bold text-primary">ADR-040</span>
                    <span className="font-label-sm text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-semibold uppercase">
                      Approved
                    </span>
                  </div>
                  <h3 className="font-label-md text-label-md font-semibold text-on-surface hover:text-primary transition-colors">
                    Dead letter queue backoff & exponential retry policy
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                    Defines strict maximum unacknowledged retry windows with DLQ routing after 5 failed attempts.
                  </p>
                  <div className="pt-1 flex items-center justify-between text-[11px] text-outline">
                    <span>Sep 28 • Billing v2</span>
                    <span className="font-medium text-on-surface">David Lin</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-space-md bg-surface-container-low/60 rounded-b flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline">142 total verified decisions</span>
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
    </div>
  );
};

