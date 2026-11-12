import React from 'react';

interface MaskedValueProps {
  value: string | number;
  isMasked?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const MaskedValue: React.FC<MaskedValueProps> = ({
  value,
  isMasked = false,
  prefix = '',
  suffix = '',
  className = ''
}) => {
  if (isMasked) {
    return <span className={`font-mono tracking-widest text-slate-400 select-none ${className}`}>••••••</span>;
  }
  return <span className={className}>{prefix}{value}{suffix}</span>;
};

