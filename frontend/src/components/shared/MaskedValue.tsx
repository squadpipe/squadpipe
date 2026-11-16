import React from 'react';
import { useCurrency } from '../../utils/currency';

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
  const { formatRate } = useCurrency();
  if (isMasked) {
    return <span className={`tracking-widest text-slate-400 select-none ${className}`}>••••••</span>;
  }
  const formattedValue = typeof value === 'string' ? formatRate(value) : value;
  return <span className={className}>{prefix}{formattedValue}{suffix}</span>;
};

