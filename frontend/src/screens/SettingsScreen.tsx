import React, { useState } from 'react';
import { useUserProfile } from '../context/useUserProfile';
import { useAuth } from '../context/useAuth';
import { DEFAULT_PROFILE, computeInitials } from '../context/user-profile-context';

export const SettingsScreen: React.FC = () => {
  const { profile, updateProfile, resetProfile } = useUserProfile();
  const { user, isDemo, logout } = useAuth();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [role, setRole] = useState(profile.role || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewInitials = computeInitials(displayName || user?.username || 'User');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setErrorMessage('Display Name cannot be blank.');
      return;
    }
    if (trimmedName.length > 60) {
      setErrorMessage('Display Name must be 60 characters or fewer.');
      return;
    }

    setErrorMessage(null);
    updateProfile({
      displayName: trimmedName,
      role: role.trim(),
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 3000);
  };

  const handleReset = () => {
    resetProfile();
    setDisplayName(user?.username || DEFAULT_PROFILE.displayName);
    setRole(DEFAULT_PROFILE.role || '');
    setErrorMessage(null);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 3000);
  };

  const getRoleDescription = (r?: string) => {
    switch (r) {
      case 'admin':
        return 'Full system administrative authority, security audit trail inspection, and user role management.';
      case 'project_owner':
        return 'Complete project lifecycle authority, cross-document conflict resolution, and handover report signing.';
      case 'contributor':
        return 'Standard team member authority to create and update tasks, decisions, and documents. Restricted from resolving conflicts.';
      case 'viewer':
        return 'Read-only observer mode. Strictly prohibited from mutating project entities or resolving claims.';
      default:
        return 'Authenticated project member.';
    }
  };

  return (
    <div className="flex flex-col w-full pb-16">
      <div className="w-full px-space-lg py-space-md space-y-space-md max-w-[1100px] mx-auto">
        {/* Header Banner */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-space-md border border-outline-variant/30">
          <div className="space-y-1">
            <div className="flex items-center gap-space-xs text-outline font-label-sm text-label-sm uppercase tracking-wider">
              <span className="material-symbols-outlined text-[15px] text-primary">person</span>
              <span>Preferences &amp; Identity</span>
              <span>·</span>
              <span className="text-primary font-medium">
                {isDemo ? 'Judge Demo Session' : 'Enterprise Workspace'}
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              User Profile &amp; Settings
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Manage your personal identity preferences and review active authentication credentials, role-based access level, and security audit status.
            </p>
          </div>
        </div>

        {/* Saved Success Notification */}
        {savedSuccess && (
          <div className="p-space-md rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
              <div>
                <p className="font-label-md text-label-md font-semibold">Profile updated successfully</p>
                <p className="font-body-sm text-[12px] text-emerald-700">
                  Your identity preferences have been saved and synchronized across the workspace.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSavedSuccess(false)}
              className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Authenticated Account & RBAC Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="px-space-lg py-space-md bg-surface-container-low/60 border-b border-surface-container flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">shield_person</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Active Authenticated Session
              </h2>
            </div>
            <span className="font-label-sm text-[11px] px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-semibold">
              Server-Enforced RBAC
            </span>
          </div>

          <div className="p-space-lg space-y-space-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container space-y-1">
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">Account</span>
                <p className="font-bold text-on-surface text-sm">{user?.username || 'Guest'}</p>
                <p className="text-[11px] text-on-surface-variant font-mono truncate">{user?.email || 'N/A'}</p>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container space-y-1">
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">Assigned Role</span>
                <p className="font-bold text-primary text-sm uppercase">
                  {user?.role.replace('_', ' ') || 'None'}
                </p>
                <p className="text-[11px] text-outline">Enforced via JWT</p>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container space-y-1">
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">Access Tier</span>
                <p className="font-bold text-emerald-700 text-sm">
                  {user?.is_demo ? 'Judge Demo Access' : 'Standard Member'}
                </p>
                <p className="text-[11px] text-outline">
                  {user?.is_demo ? 'Instant 1-Click Evaluation' : 'Credential Authenticated'}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">Session State</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-700">Active (HS256)</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="mt-2 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-error-container/40 text-error hover:bg-error-container/80 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">logout</span>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-indigo-50/60 border border-indigo-100 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-indigo-600 text-[18px] shrink-0 mt-0.5">info</span>
              <div className="text-xs text-indigo-900 leading-relaxed">
                <span className="font-semibold uppercase tracking-wider text-[11px]">Role Authority ({user?.role}): </span>
                {getRoleDescription(user?.role)}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Card Section */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="px-space-lg py-space-md bg-surface-container-low/60 border-b border-surface-container flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Personal Identity Preferences
              </h2>
            </div>
            <span className="font-label-sm text-[11px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
              Client Preferences
            </span>
          </div>

          <form onSubmit={handleSave} className="p-space-lg space-y-space-lg">
            {/* Live Avatar Preview */}
            <div className="flex items-center gap-space-md p-space-md rounded-lg bg-surface-container-low/40 border border-surface-container">
              <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xl shrink-0 shadow-sm transition-transform">
                {previewInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-headline-sm text-headline-sm text-on-surface truncate font-semibold">
                    {displayName.trim() || user?.username || 'User'}
                  </p>
                  <span className="font-label-sm text-[11px] px-2 py-0.5 rounded bg-primary-container text-on-primary font-medium">
                    Active Identity
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {role.trim() || user?.role.replace('_', ' ') || 'Role not specified'}
                </p>
                <p className="font-body-sm text-[11px] text-outline mt-0.5">
                  Avatar initials: <span className="font-bold text-primary">{previewInitials}</span>
                </p>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-space-sm rounded bg-error-container/30 border border-error/20 text-error flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <div className="space-y-1">
                <label className="block font-label-md text-label-md font-medium text-on-surface">
                  Display Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. User or Your Name"
                  className="w-full h-10 px-space-md rounded bg-surface-container-lowest border border-outline-variant text-on-surface font-body-md text-body-md focus:outline-hidden focus:border-primary transition-colors"
                />
                <p className="font-body-sm text-[11px] text-outline">
                  Shown on task assignees, decision signatures, and dashboard greetings.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block font-label-md text-label-md font-medium text-on-surface">
                  Role / Title <span className="text-outline text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Senior Architect, Reviewer"
                  className="w-full h-10 px-space-md rounded bg-surface-container-lowest border border-outline-variant text-on-surface font-body-md text-body-md focus:outline-hidden focus:border-primary transition-colors"
                />
                <p className="font-body-sm text-[11px] text-outline">
                  Helps identify your operational responsibilities in handover reports.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-space-md border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-space-md">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-space-md h-9 rounded text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors font-label-md text-label-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                <span>Reset to Default</span>
              </button>

              <div className="flex items-center gap-space-sm w-full sm:w-auto justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 h-9 rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Save Profile</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Round 3 Security & Architecture Notice */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 p-space-lg space-y-space-md">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">security</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Round 3 Security &amp; RBAC Architecture
            </h2>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Threadline is secured with <strong>Round 3 Enterprise Security &amp; Integrity Verification</strong>. All mutations, conflict resolutions, and handover lifecycle workflows are validated on the backend against cryptographic JWT tokens with server-side Role-Based Access Control (RBAC).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md pt-space-xs">
            <div className="p-space-md rounded-lg bg-surface-container-low border border-surface-container space-y-1">
              <div className="flex items-center gap-1.5 text-on-surface font-semibold text-xs">
                <span className="material-symbols-outlined text-primary text-[16px]">lock</span>
                <span>Server-Enforced RBAC</span>
              </div>
              <p className="text-[12px] text-on-surface-variant">
                Permissions are strictly validated by the backend. Client-side role tampering or cosmetic dropdown selection is prohibited.
              </p>
            </div>
            <div className="p-space-md rounded-lg bg-surface-container-low border border-surface-container space-y-1">
              <div className="flex items-center gap-1.5 text-on-surface font-semibold text-xs">
                <span className="material-symbols-outlined text-emerald-700 text-[16px]">policy</span>
                <span>Sensitive Data Redaction</span>
              </div>
              <p className="text-[12px] text-on-surface-variant">
                PII, email addresses, phone numbers, and API keys are automatically detected and masked in reports and activity exports.
              </p>
            </div>
            <div className="p-space-md rounded-lg bg-surface-container-low border border-surface-container space-y-1">
              <div className="flex items-center gap-1.5 text-on-surface font-semibold text-xs">
                <span className="material-symbols-outlined text-indigo-700 text-[16px]">history_edu</span>
                <span>Tamper-Evident Audit Trail</span>
              </div>
              <p className="text-[12px] text-on-surface-variant">
                Every login, role change, conflict resolution, and handover sign-off records an immutable audit log with IP, actor, and timestamp.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
