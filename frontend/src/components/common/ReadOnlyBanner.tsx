import React from 'react';

interface ReadOnlyBannerProps {
  message?: string;
  badgeLabel?: string;
  className?: string;
}

export const ReadOnlyBanner: React.FC<ReadOnlyBannerProps> = ({
  message = "You're viewing this workspace in read-only mode. You can inspect existing records, but cannot generate or modify them.",
  badgeLabel = "Read-Only Mode",
  className = "",
}) => {
  return (
    <div
      className={`w-full bg-slate-50 border-b border-slate-200/90 px-space-xl py-2.5 flex items-center justify-between text-xs text-slate-700 animate-fade-in ${className}`}
      role="status"
      aria-label="Read-only mode notice"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-outlined text-[17px] text-slate-500 shrink-0 select-none">
          visibility
        </span>
        <span className="truncate font-medium">{message}</span>
      </div>
      <span className="shrink-0 ml-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200/80 text-slate-700 border border-slate-300 select-none">
        {badgeLabel}
      </span>
    </div>
  );
};

