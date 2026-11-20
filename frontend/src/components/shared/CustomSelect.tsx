import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { AnimatedPopover } from './MotionPrimitives';

export interface CustomSelectOption {
  value: string;
  label: string;
  dotClass?: string;
  description?: string;
  disabled?: boolean;
}

export type CustomSelectOptionInput = string | CustomSelectOption;

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: readonly CustomSelectOptionInput[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
  size?: 'xs' | 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
  minMenuWidth?: number;
  prefixNode?: React.ReactNode;
}

interface MenuCoords {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxHeight: number;
}

/**
 * Portal-rendered dropdown select replacing native OS <select> menus with consistent SaaS UI.
 */
export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  disabled = false,
  ariaLabel,
  title,
  size = 'md',
  fullWidth = true,
  className = '',
  minMenuWidth = 140,
  prefixNode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const normalizedOptions = useMemo<CustomSelectOption[]>(
    () =>
      options.map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      ),
    [options]
  );

  const stringValue = String(value ?? '');
  const selectedOption = normalizedOptions.find((o) => o.value === stringValue);

  const computePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estimatedHeight = Math.min(248, Math.max(44, normalizedOptions.length * 34 + 10));
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const menuWidth = Math.max(rect.width, minMenuWidth);
    const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);

    if (openUpwards) {
      setCoords({
        left,
        bottom: window.innerHeight - rect.top + 4,
        width: menuWidth,
        maxHeight: Math.max(120, Math.min(248, spaceAbove)),
      });
    } else {
      setCoords({
        left,
        top: rect.bottom + 4,
        width: menuWidth,
        maxHeight: Math.max(120, Math.min(248, spaceBelow)),
      });
    }
  }, [normalizedOptions.length, minMenuWidth]);

  useEffect(() => {
    if (!isOpen) return;
    computePosition();

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleScrollOrResize = (e: Event) => {
      if (e.type === 'scroll' && menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, computePosition]);

  const sizeClasses =
    size === 'xs'
      ? 'px-2 py-1 text-[11px] rounded-md'
      : size === 'sm'
      ? 'h-8 px-2.5 text-xs rounded-lg'
      : 'px-3 py-2 text-xs rounded-lg';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        title={title}
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => !prev);
        }}
        className={`${fullWidth ? 'w-full' : 'w-auto'} ${sizeClasses} inline-flex items-center justify-between gap-2 bg-white border ${
          isOpen
            ? 'border-brand-600 ring-2 ring-brand-500/15'
            : 'border-slate-200 hover:border-slate-300'
        } text-slate-700 font-medium transition-all outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap ${className}`}
      >
        <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
          {prefixNode}
          {!prefixNode && selectedOption?.dotClass && (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedOption.dotClass}`} />
          )}
          <span className={`truncate ${selectedOption ? 'text-slate-800' : 'text-slate-400'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-brand-600' : 'text-slate-400'
          }`}
        />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && coords && (
              <AnimatedPopover
                key="custom-select-menu"
                ref={menuRef}
                role="listbox"
                style={{
                  position: 'fixed',
                  left: coords.left,
                  top: coords.top,
                  bottom: coords.bottom,
                  minWidth: coords.width,
                  maxWidth: Math.min(440, window.innerWidth - 16),
                  maxHeight: coords.maxHeight,
                  zIndex: 9999,
                }}
                className="bg-white border border-slate-200/95 rounded-xl popover-shadow py-1 overflow-y-auto custom-scrollbar select-none"
              >
            {normalizedOptions.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-slate-400 text-center">No options</div>
            ) : (
              normalizedOptions.map((opt) => {
                const isSelected = opt.value === stringValue;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSelected
                        ? 'bg-brand-50/80 text-brand-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      {opt.dotClass && (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${opt.dotClass}`} />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />}
                  </button>
                );
              })
            )}
              </AnimatedPopover>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
