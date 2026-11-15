import React from 'react';

interface BrandMarkProps {
  className?: string;
  surface?: 'light' | 'dark';
}

/**
 * Official SquadPipe SVG emblem: sharp dark square (#18181B) with geometric
 * right-angle pipeline elbow cutout.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  className = 'w-6 h-6',
  surface = 'light',
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="100" height="100" fill="#18181B" />
      {surface === 'dark' && (
        <rect
          x="1.5"
          y="1.5"
          width="97"
          height="97"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.2"
          strokeWidth="3"
        />
      )}
      <path d="M15 34H62V85H38V58H15V34Z" fill="#FFFFFF" />
    </svg>
  );
};

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  surface?: 'light' | 'dark';
  className?: string;
}

const LOGO_SIZES = {
  sm: { mark: 'w-5 h-5', gap: 'gap-2', text: 'text-[15px]' },
  md: { mark: 'w-[26px] h-[26px]', gap: 'gap-2.5', text: 'text-[17px]' },
  lg: { mark: 'w-9 h-9', gap: 'gap-3', text: 'text-[23px]' },
} as const;

/**
 * Horizontal SquadPipe logo lockup (emblem + lowercase wordmark).
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  surface = 'light',
  className = '',
}) => {
  const s = LOGO_SIZES[size];
  return (
    <div className={`inline-flex items-center ${s.gap} min-w-0 ${className}`}>
      <BrandMark className={`${s.mark} flex-shrink-0`} surface={surface} />
      <span
        className={`${s.text} font-light tracking-[-0.025em] leading-none truncate ${
          surface === 'dark' ? 'text-white' : 'text-[#18181B]'
        }`}
      >
        squadpipe
      </span>
    </div>
  );
};
