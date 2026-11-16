import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Shows an inline spinner and disables clicks while an async action is in flight. */
  loading?: boolean;
  /** Optional label replacement displayed next to the spinner while loading. */
  loadingText?: React.ReactNode;
  /** Optional leading icon shown when not loading. */
  icon?: React.ReactNode;
  /** Tailwind classes for the Loader2 spinner icon. */
  spinnerClassName?: string;
}

/**
 * Reusable action button with built-in loading spinner and double-click guard.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  loading = false,
  loadingText,
  icon,
  spinnerClassName = 'w-3.5 h-3.5 animate-spin flex-shrink-0',
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}) => {
  return (
    <button
      type={type}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className={spinnerClassName} /> : icon}
      <span>{loading && loadingText !== undefined ? loadingText : children}</span>
    </button>
  );
};
