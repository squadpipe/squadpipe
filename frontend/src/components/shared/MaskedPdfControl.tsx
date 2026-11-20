import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Info, Shield, X } from 'lucide-react';
import { AnimatedPopover } from './MotionPrimitives';

interface MaskedPdfToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
  popoverPlacement?: 'top' | 'bottom';
  popoverAlign?: 'left' | 'right';
}

/**
 * Shared "Masked PDF" checkbox with an interactive, HR-friendly info toggle popover.
 */
export const MaskedPdfToggle: React.FC<MaskedPdfToggleProps> = ({
  checked,
  onChange,
  compact = false,
  popoverPlacement = 'bottom',
  popoverAlign = 'left',
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showInfo) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowInfo(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowInfo(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showInfo]);

  const verticalClass = popoverPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
  const horizontalClass = popoverAlign === 'right' ? 'right-0' : 'left-0';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${
        compact
          ? 'border-r border-slate-200 hover:bg-slate-50 rounded-l-lg transition-colors'
          : 'gap-1'
      }`}
    >
      <label
        title="Hide personal email and phone number on the exported profile PDF"
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer select-none ${
          compact ? 'pl-2.5 pr-1 py-1.5' : 'py-1'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span>Masked PDF</span>
      </label>

      <button
        type="button"
        onClick={() => setShowInfo((prev) => !prev)}
        aria-label="What is Masked PDF?"
        aria-expanded={showInfo}
        title="Learn how Masked PDF works"
        className={`inline-flex items-center justify-center rounded-md transition-colors cursor-pointer ${
          compact ? 'mr-1.5 p-1' : 'p-1'
        } ${
          showInfo
            ? 'text-brand-600 bg-brand-50'
            : 'text-slate-400 hover:text-brand-600 hover:bg-slate-100'
        }`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {showInfo && (
          <AnimatedPopover
            key="masked-pdf-info-popover"
            role="dialog"
            aria-label="About Masked PDF"
            className={`absolute ${verticalClass} ${horizontalClass} w-72 bg-white border border-slate-200 rounded-xl popover-shadow p-3.5 z-50 text-left`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Shield className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <span>What is a Masked PDF?</span>
              </div>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                aria-label="Close Masked PDF info"
                className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed mt-1.5">
              Hides the candidate&apos;s personal email address and phone number on the exported PDF
              so you can introduce them to clients safely before an interview.
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5 pt-1.5 border-t border-slate-100">
              Their name, skills, work history, and your agency details remain visible.
            </p>
          </AnimatedPopover>
        )}
      </AnimatePresence>
    </div>
  );
};
