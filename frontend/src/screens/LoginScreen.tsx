import React, { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useNavigation } from '../context/useNavigation';
import type { UserRole } from '../types';

interface PresetAccount {
  label: string;
  role: UserRole;
  email: string;
  pass: string;
  desc: string;
  badgeColor: string;
}

const PRESET_ACCOUNTS: PresetAccount[] = [
  {
    label: 'Judge Demo Owner',
    role: 'project_owner',
    email: 'demo@threadline.io',
    pass: 'demo123',
    desc: 'Pre-seeded demo workspace with conflicts, redaction & handover lifecycle',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    label: 'Platform Admin',
    role: 'admin',
    email: 'admin@threadline.io',
    pass: 'admin123',
    desc: 'Full system authority, audit trail inspection & governance',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
  },
  {
    label: 'Team Contributor',
    role: 'contributor',
    email: 'contributor@threadline.io',
    pass: 'contrib123',
    desc: 'Edits tasks, decisions & documents; cannot resolve conflicts',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    label: 'Auditor / Viewer',
    role: 'viewer',
    email: 'viewer@threadline.io',
    pass: 'viewer123',
    desc: 'Strictly read-only observer; all mutation actions prohibited',
    badgeColor: 'bg-gray-100 text-gray-700 border-gray-300',
  },
];

export const LoginScreen: React.FC = () => {
  const { login, demoLogin, isLoading: authLoading } = useAuth();
  const { navigate } = useNavigation();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = authLoading || localLoading;

  const handleJudgeDemoAccess = async () => {
    setLocalLoading(true);
    setErrorMessage(null);
    try {
      await demoLogin();
      navigate('overview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize Judge Demo Session';
      setErrorMessage(msg);
    } finally {
      setLocalLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      setErrorMessage('Please provide both username/email and password.');
      return;
    }

    setLocalLoading(true);
    setErrorMessage(null);
    try {
      await login(usernameOrEmail.trim(), password);
      navigate('overview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSelectPreset = (preset: PresetAccount) => {
    setUsernameOrEmail(preset.email);
    setPassword(preset.pass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen w-full bg-surface-container-low flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* Container */}
      <div className="w-full max-w-lg space-y-6">
        {/* Brand & Round 3 Evaluation Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold text-base shadow-sm">
              TL
            </div>
            <span className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
              Threadline
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
            AI-Powered Project Knowledge Continuity &amp; Handover Platform
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary text-xs font-semibold shadow-xs">
            <span className="material-symbols-outlined text-[15px]">verified</span>
            <span>Round 3 Evaluation: Enterprise RBAC &amp; Integrity Verification</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-md border border-outline-variant/30 overflow-hidden">
          {/* Judge Demo Access Primary Hero Action */}
          <div className="p-6 bg-linear-to-br from-amber-500/10 via-indigo-500/5 to-primary/10 border-b border-outline-variant/30">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  <span className="material-symbols-outlined text-[13px]">hotel_class</span>
                  Recommended For Judges
                </span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold mt-1">
                  Instant Judge Demo Access
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                  One-click entry with no manual credentials required. Automatically loads sample workspace with cross-document conflicts, sensitive data redaction, and an active handover lifecycle.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleJudgeDemoAccess}
              disabled={isSubmitting}
              className="w-full h-11 bg-linear-to-r from-amber-600 via-indigo-600 to-primary hover:from-amber-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span>Initializing Demo Session...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">stars</span>
                  <span>Enter Judge Demo Workspace (1-Click)</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-outline mt-2 font-medium">
              Assigned Role: <span className="font-bold text-indigo-700">Project Owner</span> (Marcus Vance)
            </p>
          </div>

          {/* Divider */}
          <div className="relative px-6 py-4 flex items-center justify-center">
            <div className="border-t border-outline-variant/30 w-full" />
            <span className="bg-surface-container-lowest px-3 text-xs font-semibold text-outline uppercase tracking-wider absolute">
              Or Sign In With Account
            </span>
          </div>

          {/* Form Content */}
          <div className="p-6 pt-2 space-y-4">
            {/* Error Message Alert */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-error-container/40 border border-error/30 text-error flex items-start gap-2 text-xs leading-relaxed animate-fade-in">
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                <div className="flex-1">
                  <p className="font-semibold">Authentication Error</p>
                  <p>{errorMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-error hover:opacity-70 p-0.5"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            )}

            <form onSubmit={handlePasswordLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Username or Email
                </label>
                <input
                  type="text"
                  required
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="e.g. demo@threadline.io or admin"
                  disabled={isSubmitting}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface text-sm focus:outline-hidden focus:border-primary transition-colors disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface text-sm focus:outline-hidden focus:border-primary transition-colors disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none text-sm"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">login</span>
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick-Fill Evaluation Presets */}
            <div className="pt-3 border-t border-outline-variant/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider">
                  Test Role Presets
                </span>
                <span className="text-[10px] text-outline">Click to fill credentials</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PRESET_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleSelectPreset(acc)}
                    disabled={isSubmitting}
                    className="p-2.5 rounded-lg border border-outline-variant/40 hover:border-primary hover:bg-surface-container-low transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors truncate">
                        {acc.label}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${acc.badgeColor}`}>
                        {acc.role}
                      </span>
                    </div>
                    <p className="text-[10px] text-outline font-mono truncate">{acc.email}</p>
                    <p className="text-[10px] text-on-surface-variant line-clamp-1 mt-0.5">{acc.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Security Note */}
        <div className="text-center space-y-1 text-xs text-outline">
          <p className="flex items-center justify-center gap-1 text-[11px]">
            <span className="material-symbols-outlined text-[14px] text-emerald-600">lock</span>
            <span>Cryptographic JWT (HS256) session with server-side RBAC enforcement.</span>
          </p>
          <p className="text-[10px]">
            Frontend permissions are verified against backend authority on every mutation.
          </p>
        </div>
      </div>
    </div>
  );
};

