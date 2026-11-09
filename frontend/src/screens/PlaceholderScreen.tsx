import React from 'react';
import { useNavigation } from '../context/useNavigation';

interface PlaceholderScreenProps {
  title: string;
  badge?: string;
  subtitle: string;
  icon: string;
}

export const PlaceholderScreen: React.FC<PlaceholderScreenProps> = ({
  title,
  badge,
  subtitle,
  icon,
}) => {
  const { navigate } = useNavigation();

  return (
    <div className="w-full px-space-xl py-space-xl max-w-[1520px] mx-auto space-y-space-lg">
      <div className="bg-surface-container-lowest p-space-xl rounded-lg shadow-sm flex flex-col justify-between space-y-space-md">
        <div className="flex items-center gap-space-sm flex-wrap">
          <div className="w-9 h-9 rounded bg-primary-fixed flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            {title}
          </h1>
          {badge && (
            <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-code-inline text-[11px] font-semibold">
              {badge}
            </span>
          )}
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
          {subtitle}
        </p>
      </div>

      <div className="bg-surface-container-lowest p-space-xl rounded-lg shadow-sm flex flex-col items-center justify-center py-16 text-center space-y-space-md">
        <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-[32px]">{icon}</span>
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            {title} Workspace
          </h3>
          <p className="font-body-sm text-body-sm text-outline">
            Full view specification retrieved from Stitch. This screen is ready to be fully enabled in Phase 2.
          </p>
        </div>
        <div className="flex items-center gap-space-sm pt-2">
          <button
            onClick={() => navigate('overview')}
            className="h-8 px-3 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
            type="button"
          >
            Back to Overview
          </button>
          <button
            onClick={() => navigate('my-projects')}
            className="h-8 px-3 rounded bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors cursor-pointer"
            type="button"
          >
            Explore Projects
          </button>
        </div>
      </div>
    </div>
  );
};

