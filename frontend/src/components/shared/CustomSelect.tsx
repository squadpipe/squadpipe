import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { AnimatedPopover } from './MotionPrimitives';

export interface CustomSelectOption {
  value: string;
  label: string;
  dotClass?: string;
  description?: string;
  keywords?: string;
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
  searchable?: boolean;
  searchPlaceholder?: string;
  emptySearchText?: string;
  menuMaxHeight?: number;
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
  searchable = false,
  searchPlaceholder = 'Search options...',
  emptySearchText = 'No matching options found',
  menuMaxHeight,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const normalizedOptions = useMemo<CustomSelectOption[]>(
    () =>
      options.map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      ),
    [options]
  );

  const filteredOptions = useMemo<CustomSelectOption[]>(() => {
    if (!searchable || !searchQuery.trim()) return normalizedOptions;
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return normalizedOptions.filter((opt) => {
      const haystack = [opt.label, opt.value, opt.description, opt.keywords]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [normalizedOptions, searchable, searchQuery]);

  const stringValue = String(value ?? '');
  const selectedOption = normalizedOptions.find((o) => o.value === stringValue);
  const capHeight = menuMaxHeight ?? (searchable ? 320 : 248);

  const computePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const searchHeaderOffset = searchable ? 48 : 0;
    const estimatedHeight = Math.min(
      capHeight,
      Math.max(44 + searchHeaderOffset, normalizedOptions.length * 36 + 10 + searchHeaderOffset)
    );
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const menuWidth = Math.min(Math.max(rect.width, minMenuWidth), window.innerWidth - 16);
    const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);

    if (openUpwards) {
      setCoords({
        left,
        bottom: window.innerHeight - rect.top + 4,
        width: menuWidth,
        maxHeight: Math.max(140, Math.min(capHeight, spaceAbove)),
      });
    } else {
      setCoords({
        left,
        top: rect.bottom + 4,
        width: menuWidth,
        maxHeight: Math.max(140, Math.min(capHeight, spaceBelow)),
      });
    }
  }, [normalizedOptions.length, minMenuWidth, searchable, capHeight]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setHighlightedIdx(-1);
      return;
    }

    computePosition();

    const focusTimer = searchable
      ? window.requestAnimationFrame(() => {
          searchInputRef.current?.focus();
        })
      : null;

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
      if (focusTimer !== null) window.cancelAnimationFrame(focusTimer);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, searchable, computePosition]);

  useEffect(() => {
    if (highlightedIdx < 0 || !isOpen) return;
    optionRefs.current[highlightedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIdx, isOpen]);

  const handleSelectOption = (opt: CustomSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
  };

  const sizeClasses =
    size === 'xs'
      ? 'px-2 py-1 text-[11px] rounded-md'
      : size === 'sm'
      ? 'h-8 px-2.5 text-xs rounded-lg'
      : 'h-9 px-3 text-xs rounded-lg';

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
                  width: coords.width,
                  minWidth: coords.width,
                  maxWidth: Math.min(480, window.innerWidth - 16),
                  maxHeight: coords.maxHeight,
                  zIndex: 9999,
                }}
                className="bg-white border border-slate-200/95 rounded-xl popover-shadow flex flex-col overflow-hidden select-none"
              >
                {searchable && (
                  <div className="p-2 border-b border-slate-100 bg-white shrink-0">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setHighlightedIdx(0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown' && filteredOptions.length > 0) {
                            e.preventDefault();
                            setHighlightedIdx((prev) =>
                              prev < 0 ? 0 : (prev + 1) % filteredOptions.length
                            );
                          } else if (e.key === 'ArrowUp' && filteredOptions.length > 0) {
                            e.preventDefault();
                            setHighlightedIdx((prev) =>
                              prev <= 0 ? filteredOptions.length - 1 : prev - 1
                            );
                          } else if (e.key === 'Enter' && filteredOptions.length > 0) {
                            e.preventDefault();
                            e.stopPropagation();
                            const targetOpt =
                              highlightedIdx >= 0 && highlightedIdx < filteredOptions.length
                                ? filteredOptions[highlightedIdx]
                                : filteredOptions[0];
                            if (targetOpt) handleSelectOption(targetOpt);
                          }
                        }}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        className="w-full h-8 pl-8 pr-7 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setHighlightedIdx(-1);
                            searchInputRef.current?.focus();
                          }}
                          aria-label="Clear search"
                          className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="py-1 overflow-y-auto custom-scrollbar flex-1">
                  {filteredOptions.length === 0 ? (
                    <div className="px-3 py-4 text-[11px] text-slate-400 text-center">
                      {searchable && searchQuery.trim() ? emptySearchText : 'No options'}
                    </div>
                  ) : (
                    filteredOptions.map((opt, idx) => {
                      const isSelected = opt.value === stringValue;
                      const isHighlighted = idx === highlightedIdx;
                      return (
                        <button
                          key={opt.value}
                          ref={(el) => {
                            optionRefs.current[idx] = el;
                          }}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          disabled={opt.disabled}
                          onClick={() => handleSelectOption(opt)}
                          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            isSelected
                              ? 'bg-brand-50/80 text-brand-700 font-semibold'
                              : isHighlighted
                              ? 'bg-slate-100 text-slate-900 font-medium'
                              : 'text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <span className="inline-flex items-start gap-2 min-w-0 flex-1">
                            {opt.dotClass && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${opt.dotClass}`}
                              />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{opt.label}</span>
                              {opt.description && (
                                <span
                                  className={`block truncate text-[10px] mt-0.5 ${
                                    isSelected ? 'text-brand-600/80 font-normal' : 'text-slate-400 font-normal'
                                  }`}
                                >
                                  {opt.description}
                                </span>
                              )}
                            </span>
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>

                {searchable && normalizedOptions.length > 10 && (
                  <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50/80 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
                    <span>
                      {filteredOptions.length} of {normalizedOptions.length} options
                    </span>
                    <span>Enter to select</span>
                  </div>
                )}
              </AnimatedPopover>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
