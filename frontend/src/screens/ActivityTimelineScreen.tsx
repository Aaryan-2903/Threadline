import React, { useState, useEffect, useMemo } from 'react';
import type { Activity, Project } from '../types';
import { api } from '../api/client';
import { useNavigation } from '../context/useNavigation';

type EventTypeFilter = 'all' | 'decisions' | 'tasks' | 'ai' | 'handover';

export const ActivityTimelineScreen: React.FC = () => {
  const { navigateTo } = useNavigation();
  const [currentTimestamp] = useState(() => Date.now());

  // State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState<EventTypeFilter>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Load activities and projects
  useEffect(() => {
    let isMounted = true;
    const fetchActivities = async () => {
      try {
        setLoading(true);
        setError(null);
        const [fetchedProjects, fetchedActivities] = await Promise.all([
          api.getProjects(),
          api.getActivities({ order: sortOrder, limit: 100 }),
        ]);

        if (!isMounted) return;
        setProjects(fetchedProjects || []);

        if (fetchedActivities && fetchedActivities.length > 0) {
          setActivities(fetchedActivities);
          setSelectedActivityId(prev => prev || fetchedActivities[0].id);
        } else {
          setActivities([]);
          setSelectedActivityId(null);
        }
      } catch (err) {
        console.error('Failed to load activities:', err);
        if (isMounted) {
          setError('Unable to load project activities timeline.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchActivities();
    return () => {
      isMounted = false;
    };
  }, [sortOrder, currentTimestamp]);

  // Project map
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      // Type filter
      if (activeFilter === 'decisions') {
        if (!act.event_type.includes('decision')) return false;
      } else if (activeFilter === 'tasks') {
        if (!act.event_type.includes('task')) return false;
      } else if (activeFilter === 'ai') {
        if (!act.event_type.includes('ai')) return false;
      } else if (activeFilter === 'handover') {
        if (!act.event_type.includes('handover') && !act.description.toLowerCase().includes('handover')) return false;
      }

      // Project filter
      if (selectedProjectId !== 'all' && act.project_id !== selectedProjectId) return false;

      // Actor search
      if (actorFilter.trim()) {
        const query = actorFilter.toLowerCase();
        const matchActor = act.actor?.toLowerCase().includes(query);
        const matchDesc = act.description.toLowerCase().includes(query);
        if (!matchActor && !matchDesc) return false;
      }

      return true;
    });
  }, [activities, activeFilter, selectedProjectId, actorFilter]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const today: Activity[] = [];
    const yesterday: Activity[] = [];
    const older: Activity[] = [];

    const now = new Date(currentTimestamp);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;

    filteredActivities.forEach(act => {
      const actTime = new Date(act.timestamp).getTime();
      if (actTime >= startOfToday) {
        today.push(act);
      } else if (actTime >= startOfYesterday) {
        yesterday.push(act);
      } else {
        older.push(act);
      }
    });

    return { today, yesterday, older };
  }, [filteredActivities, currentTimestamp]);

  // Selected Activity
  const selectedActivity = useMemo(() => {
    return activities.find(a => a.id === selectedActivityId) || filteredActivities[0] || null;
  }, [activities, selectedActivityId, filteredActivities]);

  // Helper for badge style
  const getEventBadge = (eventType: string, description: string) => {
    if (eventType.includes('decision')) {
      return {
        label: 'Decision Ratified',
        bgColor: 'bg-primary-fixed',
        textColor: 'text-on-primary-fixed',
        dotColor: 'bg-primary',
      };
    }
    if (description.toLowerCase().includes('blocked')) {
      return {
        label: 'Blocker Flagged',
        bgColor: 'bg-error-container',
        textColor: 'text-on-error-container',
        dotColor: 'bg-error',
      };
    }
    if (eventType.includes('ai')) {
      return {
        label: 'AI Continuity Ingestion',
        bgColor: 'bg-secondary-container',
        textColor: 'text-on-secondary-fixed',
        dotColor: 'bg-tertiary',
      };
    }
    if (eventType.includes('handover') || description.toLowerCase().includes('handover')) {
      return {
        label: 'Handover Milestone',
        bgColor: 'bg-tertiary-fixed',
        textColor: 'text-on-tertiary-fixed-variant',
        dotColor: 'bg-tertiary-container',
      };
    }
    if (eventType.includes('task') && description.toLowerCase().includes('completed')) {
      return {
        label: 'Task Completed',
        bgColor: 'bg-secondary-container',
        textColor: 'text-on-secondary-container',
        dotColor: 'bg-secondary',
      };
    }
    if (eventType.includes('document')) {
      return {
        label: 'Document Ingested',
        bgColor: 'bg-surface-container',
        textColor: 'text-on-surface-variant',
        dotColor: 'bg-tertiary-container',
      };
    }
    return {
      label: 'Task Update',
      bgColor: 'bg-surface-container-high',
      textColor: 'text-on-surface',
      dotColor: 'bg-primary-container',
    };
  };

  const formatRelativeTime = (isoString: string) => {
    const diff = currentTimestamp - new Date(isoString).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Command & Action Bar */}
      <div className="w-full bg-surface-container-lowest px-space-xl py-space-lg shadow-sm border-b border-outline-variant/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-col">
            <div className="flex items-center gap-space-sm">
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Activity Timeline</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container-low font-code-inline text-[11px] text-on-surface-variant border border-outline-variant/30">
                LIVE STREAM
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Chronological project pulse, decision ratifications, document ingestions, and succession milestones.
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <button
              onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
              className="h-8 px-3 rounded bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-md text-label-md inline-flex items-center gap-1.5 shadow-sm transition-colors border border-outline-variant/30"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">tune</span>
              <span>Sort: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>
            <button
              onClick={() => {
                const csvData =
                  'data:text/csv;charset=utf-8,' +
                  ['Timestamp,Event,Actor,Description']
                    .concat(activities.map(a => `"${a.timestamp}","${a.event_type}","${a.actor || ''}","${a.description.replace(/"/g, '""')}"`))
                    .join('\n');
                const link = document.createElement('a');
                link.href = encodeURI(csvData);
                link.download = 'threadline-activity-audit-log.csv';
                link.click();
              }}
              className="h-8 px-3 rounded bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-md text-label-md inline-flex items-center gap-1.5 shadow-sm transition-colors border border-outline-variant/30"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">file_download</span>
              <span>Export Audit Log</span>
            </button>
          </div>
        </div>

        {/* Filter Control Hub */}
        <div className="mt-space-lg pt-space-md flex flex-wrap items-center justify-between gap-space-md border-t border-outline-variant/15">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveFilter('all')}
              className={`h-7 px-2.5 rounded font-label-sm text-label-sm font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              All Events <span className="ml-1 opacity-80">{activities.length}</span>
            </button>
            <button
              onClick={() => setActiveFilter('decisions')}
              className={`h-7 px-2.5 rounded font-label-sm text-label-sm font-medium transition-colors ${
                activeFilter === 'decisions'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Decisions{' '}
              <span className="ml-1 opacity-70">
                {activities.filter(a => a.event_type.includes('decision')).length}
              </span>
            </button>
            <button
              onClick={() => setActiveFilter('tasks')}
              className={`h-7 px-2.5 rounded font-label-sm text-label-sm font-medium transition-colors ${
                activeFilter === 'tasks'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Task Updates{' '}
              <span className="ml-1 opacity-70">
                {activities.filter(a => a.event_type.includes('task')).length}
              </span>
            </button>
            <button
              onClick={() => setActiveFilter('ai')}
              className={`h-7 px-2.5 rounded font-label-sm text-label-sm font-medium transition-colors ${
                activeFilter === 'ai'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              AI Extractions{' '}
              <span className="ml-1 opacity-70">
                {activities.filter(a => a.event_type.includes('ai')).length}
              </span>
            </button>
            <button
              onClick={() => setActiveFilter('handover')}
              className={`h-7 px-2.5 rounded font-label-sm text-label-sm font-medium transition-colors ${
                activeFilter === 'handover'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Handover Milestones{' '}
              <span className="ml-1 opacity-70">
                {activities.filter(a => a.description.toLowerCase().includes('handover')).length}
              </span>
            </button>
          </div>

          {/* Scoped Selectors */}
          <div className="flex flex-wrap items-center gap-space-sm">
            {/* Project Selector */}
            <select
              aria-label="Filter activities by project"
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="h-8 px-2.5 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-label-sm border border-outline-variant/30 cursor-pointer focus:outline-none"
            >
              <option value="all">Project: All ({projects.length})</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Actor Filter */}
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-2 text-[15px] text-on-surface-variant pointer-events-none">
                search
              </span>
              <input
                value={actorFilter}
                onChange={e => setActorFilter(e.target.value)}
                className="h-8 w-44 pl-7 pr-2 rounded bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30 transition-all"
                placeholder="Filter by actor..."
                type="text"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <span className="material-symbols-outlined text-[36px] text-primary animate-spin">refresh</span>
          <span className="font-body-md text-body-md text-on-surface-variant font-medium">Loading live activity stream...</span>
        </div>
      )}

      {error && (
        <div className="m-space-xl p-space-md rounded-lg bg-error-container/20 border border-error/30 text-error flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="px-3 py-1 bg-error text-on-error rounded font-label-sm text-label-sm">
            Retry
          </button>
        </div>
      )}

      {/* Main Workstation Layout (Stream + Sticky Inspector) */}
      {!loading && (
        <div className="w-full px-space-xl py-space-xl flex flex-col xl:flex-row gap-space-xl items-start">
          {/* Left Column: Chronological Audit Trail Stream */}
          <div className="flex-1 w-full flex flex-col gap-space-xl min-w-0">
            {/* GROUP 1: TODAY */}
            {groupedActivities.today.length > 0 && (
              <div className="flex flex-col gap-space-md">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary-container" />
                    <span className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wider text-[11px] font-semibold">
                      Today — {new Date(currentTimestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {groupedActivities.today.length} events logged
                  </span>
                </div>
                <div className="flex flex-col gap-space-sm relative">
                  <div className="absolute left-4 top-4 bottom-4 w-px bg-surface-container-high pointer-events-none" />
                  {groupedActivities.today.map(act => (
                    <ActivityCard
                      key={act.id}
                      activity={act}
                      isSelected={selectedActivity?.id === act.id}
                      badge={getEventBadge(act.event_type, act.description)}
                      projectName={projectMap.get(act.project_id)?.name || 'Project'}
                      onSelect={() => setSelectedActivityId(act.id)}
                      relativeTime={formatRelativeTime(act.timestamp)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* GROUP 2: YESTERDAY */}
            {groupedActivities.yesterday.length > 0 && (
              <div className="flex flex-col gap-space-md">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary" />
                    <span className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wider text-[11px] font-semibold">
                      Yesterday
                    </span>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {groupedActivities.yesterday.length} events logged
                  </span>
                </div>
                <div className="flex flex-col gap-space-sm relative">
                  <div className="absolute left-4 top-4 bottom-4 w-px bg-surface-container-high pointer-events-none" />
                  {groupedActivities.yesterday.map(act => (
                    <ActivityCard
                      key={act.id}
                      activity={act}
                      isSelected={selectedActivity?.id === act.id}
                      badge={getEventBadge(act.event_type, act.description)}
                      projectName={projectMap.get(act.project_id)?.name || 'Project'}
                      onSelect={() => setSelectedActivityId(act.id)}
                      relativeTime={formatRelativeTime(act.timestamp)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* GROUP 3: OLDER */}
            {groupedActivities.older.length > 0 && (
              <div className="flex flex-col gap-space-md">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-outline" />
                    <span className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wider text-[11px] font-semibold">
                      Previous Days
                    </span>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {groupedActivities.older.length} events logged
                  </span>
                </div>
                <div className="flex flex-col gap-space-sm relative">
                  <div className="absolute left-4 top-4 bottom-4 w-px bg-surface-container-high pointer-events-none" />
                  {groupedActivities.older.map(act => (
                    <ActivityCard
                      key={act.id}
                      activity={act}
                      isSelected={selectedActivity?.id === act.id}
                      badge={getEventBadge(act.event_type, act.description)}
                      projectName={projectMap.get(act.project_id)?.name || 'Project'}
                      onSelect={() => setSelectedActivityId(act.id)}
                      relativeTime={formatRelativeTime(act.timestamp)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredActivities.length === 0 && (
              <div className="py-20 text-center text-on-surface-variant bg-surface-container-lowest rounded-lg border border-outline-variant/20 shadow-sm p-8">
                <span className="material-symbols-outlined text-[36px] text-outline">event_busy</span>
                <p className="font-headline-sm text-headline-sm mt-2 font-medium">No activity records found</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  Try adjusting your filter selection or create a new task/decision to see automatic timeline logs.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Detail Inspection Panel */}
          <div className="w-full xl:w-96 shrink-0 xl:sticky xl:top-20 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest rounded-lg p-space-lg shadow-sm flex flex-col gap-space-md border border-outline-variant/20">
              {selectedActivity ? (
                <>
                  {/* Inspector Header */}
                  <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant/20">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">manage_search</span>
                      <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                        Event Inspector
                      </span>
                    </div>
                    <span className="font-code-inline text-[11px] text-on-surface-variant">
                      ID: {selectedActivity.id.slice(0, 8)}
                    </span>
                  </div>

                  {/* Badge & Title */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded font-label-sm text-[11px] font-semibold ${
                          getEventBadge(selectedActivity.event_type, selectedActivity.description).bgColor
                        } ${getEventBadge(selectedActivity.event_type, selectedActivity.description).textColor}`}
                      >
                        {getEventBadge(selectedActivity.event_type, selectedActivity.description).label}
                      </span>
                      <span className="font-code-inline text-[11px] text-on-surface-variant font-medium">
                        {projectMap.get(selectedActivity.project_id)?.name || 'Project'}
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-snug">
                      {selectedActivity.description}
                    </h3>
                  </div>

                  {/* Metadata Grid */}
                  <div className="p-3 rounded bg-surface-container-low/60 flex flex-col gap-2.5 font-body-sm text-body-sm border border-outline-variant/20">
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant font-label-sm">Timestamp:</span>
                      <span className="font-code-inline text-[11px] text-on-surface">
                        {new Date(selectedActivity.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant font-label-sm">Actor:</span>
                      <span className="font-medium text-on-surface">{selectedActivity.actor || 'System'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant font-label-sm">Entity Type:</span>
                      <span className="font-code-inline text-[11px] uppercase text-primary">
                        {selectedActivity.entity_type || 'Record'}
                      </span>
                    </div>
                  </div>

                  {/* Quick Link Navigation */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/20">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                      Navigate to Entity
                    </span>
                    {selectedActivity.event_type.includes('decision') && (
                      <button
                        onClick={() => navigateTo('decisions')}
                        className="h-8 px-3 rounded bg-surface-container-low hover:bg-surface-container text-primary font-label-md text-label-md font-medium transition-colors flex items-center justify-between w-full"
                        type="button"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">gavel</span>
                          <span>Open Decisions Register</span>
                        </span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    )}
                    {selectedActivity.event_type.includes('task') && (
                      <button
                        onClick={() => navigateTo('my-tasks')}
                        className="h-8 px-3 rounded bg-surface-container-low hover:bg-surface-container text-primary font-label-md text-label-md font-medium transition-colors flex items-center justify-between w-full"
                        type="button"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          <span>Open Task in My Tasks</span>
                        </span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    )}
                    <button
                      onClick={() => navigateTo('project-workspace')}
                      className="h-8 px-3 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md font-medium transition-colors flex items-center justify-between w-full"
                      type="button"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">folder_open</span>
                        <span>Project Workspace</span>
                      </span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-on-surface-variant font-body-sm text-body-sm">
                  Select an event to inspect audit details
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ActivityCardProps {
  activity: Activity;
  isSelected: boolean;
  badge: {
    label: string;
    bgColor: string;
    textColor: string;
    dotColor: string;
  };
  projectName: string;
  onSelect: () => void;
  relativeTime: string;
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  isSelected,
  badge,
  projectName,
  onSelect,
  relativeTime,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer relative rounded-lg p-space-md shadow-sm transition-all hover:shadow-md pl-11 border ${
        isSelected
          ? 'bg-surface-container-lowest border-primary ring-1 ring-primary'
          : 'bg-surface-container-lowest hover:bg-surface-container-lowest/90 border-outline-variant/20'
      }`}
    >
      {/* Node Dot */}
      <div className={`absolute left-2.5 top-4 w-3.5 h-3.5 rounded-full ${badge.dotColor} flex items-center justify-center ring-4 ring-surface-container-lowest`}>
        <span className="w-1.5 h-1.5 rounded-full bg-surface-container-lowest" />
      </div>

      <div className="flex flex-col gap-space-xs">
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-between gap-space-xs">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className={`px-1.5 py-0.5 rounded font-label-sm text-[11px] font-semibold tracking-wide uppercase ${badge.bgColor} ${badge.textColor}`}>
              {badge.label}
            </span>
            <span className="font-code-inline text-[11px] text-on-surface-variant font-medium">
              {activity.entity_type?.toUpperCase() || 'EVENT'}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
              {projectName}
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">
            {relativeTime}
          </span>
        </div>

        {/* Headline */}
        <div className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-snug">
          {activity.description}
        </div>

        {/* Collapsible Git Diff Snippet Container if decision metadata contains diff */}
        {Boolean(activity.metadata?.diff) && (
          <div className="mt-2 rounded bg-surface-container-low p-space-sm flex flex-col gap-1.5 border border-outline-variant/20">
            <div className="font-code-inline text-[11px] text-on-surface-variant bg-surface-container-lowest p-2 rounded leading-relaxed overflow-x-auto border border-outline-variant/20 whitespace-pre-wrap">
              {String(activity.metadata?.diff)}
            </div>
          </div>
        )}

        {/* Bottom Actor Footer */}
        <div className="mt-1 flex items-center justify-between pt-1 border-t border-outline-variant/10">
          <div className="flex items-center gap-space-sm">
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="font-label-sm text-[10px] text-on-primary font-bold">
                {activity.actor?.slice(0, 2).toUpperCase() || 'SY'}
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {activity.actor || 'System'}
            </span>
          </div>
          {isSelected && (
            <div className="flex items-center gap-1 text-primary font-label-sm text-label-sm font-medium">
              <span>Inspecting</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
