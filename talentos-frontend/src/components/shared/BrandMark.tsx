import React from 'react';

interface BrandMarkProps {
  className?: string;
}

/**
 * Geometric SquadPipe emblem representing candidate squads moving through pipeline stages.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ className = 'w-4 h-4' }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="4.5" y="5.5" width="10.5" height="3.4" rx="1.7" fill="currentColor" />
      <circle cx="17.8" cy="7.2" r="1.7" fill="currentColor" fillOpacity="0.65" />
      <circle cx="6.2" cy="12" r="1.7" fill="currentColor" fillOpacity="0.65" />
      <rect x="9.5" y="10.3" width="10" height="3.4" rx="1.7" fill="currentColor" />
      <rect x="4.5" y="15.1" width="10.5" height="3.4" rx="1.7" fill="currentColor" />
      <circle cx="17.8" cy="16.8" r="1.7" fill="currentColor" fillOpacity="0.65" />
    </svg>
  );
};
