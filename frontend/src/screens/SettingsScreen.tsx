import React, { useState } from 'react';
import { useUserProfile } from '../context/useUserProfile';
import { DEFAULT_PROFILE, computeInitials } from '../context/user-profile-context';

export const SettingsScreen: React.FC = () => {
  const { profile, updateProfile, resetProfile } = useUserProfile();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [role, setRole] = useState(profile.role || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewInitials = computeInitials(displayName || 'User');

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
    setDisplayName(DEFAULT_PROFILE.displayName);
    setRole(DEFAULT_PROFILE.role || '');
    setErrorMessage(null);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col w-full pb-16">
      <div className="w-full px-space-lg py-space-md space-y-space-md max-w-[1100px] mx-auto">
        {/* Header Banner */}
        <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="space-y-1">
            <div className="flex items-center gap-space-xs text-outline font-label-sm text-label-sm uppercase tracking-wider">
              <span className="material-symbols-outlined text-[15px] text-primary">person</span>
              <span>Preferences & Identity</span>
              <span>·</span>
              <span className="text-primary font-medium">Public Demo Mode</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              User Profile & Settings
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Personalize your identity for project activity, task ownership, and decision records.
              In this public hackathon demo, authentication is intentionally bypassed so judges can freely evaluate Threadline.
            </p>
          </div>
        </div>

        {/* Saved Success Notification */}
        {savedSuccess && (
          <div className="p-space-md rounded bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
              <div>
                <p className="font-label-md text-label-md font-semibold">Profile updated successfully</p>
                <p className="font-body-sm text-[12px] text-emerald-700">
                  Your identity has been saved locally and synchronized across the sidebar, navigation, and overview.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSavedSuccess(false)}
              className="text-emerald-700 hover:text-emerald-900 p-1"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Profile Card Section */}
        <div className="bg-surface-container-lowest rounded shadow-sm overflow-hidden">
          <div className="px-space-lg py-space-md bg-surface-container-low/60 border-b border-surface-container flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Personal Identity</h2>
            </div>
            <span className="font-label-sm text-[11px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
              Client-side Persistence (localStorage)
            </span>
          </div>

          <form onSubmit={handleSave} className="p-space-lg space-y-space-lg">
            {/* Live Avatar Preview */}
            <div className="flex items-center gap-space-md p-space-md rounded bg-surface-container-low/40 border border-surface-container">
              <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xl shrink-0 shadow-sm transition-transform">
                {previewInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-headline-sm text-headline-sm text-on-surface truncate">
                    {displayName.trim() || 'User'}
                  </p>
                  <span className="font-label-sm text-[11px] px-2 py-0.5 rounded bg-primary-container text-on-primary font-medium">
                    Active Identity
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {role.trim() || 'Role not specified (e.g. Platform Engineer, Lead PM)'}
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
                  className="w-full h-10 px-space-md rounded bg-surface-container-lowest border border-outline-variant text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-colors"
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
                  className="w-full h-10 px-space-md rounded bg-surface-container-lowest border border-outline-variant text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-colors"
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
                <span>Reset to Default (User)</span>
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

        {/* Demo Mode & Architecture Notice */}
        <div className="bg-surface-container-lowest rounded shadow-sm p-space-lg space-y-space-md">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-outline text-[20px]">info</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Demo Environment Architecture</h2>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Threadline is configured for the <strong>CodersInPune Hackathon Round 2</strong>. In accordance with competition evaluation guidelines, authentication and registration are intentionally disabled so evaluators can inspect knowledge continuity workflows immediately without credential setup.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md pt-space-xs">
            <div className="p-space-md rounded bg-surface-container-low border border-surface-container space-y-1">
              <div className="flex items-center gap-1.5 text-on-surface font-semibold text-xs">
                <span className="material-symbols-outlined text-primary text-[16px]">storage</span>
                <span>Data Isolation</span>
              </div>
              <p className="text-[12px] text-on-surface-variant">
                Projects, tasks, decisions, and documents are stored in the active database.
              </p>
            </div>
            <div className="p-space-md rounded bg-surface-container-low border border-surface-container space-y-1">
              <div className="flex items-center gap-1.5 text-on-surface font-semibold text-xs">
                <span className="material-symbols-outlined text-emerald-700 text-[16px]">shield</span>
                <span>Privacy & Keys</span>
              </div>
              <p className="text-[12px] text-on-surface-variant">
                Document extraction models and secrets run exclusively on the backend without leaking keys to the client.
              </p>
            </div>
            <div className="p-space-md rounded bg-surface-container-low border border-surface-container space-y-1">
              <div className="flex items-center gap-1.5 text-on-surface font-semibold text-xs">
                <span className="material-symbols-outlined text-tertiary text-[16px]">devices</span>
                <span>Independent Browsers</span>
              </div>
              <p className="text-[12px] text-on-surface-variant">
                Local profile preferences are scoped to each browser instance using HTML5 LocalStorage.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
