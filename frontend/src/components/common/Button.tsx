import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconPosition?: 'left' | 'right';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'h-7 px-2.5 text-label-sm font-label-sm gap-1',
    md: 'h-8 px-3 font-label-md text-label-md gap-1.5',
    lg: 'h-9 px-space-md font-label-md text-label-md gap-2',
  }[size];

  const variantClasses = {
    primary:
      'bg-primary hover:bg-primary-container text-on-primary shadow-sm active:scale-[0.98] transition-all',
    secondary:
      'bg-surface-container hover:bg-surface-container-high text-on-surface shadow-sm transition-colors',
    outline:
      'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low border border-outline-variant/30 shadow-sm transition-colors',
    danger:
      'bg-error hover:bg-error/90 text-on-error shadow-sm transition-colors',
    ghost:
      'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors',
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center rounded cursor-pointer select-none font-medium ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {icon && iconPosition === 'left' && (
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
      )}
      {children}
      {icon && iconPosition === 'right' && (
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
      )}
    </button>
  );
};

