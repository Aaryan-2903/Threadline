import React, { useState, useEffect, useMemo } from 'react';
import type { Task, Project, TaskStatus, TaskPriority } from '../types';
import { api } from '../api/client';
import { useNavigation } from '../context/useNavigation';

type TabFilter = 'all' | 'unfinished' | 'blockers' | 'overdue' | 'completed';

export const MyTasksScreen: React.FC = () => {
  const { navigateTo } = useNavigation();
  const [currentTimestamp] = useState(() => Date.now());

  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    projectId: '',
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    status: 'todo' as TaskStatus,
    assignee: 'Elena Rostova',
    dueDate: '',
  });

  // Load projects and tasks from API
  useEffect(() => {
    let isMounted = true;
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const [fetchedProjects, fetchedTasks] = await Promise.all([
          api.getProjects(),
          api.getTasks(),
        ]);

        if (!isMounted) return;
        setProjects(fetchedProjects);

        if (fetchedTasks.length > 0) {
          setTasks(fetchedTasks);
          setSelectedTaskId(prev => prev || fetchedTasks[0].id);
        } else if (fetchedProjects.length > 0) {
          // If DB has projects but 0 tasks, seed initial tasks matching Stitch spec into backend
          const nexusProj = fetchedProjects.find(p => p.name.includes('Nexus')) || fetchedProjects[0];
          try {
            const sampleTasks = [
              {
                project_id: nexusProj.id,
                title: 'Staging VPC peering packet loss under 50k req/s load test',
                description: 'MTU mismatch identified between Kubernetes CNI and AWS transit gateway. MTU renegotiation test script authored. Requires root AWS IAM elevation to apply kernel MTU parameters in cluster nodes.',
                priority: 'urgent' as TaskPriority,
                status: 'blocked' as TaskStatus,
                assignee: 'Elena Rostova',
                due_date: new Date(currentTimestamp - 2 * 86400000).toISOString(),
                actor: 'Elena Rostova',
              },
              {
                project_id: nexusProj.id,
                title: 'Legacy audit log schema compatibility with MSK Connect',
                description: 'Validate Kafka Connect schema registry serializers and Protobuf descriptor mappings for event streaming pipelines.',
                priority: 'high' as TaskPriority,
                status: 'in_progress' as TaskStatus,
                assignee: 'Marcus Vance',
                due_date: new Date(currentTimestamp + 4 * 86400000).toISOString(),
                actor: 'Marcus Vance',
              },
              {
                project_id: nexusProj.id,
                title: 'Access credentials transfer for Confluent Cloud registry',
                description: 'Rotate API access keys and delegate KMS envelope encryption master keys to incoming platform reliability lead.',
                priority: 'medium' as TaskPriority,
                status: 'todo' as TaskStatus,
                assignee: 'Elena Rostova',
                due_date: new Date(currentTimestamp + 2 * 86400000).toISOString(),
                actor: 'Elena Rostova',
              },
              {
                project_id: nexusProj.id,
                title: 'Finalize IdP token revocation policy and TTL sync',
                description: 'Bridge Okta SCIM directory events with OIDC session lifetime revocation hooks.',
                priority: 'urgent' as TaskPriority,
                status: 'in_progress' as TaskStatus,
                assignee: 'Elena Rostova',
                due_date: new Date(currentTimestamp + 1 * 86400000).toISOString(),
                actor: 'Elena Rostova',
              },
              {
                project_id: nexusProj.id,
                title: 'Reconcile Stripe webhook idempotency edge cases',
                description: 'Verify Redis lock lease expiration and transactional rollback guarantees during distributed network partitions.',
                priority: 'high' as TaskPriority,
                status: 'blocked' as TaskStatus,
                assignee: 'David Lin',
                due_date: new Date(currentTimestamp + 5 * 86400000).toISOString(),
                actor: 'David Lin',
              },
            ];

            const createdTasks: Task[] = [];
            for (const st of sampleTasks) {
              const created = await api.createTask(st);
              createdTasks.push(created);
            }
            if (!isMounted) return;
            setTasks(createdTasks);
            setSelectedTaskId(createdTasks[0].id);
          } catch {
            if (!isMounted) return;
            setTasks([]);
          }
        } else {
          // No projects in DB: create Nexus project first, then seed
          try {
            const newProj = await api.createProject({
              name: 'Nexus Infrastructure Migration',
              description: 'Core cloud VPC and Kafka modernization project with zero-downtime cutover.',
            });
            if (!isMounted) return;
            setProjects([newProj]);
            const created = await api.createTask({
              project_id: newProj.id,
              title: 'Staging VPC peering packet loss under 50k req/s load test',
              description: 'MTU mismatch identified between Kubernetes CNI and AWS transit gateway. MTU renegotiation test script authored.',
              priority: 'urgent',
              status: 'blocked',
              assignee: 'Elena Rostova',
              actor: 'Elena Rostova',
            });
            if (!isMounted) return;
            setTasks([created]);
            setSelectedTaskId(created.id);
          } catch {
            if (!isMounted) return;
            setTasks([]);
          }
        }
      } catch (err: unknown) {
        console.error('Failed to load tasks:', err);
        if (isMounted) {
          setError('Unable to connect to tasks API. Please check your backend connection.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTasks();
    return () => {
      isMounted = false;
    };
  }, [currentTimestamp]);

  // Selected task
  const selectedTask = useMemo(() => {
    return tasks.find(t => t.id === selectedTaskId) || tasks[0] || null;
  }, [tasks, selectedTaskId]);

  // Project lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Tab filter
      if (activeTab === 'unfinished' && t.status === 'done') return false;
      if (activeTab === 'blockers' && t.status !== 'blocked') return false;
      if (activeTab === 'completed' && t.status !== 'done') return false;
      if (activeTab === 'overdue') {
        if (!t.due_date || t.status === 'done') return false;
        if (new Date(t.due_date).getTime() >= currentTimestamp) return false;
      }

      // Project filter
      if (selectedProjectId !== 'all' && t.project_id !== selectedProjectId) return false;

      // Priority filter
      if (selectedPriority !== 'all' && t.priority !== selectedPriority) return false;

      // Status filter
      if (selectedStatus !== 'all' && t.status !== selectedStatus) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(query);
        const matchDesc = t.description?.toLowerCase().includes(query);
        const matchAssignee = t.assignee?.toLowerCase().includes(query);
        const matchProj = projectMap.get(t.project_id)?.name.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchAssignee && !matchProj) return false;
      }

      return true;
    });
  }, [tasks, activeTab, selectedProjectId, selectedPriority, selectedStatus, searchQuery, projectMap, currentTimestamp]);

  // KPI calculations
  const totalAssigned = tasks.length;
  const blockedCount = tasks.filter(t => t.status === 'blocked').length;
  const overdueCount = tasks.filter(t => t.due_date && new Date(t.due_date).getTime() < currentTimestamp && t.status !== 'done').length;
  const completedCount = tasks.filter(t => t.status === 'done').length;
  const unfinishedCount = tasks.filter(t => t.status !== 'done').length;

  // Task Actions
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const updated = await api.updateTask(taskId, {
        status: newStatus,
        actor: 'Elena Rostova',
      });
      setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)));
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update task status in backend.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(taskId, 'Elena Rostova');
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (selectedTaskId === taskId) {
        const remaining = tasks.filter(t => t.id !== taskId);
        setSelectedTaskId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
      alert('Failed to delete task.');
    }
  };

  // Create Task Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Task title is required');
      return;
    }
    const targetProjectId = formData.projectId || (projects[0]?.id ?? '');
    if (!targetProjectId) {
      setFormError('A project must be selected');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      const newTask = await api.createTask({
        project_id: targetProjectId,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        status: formData.status,
        assignee: formData.assignee.trim() || undefined,
        due_date: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        actor: 'Elena Rostova',
      });

      setTasks(prev => [newTask, ...prev]);
      setSelectedTaskId(newTask.id);
      setShowCreateModal(false);
      setFormData({
        projectId: '',
        title: '',
        description: '',
        priority: 'medium',
        status: 'todo',
        assignee: 'Elena Rostova',
        dueDate: '',
      });
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Task Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    if (!formData.title.trim()) {
      setFormError('Task title is required');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      const updated = await api.updateTask(selectedTask.id, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        status: formData.status,
        assignee: formData.assignee.trim() || undefined,
        due_date: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        actor: 'Elena Rostova',
      });

      setTasks(prev => prev.map(t => (t.id === selectedTask.id ? updated : t)));
      setShowEditModal(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (task: Task) => {
    setFormData({
      projectId: task.project_id,
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      assignee: task.assignee || '',
      dueDate: task.due_date ? task.due_date.slice(0, 10) : '',
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    setFormData({
      projectId: projects[0]?.id || '',
      title: '',
      description: '',
      priority: 'medium',
      status: 'todo',
      assignee: 'Elena Rostova',
      dueDate: '',
    });
    setFormError(null);
    setShowCreateModal(true);
  };

  const getTaskShortCode = (id: string, index: number) => {
    if (!id) return `TASK-${index + 1}`;
    const clean = id.replace(/-/g, '').slice(0, 3).toUpperCase();
    return `TASK-${clean}`;
  };

  return (
    <div className="flex flex-col w-full">
      {/* Workstation Container */}
      <div className="p-space-xl flex flex-col gap-space-lg max-w-[1600px] mx-auto w-full">
        {/* 1. Header Area: Action-oriented cockpit header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pb-space-xs">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight">My Tasks</span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-code-inline text-[11px] font-semibold">
                Q4-SPRINT-08
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Personal ownership, unfinished blockers, and transition action items across active projects.
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <button
              onClick={() => {
                const csvContent =
                  'data:text/csv;charset=utf-8,' +
                  ['ID,Title,Status,Priority,Assignee,Due Date']
                    .concat(tasks.map(t => `"${t.id}","${t.title}","${t.status}","${t.priority}","${t.assignee || ''}","${t.due_date || ''}"`))
                    .join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', 'threadline-tasks.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="h-8 px-3 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md font-medium hover:bg-surface-container transition-colors inline-flex items-center gap-1.5 shadow-sm border border-outline-variant/30"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">file_download</span>
              <span>Export CSV</span>
            </button>
            <button
              onClick={openCreateModal}
              className="h-8 px-3.5 rounded bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-medium inline-flex items-center gap-1.5 shadow-sm transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Create Task</span>
            </button>
          </div>
        </div>

        {/* 2. Metrics Bar: 4 High-Density KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          {/* Card 1 */}
          <div className="bg-surface-container-lowest rounded-lg p-space-md flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-bright transition-colors border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
                Total Assigned
              </span>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">assignment</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-semibold">
                {totalAssigned}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded">
                {projects.length} active projects
              </span>
            </div>
            <div className="w-full bg-surface-container-high h-1 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-primary-container h-full rounded-full transition-all duration-500"
                style={{ width: totalAssigned > 0 ? `${Math.round(((totalAssigned - blockedCount) / totalAssigned) * 100)}%` : '0%' }}
              />
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-surface-container-lowest rounded-lg p-space-md flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-bright transition-colors border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-error font-semibold uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
                Blocked &amp; At Risk
              </span>
              <span className="material-symbols-outlined text-[18px] text-error">farsight_digital</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="font-headline-xl text-headline-xl text-error tracking-tight font-semibold">
                {blockedCount}
              </span>
              <span className="font-label-sm text-label-sm text-error-container bg-error/10 text-error px-2 py-0.5 rounded font-medium">
                Requires resolution
              </span>
            </div>
            <div className="w-full bg-surface-container-high h-1 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-error h-full rounded-full transition-all duration-500"
                style={{ width: totalAssigned > 0 ? `${Math.min(100, Math.round((blockedCount / totalAssigned) * 100))}%` : '0%' }}
              />
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-surface-container-lowest rounded-lg p-space-md flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-bright transition-colors border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider">
                Overdue / SLA Cutoff
              </span>
              <span className="material-symbols-outlined text-[18px] text-secondary">schedule</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-semibold">
                {overdueCount}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded">
                Freeze pending
              </span>
            </div>
            <div className="w-full bg-surface-container-high h-1 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-secondary h-full rounded-full transition-all duration-500"
                style={{ width: totalAssigned > 0 ? `${Math.min(100, Math.round((overdueCount / totalAssigned) * 100))}%` : '0%' }}
              />
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-surface-container-lowest rounded-lg p-space-md flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-bright transition-colors border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
                Sprint Verified
              </span>
              <span className="material-symbols-outlined text-[18px] text-tertiary">check_circle</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-semibold">
                {completedCount}
              </span>
              <span className="font-label-sm text-label-sm text-tertiary bg-secondary-container/40 px-2 py-0.5 rounded font-medium">
                Git signed-off
              </span>
            </div>
            <div className="w-full bg-surface-container-high h-1 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-tertiary-container h-full rounded-full transition-all duration-500"
                style={{ width: totalAssigned > 0 ? `${Math.round((completedCount / totalAssigned) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* 3. Filter Bar & Segmented Navigation Controls */}
        <div className="bg-surface-container-lowest rounded-lg p-space-sm shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-space-sm border border-outline-variant/20">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded font-label-md text-label-md whitespace-nowrap transition-colors ${
                activeTab === 'all'
                  ? 'bg-surface-container-high text-on-surface font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
              type="button"
            >
              All Tasks <span className="ml-1 text-on-surface-variant font-normal">{totalAssigned}</span>
            </button>
            <button
              onClick={() => setActiveTab('unfinished')}
              className={`px-3 py-1.5 rounded font-label-md text-label-md whitespace-nowrap transition-colors ${
                activeTab === 'unfinished'
                  ? 'bg-surface-container-high text-on-surface font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
              type="button"
            >
              My Unfinished <span className="ml-1 text-on-surface-variant font-normal">{unfinishedCount}</span>
            </button>
            <button
              onClick={() => setActiveTab('blockers')}
              className={`px-3 py-1.5 rounded font-label-md text-label-md whitespace-nowrap transition-colors flex items-center gap-1 ${
                activeTab === 'blockers'
                  ? 'bg-error-container text-on-error-container font-semibold'
                  : 'text-error hover:bg-surface-container-low'
              }`}
              type="button"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-error" />
              Blockers <span className="ml-1 font-medium">{blockedCount}</span>
            </button>
            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-3 py-1.5 rounded font-label-md text-label-md whitespace-nowrap transition-colors ${
                activeTab === 'overdue'
                  ? 'bg-surface-container-high text-on-surface font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
              type="button"
            >
              Overdue <span className="ml-1 text-on-surface-variant font-normal">{overdueCount}</span>
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 rounded font-label-md text-label-md whitespace-nowrap transition-colors ${
                activeTab === 'completed'
                  ? 'bg-surface-container-high text-on-surface font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
              type="button"
            >
              Completed <span className="ml-1 text-on-surface-variant font-normal">{completedCount}</span>
            </button>
          </div>

          {/* Controls Right: Quick Search + Popover Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex items-center min-w-[240px] flex-1 lg:flex-none">
              <span className="material-symbols-outlined absolute left-2.5 text-[16px] text-on-surface-variant pointer-events-none">
                search
              </span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 w-full pl-8 pr-10 rounded bg-surface-container-low/80 text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30 transition-all"
                placeholder="Filter tasks by title, tag, or project..."
                type="text"
              />
              <kbd className="absolute right-2 px-1.5 py-0.5 rounded bg-surface-container-highest/70 font-code-inline text-[10px] text-on-surface-variant uppercase font-medium">
                ⌘F
              </kbd>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Project Select */}
              <select
                aria-label="Filter tasks by project"
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="h-8 px-2.5 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md border border-outline-variant/30 cursor-pointer focus:outline-none"
              >
                <option value="all">Project: All ({projects.length})</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Priority Select */}
              <select
                aria-label="Filter tasks by priority"
                value={selectedPriority}
                onChange={e => setSelectedPriority(e.target.value)}
                className="h-8 px-2.5 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md border border-outline-variant/30 cursor-pointer focus:outline-none"
              >
                <option value="all">Priority: All</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              {/* Status Select */}
              <select
                aria-label="Filter tasks by status"
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="h-8 px-2.5 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md border border-outline-variant/30 cursor-pointer focus:outline-none"
              >
                <option value="all">Status: All</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="py-16 text-center flex flex-col items-center justify-center gap-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20 shadow-sm">
            <span className="material-symbols-outlined text-[36px] text-primary animate-spin">refresh</span>
            <span className="font-body-md text-body-md text-on-surface-variant font-medium">Loading tasks from Threadline database...</span>
          </div>
        )}

        {error && (
          <div className="p-space-md rounded-lg bg-error-container/20 border border-error/30 text-error flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <span className="font-body-md text-body-md font-medium">{error}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 rounded bg-error text-on-error font-label-sm text-label-sm font-medium hover:opacity-90"
            >
              Retry
            </button>
          </div>
        )}

        {/* 4. Main Split View Layout: Left Table (8 cols) + Right Drawer (4 cols) */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
            {/* LEFT WORKSTREAM TABLE (8 cols ~ 66.6%) */}
            <div className="lg:col-span-8 flex flex-col bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden border border-outline-variant/20">
              {/* Table Toolbar */}
              <div className="h-10 px-space-md bg-surface-container-low/50 flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm border-b border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-on-surface">Showing {filteredTasks.length} task handovers</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-code-inline text-[11px]">Sorted by: Handover Blocker First</span>
                  <button className="hover:text-on-surface transition-colors flex items-center" type="button" title="Toggle sort">
                    <span className="material-symbols-outlined text-[16px]">swap_vert</span>
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/90 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider h-8 border-b border-outline-variant/20">
                      <th className="w-9 px-space-sm text-center"></th>
                      <th className="px-space-sm font-semibold">Identifier &amp; Title</th>
                      <th className="px-space-sm font-semibold">Priority</th>
                      <th className="px-space-sm font-semibold">Status</th>
                      <th className="px-space-sm font-semibold">Due Date</th>
                      <th className="px-space-sm font-semibold">Handover Impact</th>
                    </tr>
                  </thead>
                  <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-outline-variant/10">
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                          <div className="flex flex-col items-center gap-2">
                            <span className="material-symbols-outlined text-[32px] text-outline">search_off</span>
                            <span className="font-body-md text-body-md font-medium">No tasks found matching current filters</span>
                            <button
                              onClick={() => {
                                setActiveTab('all');
                                setSelectedProjectId('all');
                                setSelectedPriority('all');
                                setSelectedStatus('all');
                                setSearchQuery('');
                              }}
                              className="text-primary text-label-md font-medium hover:underline mt-1"
                            >
                              Reset filters
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredTasks.map((task, idx) => {
                        const isSelected = selectedTask?.id === task.id;
                        const code = getTaskShortCode(task.id, idx);
                        const projName = projectMap.get(task.project_id)?.name || 'Project';
                        const isOverdue = task.due_date && new Date(task.due_date).getTime() < currentTimestamp && task.status !== 'done';

                        return (
                          <tr
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className={`h-12 cursor-pointer transition-colors relative group ${
                              isSelected
                                ? 'bg-primary-fixed/20 hover:bg-primary-fixed/30'
                                : 'bg-surface-container-lowest hover:bg-surface-container-low'
                            }`}
                          >
                            <td className="w-9 px-space-sm text-center">
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={task.status === 'done'}
                                  onChange={e => {
                                    e.stopPropagation();
                                    handleStatusChange(task.id, task.status === 'done' ? 'todo' : 'done');
                                  }}
                                  className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                                />
                              </div>
                            </td>
                            <td className="px-space-sm py-2">
                              <div className="flex flex-col min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-code-inline text-primary-container font-semibold text-[11px]">
                                    {code}
                                  </span>
                                  <span
                                    className={`truncate font-headline-sm text-headline-sm font-medium ${
                                      task.status === 'done' ? 'line-through text-on-surface-variant' : 'text-on-surface'
                                    }`}
                                  >
                                    {task.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant font-label-sm text-[10px]">
                                    {projName}
                                  </span>
                                  {task.assignee && (
                                    <span className="text-on-surface-variant text-[11px] truncate">• {task.assignee}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-space-sm py-2 whitespace-nowrap">
                              {task.priority === 'urgent' && (
                                <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-label-sm text-[11px] font-semibold inline-flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">priority_high</span>
                                  Urgent
                                </span>
                              )}
                              {task.priority === 'high' && (
                                <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-fixed-variant font-label-sm text-[11px] font-medium inline-flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">keyboard_double_arrow_up</span>
                                  High
                                </span>
                              )}
                              {task.priority === 'medium' && (
                                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-[11px]">
                                  Medium
                                </span>
                              )}
                              {task.priority === 'low' && (
                                <span className="px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant font-label-sm text-[11px]">
                                  Low
                                </span>
                              )}
                            </td>
                            <td className="px-space-sm py-2 whitespace-nowrap">
                              {task.status === 'blocked' && (
                                <span className="px-2 py-0.5 rounded bg-error/15 text-error font-label-sm text-[11px] font-semibold">
                                  Blocked
                                </span>
                              )}
                              {task.status === 'in_progress' && (
                                <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant font-label-sm text-[11px] font-medium">
                                  In Progress
                                </span>
                              )}
                              {task.status === 'todo' && (
                                <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-[11px]">
                                  To Do
                                </span>
                              )}
                              {task.status === 'done' && (
                                <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-[11px] font-semibold inline-flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[12px]">check</span>
                                  Done
                                </span>
                              )}
                            </td>
                            <td className="px-space-sm py-2 whitespace-nowrap">
                              {task.due_date ? (
                                <div className="flex flex-col">
                                  <span className={`flex items-center gap-1 ${isOverdue ? 'text-error font-medium' : 'text-on-surface'}`}>
                                    {isOverdue && <span className="material-symbols-outlined text-[13px]">warning</span>}
                                    {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                  {isOverdue && <span className="font-label-sm text-[10px] text-error font-semibold">Overdue</span>}
                                </div>
                              ) : (
                                <span className="text-on-surface-variant text-[12px]">—</span>
                              )}
                            </td>
                            <td className="px-space-sm py-2 whitespace-nowrap">
                              {task.status === 'blocked' ? (
                                <span className="px-2 py-0.5 rounded bg-error/10 text-error font-label-sm text-[11px] font-medium flex items-center gap-1 w-fit">
                                  <span className="material-symbols-outlined text-[13px]">block</span>
                                  Handover Blocker
                                </span>
                              ) : task.assignee?.includes('Marcus') ? (
                                <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-[11px]">
                                  <span className="material-symbols-outlined text-[14px] text-tertiary">swap_horiz</span>
                                  <span>To Marcus V.</span>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-[11px]">
                                  {task.assignee || 'Elena R. (Self)'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Footer */}
              <div className="px-space-md py-2.5 bg-surface-container-low/40 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant border-t border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span>Showing {filteredTasks.length} of {tasks.length} tasks</span>
                </div>
                <div className="flex items-center gap-1">
                  <button className="w-7 h-7 rounded hover:bg-surface-container flex items-center justify-center text-on-surface-variant disabled:opacity-30" disabled type="button">
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </button>
                  <span className="px-2 py-0.5 rounded bg-surface-container-lowest font-medium text-on-surface border border-outline-variant/30">1</span>
                  <span className="px-1">of</span>
                  <span className="px-1">1</span>
                  <button className="w-7 h-7 rounded hover:bg-surface-container flex items-center justify-center text-on-surface-variant disabled:opacity-30" disabled type="button">
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </div>

              {/* Visual Sparkline / Workstream velocity bar */}
              <div className="px-space-md py-3 bg-surface-container-low/20 flex items-center justify-between gap-space-md border-t border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-tertiary">insights</span>
                  <span className="font-label-sm text-label-sm text-on-surface font-medium">
                    Sprint 08 Velocity: On Track ({totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0}% handover signoff ready)
                  </span>
                </div>
                {/* Inline micro SVG sparkline */}
                <svg className="w-32 h-6 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 100 20">
                  <path d="M0,15 L20,12 L35,14 L50,8 L65,10 L80,4 L100,2" strokeLinecap="round" />
                  <circle className="fill-primary" cx="100" cy="2" r="2.5" />
                </svg>
              </div>
            </div>

            {/* RIGHT TASK DETAIL INSPECTOR (4 cols ~ 33.3%) */}
            <div className="lg:col-span-4 flex flex-col bg-surface-container-lowest rounded-lg shadow-sm p-space-md gap-space-md border border-outline-variant/20 sticky top-20">
              {selectedTask ? (
                <>
                  {/* Inspector Top Header */}
                  <div className="flex items-start justify-between gap-2 pb-space-sm border-b border-outline-variant/20">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-code-inline text-primary-container font-semibold text-[13px]">
                          {getTaskShortCode(selectedTask.id, 0)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-label-sm text-[11px] font-semibold ${
                            selectedTask.status === 'blocked'
                              ? 'bg-error-container text-on-error-container'
                              : selectedTask.status === 'done'
                              ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                              : 'bg-primary-fixed text-on-primary-fixed-variant'
                          }`}
                        >
                          {selectedTask.status.toUpperCase()}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-label-sm text-[11px] font-semibold ${
                            selectedTask.priority === 'urgent'
                              ? 'bg-error/15 text-error'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {selectedTask.priority.toUpperCase()}
                        </span>
                      </div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight mt-1.5">
                        {selectedTask.title}
                      </h2>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(selectedTask)}
                        className="w-7 h-7 rounded hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
                        title="Edit task"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteTask(selectedTask.id)}
                        className="w-7 h-7 rounded hover:bg-error-container/40 flex items-center justify-center text-error transition-colors"
                        title="Delete task"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Section: Description & Diagnostic Note */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                      Technical Diagnosis &amp; Scope
                    </span>
                    <div className="p-2.5 rounded bg-surface-container-low text-on-surface font-body-sm text-body-sm leading-relaxed">
                      {selectedTask.description || 'No diagnostic notes provided for this task.'}
                    </div>
                  </div>

                  {/* Section: Blocker Callout (if blocked) */}
                  {selectedTask.status === 'blocked' && (
                    <div className="p-space-sm rounded bg-error-container/20 flex flex-col gap-1 border border-error/20">
                      <div className="flex items-center gap-1.5 text-error font-label-sm text-label-sm font-semibold">
                        <span className="material-symbols-outlined text-[16px]">report_problem</span>
                        <span>Critical Blocker Details</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface leading-normal">
                        Blocked by: <span className="font-code-inline font-medium text-error">AWS TAM escalation #4921</span> awaiting VPC route table patch and transit MTU synchronization.
                      </p>
                    </div>
                  )}

                  {/* Section: Succession & Ownership Transition Badging */}
                  <div className="flex flex-col gap-2">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                      Succession Handover Impact
                    </span>
                    <div className="p-3 rounded bg-surface-container-low flex flex-col gap-2 border border-outline-variant/15">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-[11px] font-medium">
                            ER
                          </div>
                          <div className="flex flex-col">
                            <span className="font-label-sm text-label-sm text-on-surface font-semibold leading-none">Elena Rostova</span>
                            <span className="font-label-sm text-[10px] text-on-surface-variant">Current Lead</span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">arrow_forward</span>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center text-[11px] font-medium">
                            MV
                          </div>
                          <div className="flex flex-col">
                            <span className="font-label-sm text-label-sm text-on-surface font-semibold leading-none">Marcus Vance</span>
                            <span className="font-label-sm text-[10px] text-on-surface-variant">Designated Successor</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-on-surface-variant bg-surface-container-lowest p-2 rounded flex items-center gap-1.5 border border-outline-variant/20">
                        <span className="material-symbols-outlined text-[14px] text-tertiary">verified_user</span>
                        <span>Requires dual cryptographic sign-off before transition freeze.</span>
                      </div>
                    </div>
                  </div>

                  {/* Section: Linked Decisions (ADRs) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                      Linked Architectural Decisions
                    </span>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => navigateTo('decisions')}
                        className="flex items-center justify-between p-2 rounded bg-surface-container-low hover:bg-surface-container transition-colors group text-left w-full"
                        type="button"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-[16px] text-primary">gavel</span>
                          <span className="font-label-md text-label-md text-on-surface font-medium truncate">
                            ADR-042: Adopt Kafka KRaft mode
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant group-hover:text-on-surface transition-transform group-hover:translate-x-0.5">
                          arrow_forward
                        </span>
                      </button>
                      <button
                        onClick={() => navigateTo('decisions')}
                        className="flex items-center justify-between p-2 rounded bg-surface-container-low hover:bg-surface-container transition-colors group text-left w-full"
                        type="button"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-[16px] text-primary">gavel</span>
                          <span className="font-label-md text-label-md text-on-surface font-medium truncate">
                            ADR-041: TLS 1.3 mTLS across VPC boundaries
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant group-hover:text-on-surface transition-transform group-hover:translate-x-0.5">
                          arrow_forward
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Section: Activity History Audit Feed */}
                  <div className="flex flex-col gap-2">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                      Audit Trail
                    </span>
                    <div className="flex flex-col gap-2.5 pl-1 border-l-2 border-outline-variant/30 ml-1">
                      <div className="flex items-start gap-2.5 -ml-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1 shrink-0 ring-2 ring-surface-container-lowest" />
                        <div className="flex flex-col">
                          <span className="font-label-sm text-label-sm text-on-surface">
                            Last updated on {new Date(selectedTask.updated_at).toLocaleDateString()}
                          </span>
                          <span className="font-label-sm text-[10px] text-on-surface-variant">
                            Actor: {selectedTask.assignee || 'Elena Rostova'} • Verified event
                          </span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 -ml-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-outline-variant mt-1 shrink-0 ring-2 ring-surface-container-lowest" />
                        <div className="flex flex-col">
                          <span className="font-label-sm text-label-sm text-on-surface">
                            Created on {new Date(selectedTask.created_at).toLocaleDateString()}
                          </span>
                          <span className="font-label-sm text-[10px] text-on-surface-variant">
                            System intake recorded
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Dock */}
                  <div className="pt-space-sm flex flex-col gap-2 mt-auto border-t border-outline-variant/20">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openEditModal(selectedTask)}
                        className="h-8 px-2 rounded bg-surface-container-high hover:bg-surface-container text-on-surface font-label-md text-label-md font-medium transition-colors flex items-center justify-center gap-1"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[15px]">person_add</span>
                        <span>Reassign</span>
                      </button>
                      <button
                        onClick={() => navigateTo('decisions')}
                        className="h-8 px-2 rounded bg-surface-container-high hover:bg-surface-container text-on-surface font-label-md text-label-md font-medium transition-colors flex items-center justify-center gap-1"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[15px]">add_link</span>
                        <span>Link ADR</span>
                      </button>
                    </div>

                    {selectedTask.status !== 'done' ? (
                      <button
                        onClick={() => handleStatusChange(selectedTask.id, 'done')}
                        className="h-9 px-3 rounded bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-medium shadow-sm transition-colors flex items-center justify-center gap-1.5"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Mark Resolved &amp; Handover</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(selectedTask.id, 'in_progress')}
                        className="h-9 px-3 rounded bg-surface-container-high hover:bg-surface-container text-on-surface font-label-md text-label-md font-medium transition-colors flex items-center justify-center gap-1.5"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">undo</span>
                        <span>Reopen Task</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-on-surface-variant font-body-md text-body-md">
                  Select a task to inspect details
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE TASK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">add_task</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Create New Task</h3>
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
                  placeholder="e.g. Staging VPC peering packet loss under 50k req/s"
                  maxLength={200}
                  className="h-9 px-3 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Description / Diagnostic Note</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details, technical diagnosis, links, or blocker reasons..."
                  rows={3}
                  className="p-2.5 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                    className="h-9 px-2.5 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                    className="h-9 px-2.5 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Assignee</label>
                  <input
                    type="text"
                    value={formData.assignee}
                    onChange={e => setFormData({ ...formData, assignee: e.target.value })}
                    className="h-9 px-3 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
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
                  <span>Create Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TASK MODAL */}
      {showEditModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">edit</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Edit Task</h3>
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
                <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Description / Diagnostic Note</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="p-2.5 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                    className="h-9 px-2.5 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                    className="h-9 px-2.5 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Assignee</label>
                  <input
                    type="text"
                    value={formData.assignee}
                    onChange={e => setFormData({ ...formData, assignee: e.target.value })}
                    className="h-9 px-3 rounded bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
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
