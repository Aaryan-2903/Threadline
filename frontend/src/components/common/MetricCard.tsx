import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  iconColor?: string;
  badge?: React.ReactNode;
  footerLeft?: string;
  footerRight?: string;
  sparkline?: boolean;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  iconColor = 'text-outline',
  badge,
  footerLeft,
  footerRight,
  sparkline = false,
  className = '',
}) => {
  return (
    <div
      className={`bg-surface-container-lowest p-space-md rounded shadow-sm hover:shadow transition-shadow flex flex-col justify-between ${className}`}
    >
      <div className="flex items-center justify-between text-on-surface-variant">
        <span className="font-label-sm text-label-sm uppercase text-outline tracking-wider font-medium">
          {title}
        </span>
        <span className={`material-symbols-outlined text-[18px] ${iconColor}`}>{icon}</span>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
            {value}
          </span>
          {badge}
        </div>
        {sparkline && (
          <svg className="w-16 h-6 text-primary shrink-0" fill="none" viewBox="0 0 64 24">
            <path
              d="M1 18 L15 14 L28 17 L42 8 L54 11 L63 3"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
            />
          </svg>
        )}
      </div>

      {(footerLeft || footerRight) && (
        <div className="mt-2 pt-2 bg-surface-container-low/50 -mx-space-md -mb-space-md px-space-md py-1.5 flex items-center justify-between text-[11px] text-outline rounded-b">
          <span>{footerLeft}</span>
          <span className="text-on-surface font-medium">{footerRight}</span>
        </div>
      )}
    </div>
  );
};

