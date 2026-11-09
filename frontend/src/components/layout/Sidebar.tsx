import React from 'react';
import { useNavigation } from '../../context/useNavigation';
import type { ScreenId } from '../../types';

export const Sidebar: React.FC = () => {
  const { currentScreen, navigate, workspaceName } = useNavigation();

  const navItemClass = (screen: ScreenId) => {
    const isActive = currentScreen === screen;
    return `group flex items-center gap-space-sm px-space-sm py-1.5 rounded font-label-md text-label-md transition-colors cursor-pointer select-none ${
      isActive
        ? 'bg-surface-container text-primary font-medium'
        : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
    }`;
  };

  const navIconClass = (screen: ScreenId) => {
    const isActive = currentScreen === screen;
    return `material-symbols-outlined text-[18px] transition-colors ${
      isActive ? 'text-primary' : 'text-outline group-hover:text-on-surface'
    }`;
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-surface-container-lowest z-40 flex flex-col justify-between select-none shadow-[1px_0_0_0_#ebedf9]">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="h-14 px-space-md flex items-center justify-between shadow-[0_1px_0_0_#ebedf9]">
          <div
            className="flex items-center gap-space-sm min-w-0 cursor-pointer"
            onClick={() => navigate('overview')}
          >
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
              TL
            </div>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight truncate">
              Threadline
            </span>
          </div>
          <button
            className="p-space-xs rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer"
            type="button"
            title="Toggle Sidebar"
          >
            <span className="material-symbols-outlined text-[16px]">unfold_more</span>
          </button>
        </div>

        {/* Workspace Switcher */}
        <div className="px-space-md py-space-sm shadow-[0_1px_0_0_#ebedf9]">
          <div className="flex items-center justify-between text-on-surface-variant hover:text-on-surface px-space-xs py-1 rounded cursor-pointer transition-colors">
            <div className="flex items-center gap-space-xs min-w-0">
              <span className="material-symbols-outlined text-[15px]">corporate_fare</span>
              <span className="font-label-sm text-label-sm truncate font-medium text-on-surface">
                {workspaceName}
              </span>
            </div>
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </div>
        </div>

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto px-space-sm py-space-md space-y-space-lg">
          {/* WORKSPACE */}
          <div className="space-y-0.5">
            <div className="px-space-sm pb-1 font-label-sm text-label-sm text-outline uppercase tracking-wider text-[10px]">
              Workspace
            </div>
            <nav className="space-y-0.5">
              <div
                className={navItemClass('overview')}
                onClick={() => navigate('overview')}
              >
                <span className={navIconClass('overview')}>grid_view</span>
                <span className="truncate">Overview</span>
              </div>

              <div
                className={navItemClass('my-projects')}
                onClick={() => navigate('my-projects')}
              >
                <span className={navIconClass('my-projects')}>folder_open</span>
                <span className="truncate">My Projects</span>
              </div>

              <div
                className={navItemClass('my-tasks')}
                onClick={() => navigate('my-tasks')}
              >
                <span className={navIconClass('my-tasks')}>check_circle</span>
                <span className="truncate">My Tasks</span>
              </div>

              <div
                className={navItemClass('decisions')}
                onClick={() => navigate('decisions')}
              >
                <span className={navIconClass('decisions')}>gavel</span>
                <span className="truncate">Decisions</span>
              </div>

              <div
                className={navItemClass('documents')}
                onClick={() => navigate('documents')}
              >
                <span className={navIconClass('documents')}>description</span>
                <span className="truncate">Documents</span>
              </div>

              <div
                className={navItemClass('handover-reports')}
                onClick={() => navigate('handover-reports')}
              >
                <span className={navIconClass('handover-reports')}>assignment_turned_in</span>
                <span className="truncate">Handover Reports</span>
              </div>
            </nav>
          </div>

          {/* KNOWLEDGE ENGINE */}
          <div className="space-y-0.5">
            <div className="px-space-sm pb-1 font-label-sm text-label-sm text-outline uppercase tracking-wider text-[10px]">
              Knowledge Engine
            </div>
            <nav className="space-y-0.5">
              <div
                className={`group flex items-center justify-between px-space-sm py-1.5 rounded font-label-md text-label-md transition-colors cursor-pointer select-none ${
                  currentScreen === 'ai-review-queue'
                    ? 'bg-surface-container text-primary font-medium'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
                onClick={() => navigate('ai-review-queue')}
              >
                <div className="flex items-center gap-space-sm min-w-0">
                  <span className={navIconClass('ai-review-queue')}>psychology</span>
                  <span className="truncate">AI Review Queue</span>
                </div>
                <span className="font-label-sm text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface font-semibold">
                  4
                </span>
              </div>

              <div
                className={navItemClass('continuity-map')}
                onClick={() => navigate('continuity-map')}
              >
                <span className={navIconClass('continuity-map')}>hub</span>
                <span className="truncate">Continuity Map</span>
              </div>
            </nav>
          </div>
        </div>
      </div>

      {/* Footer Navigation & User Profile */}
      <div className="p-space-sm shadow-[0_-1px_0_0_#ebedf9] space-y-space-xs">
        <nav className="space-y-0.5">
          <div
            className={navItemClass('settings')}
            onClick={() => navigate('settings')}
          >
            <span className={navIconClass('settings')}>settings</span>
            <span className="truncate">Settings</span>
          </div>
          <div
            className={navItemClass('help-docs')}
            onClick={() => navigate('help-docs')}
          >
            <span className={navIconClass('help-docs')}>help_outline</span>
            <span className="truncate">Help & Docs</span>
          </div>
        </nav>

        {/* User Card */}
        <div className="flex items-center gap-space-sm p-space-xs pt-space-sm rounded hover:bg-surface-container-low cursor-pointer transition-colors">
          <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-[10px] shrink-0">
            ER
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-label-md text-label-md text-on-surface font-medium truncate">
              Elena Rostova
            </p>
            <p className="font-label-sm text-label-sm text-outline truncate text-[11px]">
              Staff PM / Lead
            </p>
          </div>
          <span className="material-symbols-outlined text-[16px] text-outline">more_vert</span>
        </div>
      </div>
    </aside>
  );
};

