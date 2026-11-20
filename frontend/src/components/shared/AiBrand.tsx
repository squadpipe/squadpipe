import React from 'react';

interface AiIconProps {
  className?: string;
}

/**
 * Official PipeAI precision geometric emblem: symmetrical 4-point neural star
 * with orbital spark facet and micro node, built to stay razor-sharp from 10px to 24px.
 */
export const AiIcon: React.FC<AiIconProps> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M10.5 3C11.15 7.45 13.55 9.85 18 10.5C13.55 11.15 11.15 13.55 10.5 18C9.85 13.55 7.45 11.15 3 10.5C7.45 9.85 9.85 7.45 10.5 3Z"
      fill="currentColor"
    />
    <path
      d="M19 2C19.28 3.65 20.1 4.47 21.75 4.75C20.1 5.03 19.28 5.85 19 7.5C18.72 5.85 17.9 5.03 16.25 4.75C17.9 4.47 18.72 3.65 19 2Z"
      fill="currentColor"
    />
    <circle cx="18.25" cy="18.25" r="1.5" fill="currentColor" fillOpacity="0.85" />
  </svg>
);

interface AiMarkProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const MARK_SIZE_CLASSES = {
  xs: { box: 'w-5 h-5 rounded-md', icon: 'w-3 h-3' },
  sm: { box: 'w-7 h-7 rounded-lg', icon: 'w-3.5 h-3.5' },
  md: { box: 'w-9 h-9 rounded-xl', icon: 'w-4 h-4' },
  lg: { box: 'w-11 h-11 rounded-full', icon: 'w-5 h-5' },
} as const;

/**
 * Branded obsidian + teal container badge featuring the PipeAI emblem,
 * harmonizing directly with the official SquadPipe BrandMark.
 */
export const AiMark: React.FC<AiMarkProps> = ({ size = 'sm', className = '' }) => {
  const s = MARK_SIZE_CLASSES[size];
  return (
    <span
      className={`${s.box} bg-[#141615] text-teal-400 border border-white/10 shadow-xs inline-flex items-center justify-center shrink-0 ${className}`}
    >
      <AiIcon className={s.icon} />
    </span>
  );
};

interface AiBadgeProps {
  label?: string;
  size?: 'xs' | 'sm';
  variant?: 'subtle' | 'dark';
  title?: string;
  className?: string;
}

/**
 * Consistent PipeAI pill indicator used across parsed records,
 * AI evaluations, drafts, and workspace capabilities.
 */
export const AiBadge: React.FC<AiBadgeProps> = ({
  label = 'PipeAI',
  size = 'xs',
  variant = 'subtle',
  title,
  className = '',
}) => {
  const sizeClass =
    size === 'xs'
      ? 'px-2 py-0.5 text-[11px] gap-1'
      : 'px-2.5 py-0.5 text-[11px] gap-1.5';
  const variantClass =
    variant === 'dark'
      ? 'bg-[#141615] text-teal-300 border-white/15'
      : 'bg-teal-50/90 text-teal-800 border-teal-200/80';

  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap leading-none ${sizeClass} ${variantClass} ${className}`}
    >
      <AiIcon
        className={`shrink-0 ${variant === 'dark' ? 'text-teal-400' : 'text-teal-600'} ${size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'
          }`}
      />
      <span>{label}</span>
    </span>
  );
};

interface AiTagProps {
  label?: string;
  className?: string;
}

/**
 * Compact inline "AI" micro-pill placed inside action buttons and command items.
 */
export const AiTag: React.FC<AiTagProps> = ({ label = 'AI', className = '' }) => (
  <span
    className={`px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200/80 text-[10px] font-bold uppercase tracking-wider leading-none ${className}`}
  >
    {label}
  </span>
);
