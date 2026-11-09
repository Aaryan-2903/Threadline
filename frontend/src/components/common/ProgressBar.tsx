import React from 'react';

interface ProgressBarProps {
  progress: number;
  label?: string;
  sublabel?: string;
  color?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  sublabel,
  color = 'bg-primary',
  className = '',
}) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={`space-y-1 ${className}`}>
      {(label || sublabel) && (
        <div className="flex items-center justify-between text-[11px] text-outline font-code-inline">
          {label && <span>{label}</span>}
          {sublabel && <span className="font-semibold text-on-surface">{sublabel}</span>}
        </div>
      )}
      <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

