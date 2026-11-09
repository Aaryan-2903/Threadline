import React from 'react';

interface Owner {
  name: string;
  avatar?: string;
  role?: string;
}

interface OwnerTransitionBadgeProps {
  outgoing: Owner;
  incoming: Owner;
  note?: string;
  className?: string;
}

export const OwnerTransitionBadge: React.FC<OwnerTransitionBadgeProps> = ({
  outgoing,
  incoming,
  note,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <div className="flex items-center bg-surface-container-low p-1 rounded gap-1.5 w-fit">
        <div className="flex items-center gap-1">
          {outgoing.avatar ? (
            <img
              src={outgoing.avatar}
              alt={outgoing.name}
              className="w-5 h-5 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-[9px] font-medium shrink-0">
              {outgoing.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="font-label-sm text-[11px] font-medium text-on-surface whitespace-nowrap">
            {outgoing.name}
          </span>
        </div>

        <span className="material-symbols-outlined text-[13px] text-primary">arrow_forward</span>

        <div className="flex items-center gap-1">
          {incoming.avatar ? (
            <img
              src={incoming.avatar}
              alt={incoming.name}
              className="w-5 h-5 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-tertiary-container text-on-tertiary flex items-center justify-center text-[9px] font-medium shrink-0">
              {incoming.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="font-label-sm text-[11px] font-medium text-secondary whitespace-nowrap">
            {incoming.name}
          </span>
        </div>
      </div>
      {note && (
        <span className="font-label-sm text-[10px] text-amber-700 pl-1 font-medium">{note}</span>
      )}
    </div>
  );
};

