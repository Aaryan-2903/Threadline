import React, { useState } from 'react';
import { useNavigation } from '../../context/useNavigation';
import { useUserProfile } from '../../context/useUserProfile';
import { useAuth } from '../../context/useAuth';
import { AuditTrailModal } from '../common/AuditTrailModal';
import type { UserRole } from '../../types';

export const TopHeader: React.FC = () => {
  const { currentScreen, selectedProjectId, navigate, searchQuery, setSearchQuery } = useNavigation();
  const { profile, initials } = useUserProfile();
  const { user, isAuthenticated, demoLogin, logout, switchRole, isDemo } = useAuth();
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Dynamic breadcrumbs based on active screen
  const getBreadcrumbs = () => {
    switch (currentScreen) {
      case 'overview':
        return [
          { label: 'Platform Eng', onClick: () => navigate('overview') },
          { label: 'Handover Stream', active: true },
        ];
      case 'my-projects':
        return [
          { label: 'Workspaces', onClick: () => navigate('overview') },
          { label: 'My Projects', active: true },
        ];
      case 'project-workspace':
        return [
          { label: 'Projects', onClick: () => navigate('my-projects') },
          { label: selectedProjectId || 'Project Workspace', active: true },
        ];
      case 'my-tasks':
        return [
          { label: 'Workspace', onClick: () => navigate('overview') },
          { label: 'My Tasks', active: true },
        ];
      case 'decisions':
        return [
          { label: 'Workspace', onClick: () => navigate('overview') },
          { label: 'Decisions Register', active: true },
        ];
      case 'conflicts':
        return [
          { label: 'Integrity Engine', onClick: () => navigate('overview') },
          { label: 'Conflict Detection & Resolution', active: true },
        ];
      case 'activity':
        return [
          { label: 'Workspace', onClick: () => navigate('overview') },
          { label: 'Activity Timeline', active: true },
        ];
      case 'documents':
        return [
          { label: 'Workspace', onClick: () => navigate('overview') },
          { label: 'Documents Hub', active: true },
        ];
      case 'handover-reports':
        return [
          { label: 'Workspace', onClick: () => navigate('overview') },
          { label: 'Handover Reports', active: true },
        ];
      case 'ai-review-queue':
        return [
          { label: 'Knowledge Engine', onClick: () => navigate('overview') },
          { label: 'AI Review Queue', active: true },
        ];
      case 'continuity-map':
        return [
          { label: 'Knowledge Engine', onClick: () => navigate('overview') },
          { label: 'Continuity Map', active: true },
        ];
      default:
        return [
          { label: 'Threadline', onClick: () => navigate('overview') },
          { label: currentScreen, active: true },
        ];
    }
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <>
      <header className="fixed top-0 left-60 right-0 h-14 bg-surface-container-lowest/90 backdrop-blur-md z-30 flex items-center justify-between px-space-lg shadow-[0_1px_0_0_#ebedf9]">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-space-sm min-w-0 text-on-surface-variant font-label-md text-label-md">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <span className="material-symbols-outlined text-[14px] text-outline">
                  chevron_right
                </span>
              )}
              <span
                onClick={crumb.onClick}
                className={`truncate ${
                  crumb.active
                    ? 'font-medium text-on-surface'
                    : 'hover:text-on-surface cursor-pointer text-on-surface-variant'
                }`}
              >
                {crumb.label}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-space-md">
          {/* Judge Demo Login or Role Indicator */}
          {!isAuthenticated ? (
            <button
              onClick={demoLogin}
              className="flex items-center gap-1.5 bg-linear-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white h-8 px-3 rounded-lg font-bold text-xs shadow-sm transition-all cursor-pointer animate-pulse"
              title="One-click login with preloaded conflicts, sensitive data redaction, and handover lifecycle"
            >
              <span className="material-symbols-outlined text-[16px]">stars</span>
              <span>Judge Demo Access</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {/* Role Switcher Pill for Judge Testing */}
              <div className="flex items-center gap-1 bg-surface-container-low px-2.5 py-1 rounded-lg border border-outline-variant/30 text-[11px]">
                <span className="font-semibold text-gray-500">Role:</span>
                <select
                  value={user?.role || 'project_owner'}
                  onChange={(e) => switchRole(e.target.value as UserRole)}
                  className="bg-transparent font-bold text-indigo-700 cursor-pointer focus:outline-hidden uppercase"
                >
                  <option value="project_owner">Project Owner</option>
                  <option value="admin">Admin</option>
                  <option value="contributor">Contributor</option>
                  <option value="viewer">Viewer (Read-Only)</option>
                </select>
              </div>

              {isDemo && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Demo Session
                </span>
              )}

              {/* Audit Log Trigger */}
              <button
                onClick={() => setShowAuditModal(true)}
                className="p-1.5 text-on-surface-variant hover:text-indigo-600 hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer"
                title="Security & Governance Audit Trail"
              >
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
              </button>
            </div>
          )}

          {/* Sync Indicator */}
          <div className="hidden sm:flex items-center gap-space-xs px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant font-label-sm text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Sync: All verified</span>
          </div>

          {/* Global Search Bar */}
          <div className="relative hidden md:flex items-center">
            <div className="flex items-center gap-space-md bg-surface-container-low hover:bg-surface-container text-outline hover:text-on-surface px-space-md h-8 rounded text-left transition-colors">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[15px]">search</span>
                <input
                  type="text"
                  placeholder="Search decisions, tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none font-body-sm text-body-sm text-on-surface placeholder:text-outline w-36"
                />
              </div>
              <kbd className="font-code-inline text-[10px] px-1 py-0.5 rounded bg-surface-container-lowest text-outline shadow-[0_0_0_1px_#ebedf9]">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* + New Button */}
          <button
            onClick={() => navigate('my-projects')}
            className="flex items-center gap-1 bg-primary hover:bg-primary-container text-on-primary h-8 px-space-md rounded font-label-md text-label-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors cursor-pointer select-none"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New</span>
          </button>

          {/* Avatar / Profile Trigger */}
          <div
            onClick={() => (isAuthenticated ? logout() : navigate('settings'))}
            className="w-7 h-7 rounded-full bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center font-bold text-[10px] shrink-0 ml-1 cursor-pointer transition-colors shadow-xs"
            title={isAuthenticated ? `Signed in as ${user?.username} (Click to Logout)` : `Profile settings (${profile.displayName || 'User'})`}
          >
            {user ? user.username.slice(0, 2).toUpperCase() : initials}
          </div>
        </div>
      </header>

      {/* Global Audit Trail Modal */}
      <AuditTrailModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        projectId={selectedProjectId || undefined}
      />
    </>
  );
};
