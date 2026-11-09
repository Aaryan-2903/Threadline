import React from 'react';

export type BadgeVariant =
  | 'in_handover'
  | 'active'
  | 'review'
  | 'completed'
  | 'verified'
  | 'urgent'
  | 'high'
  | 'medium'
  | 'blocked'
  | 'in_progress'
  | 'todo'
  | 'draft_ready';

interface StatusBadgeProps {
  variant: BadgeVariant | string;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, label, className = '' }) => {
  const norm = variant.toLowerCase().replace(/[\s-]/g, '_');

  switch (norm) {
    case 'in_handover':
    case 'handover':
      return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-sm text-[11px] font-medium bg-amber-50 text-amber-800 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span>{label || 'In Handover'}</span>
        </span>
      );

    case 'active':
      return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-sm text-[11px] font-medium bg-blue-50 text-blue-800 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          <span>{label || 'Active'}</span>
        </span>
      );

    case 'review':
      return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-sm text-[11px] font-medium bg-purple-50 text-purple-800 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
          <span>{label || 'Review'}</span>
        </span>
      );

    case 'verified':
    case 'completed':
      return (
        <span className={`inline-flex items-center gap-1 font-label-sm text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium ${className}`}>
          <span className="material-symbols-outlined text-[13px]">verified</span>
          <span>{label || 'Verified'}</span>
        </span>
      );

    case 'urgent':
      return (
        <span className={`inline-flex items-center gap-1 font-label-sm text-[10px] px-1.5 py-0.2 rounded bg-error text-on-error font-bold uppercase tracking-wider ${className}`}>
          <span>{label || 'Urgent'}</span>
        </span>
      );

    case 'high':
      return (
        <span className={`inline-flex items-center gap-1 font-label-sm text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold uppercase tracking-wider ${className}`}>
          <span>{label || 'High'}</span>
        </span>
      );

    case 'medium':
      return (
        <span className={`inline-flex items-center gap-1 font-label-sm text-[10px] px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant font-bold uppercase tracking-wider ${className}`}>
          <span>{label || 'Medium'}</span>
        </span>
      );

    case 'blocked':
      return (
        <span className={`inline-flex items-center gap-1 font-label-sm text-[11px] px-1.5 py-0.5 rounded bg-error-container text-error font-medium ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
          <span>{label || 'Blocked'}</span>
        </span>
      );

    case 'in_progress':
      return (
        <span className={`inline-flex items-center gap-1 font-label-sm text-[11px] px-1.5 py-0.5 rounded bg-primary-fixed text-primary font-medium ${className}`}>
          <span>{label || 'In Progress'}</span>
        </span>
      );

    case 'todo':
      return (
        <span className={`inline-flex items-center gap-1 font-label-sm text-[11px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium ${className}`}>
          <span>{label || 'To Do'}</span>
        </span>
      );

    case 'draft_ready':
      return (
        <span className={`font-label-sm text-[10px] tracking-wide uppercase px-1.5 py-0.5 bg-primary-fixed text-primary font-bold rounded ${className}`}>
          {label || 'Draft Ready'}
        </span>
      );

    default:
      return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-sm text-[11px] bg-surface-container text-on-surface-variant ${className}`}>
          <span>{label || variant}</span>
        </span>
      );
  }
};

