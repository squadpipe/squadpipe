import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { AnimatedPopover } from './MotionPrimitives';

export interface SearchableSelectOption {
  id?: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectInputProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  newOptionBadge?: string;
  required?: boolean;
  wrapperClassName?: string;
  inputClassName?: string;
}

/**
 * Custom styled searchable combobox replacing native HTML <datalist> popups.
 */
export const SearchableSelectInput: React.FC<SearchableSelectInputProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select or type...',
  emptyLabel = 'No matching options',
  newOptionBadge = 'New',
  required = false,
  wrapperClassName = 'mt-0.5',
  inputClassName = 'w-full pl-2.5 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:border-brand-600 focus:outline-none',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterActive, setFilterActive] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFilterActive(false);
        setHighlightedIdx(-1);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setFilterActive(false);
        setHighlightedIdx(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Deduplicate options by trimmed lowercase label
  const uniqueOptions: SearchableSelectOption[] = [];
  const seen = new Set<string>();
  for (const opt of options) {
    const clean = (opt.label || '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueOptions.push({ ...opt, label: clean });
    }
  }

  const query = filterActive ? value.trim().toLowerCase() : '';
  const filteredOptions = query
    ? uniqueOptions.filter(
        (opt) =>
          opt.label.toLowerCase().includes(query) ||
          (opt.sublabel && opt.sublabel.toLowerCase().includes(query))
      )
    : uniqueOptions;

  const exactMatch = uniqueOptions.some(
    (opt) => opt.label.toLowerCase() === value.trim().toLowerCase()
  );
  const hasNewOption = Boolean(value.trim() && !exactMatch);
  const totalMenuCount = filteredOptions.length + (hasNewOption ? 1 : 0);

  const selectValueAndClose = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
    setFilterActive(false);
    setHighlightedIdx(-1);
  };

  return (
    <div ref={containerRef} className={`relative ${wrapperClassName}`}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          required={required}
          onFocus={() => {
            setIsOpen(true);
            setFilterActive(false);
            setHighlightedIdx(-1);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setFilterActive(true);
            setHighlightedIdx(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && totalMenuCount > 0) {
              e.preventDefault();
              setIsOpen(true);
              setHighlightedIdx((prev) => (prev + 1) % totalMenuCount);
            } else if (e.key === 'ArrowUp' && totalMenuCount > 0) {
              e.preventDefault();
              setIsOpen(true);
              setHighlightedIdx((prev) => (prev <= 0 ? totalMenuCount - 1 : prev - 1));
            } else if (e.key === 'Enter' && isOpen) {
              if (highlightedIdx >= 0 && highlightedIdx < filteredOptions.length) {
                e.preventDefault();
                selectValueAndClose(filteredOptions[highlightedIdx].label);
              } else if (hasNewOption) {
                e.preventDefault();
                selectValueAndClose(value.trim());
              } else if (filteredOptions.length === 1 && filterActive) {
                e.preventDefault();
                selectValueAndClose(filteredOptions[0].label);
              }
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={inputClassName}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setIsOpen((prev) => !prev);
            setFilterActive(false);
            setHighlightedIdx(-1);
          }}
          aria-label="Toggle options"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180 text-brand-600' : ''}`}
          />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <AnimatedPopover
            key="searchable-select-popover"
            className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1 max-h-48 overflow-y-auto z-50"
          >
          {filteredOptions.length === 0 && !value.trim() ? (
            <div className="px-3 py-2 text-[11px] text-slate-400 text-center">
              {emptyLabel}
            </div>
          ) : (
            <>
              {filteredOptions.map((opt, idx) => {
                const isSelected = value.trim().toLowerCase() === opt.label.toLowerCase();
                const isHighlighted = idx === highlightedIdx;
                return (
                  <button
                    key={opt.id || opt.label}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectValueAndClose(opt.label);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-brand-50/70 text-brand-700'
                        : isHighlighted
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs truncate ${isSelected ? 'font-bold' : 'font-semibold'}`}>
                        {opt.label}
                      </div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />}
                  </button>
                );
              })}

              {hasNewOption && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectValueAndClose(value.trim());
                  }}
                  className={`w-full px-3 py-2 text-left border-t border-slate-100 text-[11px] font-semibold flex items-center justify-between gap-2 cursor-pointer ${
                    highlightedIdx === filteredOptions.length
                      ? 'bg-brand-100/70 text-brand-800'
                      : 'bg-brand-50/60 text-brand-700 hover:bg-brand-50'
                  }`}
                >
                  <span className="truncate inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                    <span className="truncate">&ldquo;{value.trim()}&rdquo;</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-brand-200 text-brand-700 font-medium flex-shrink-0">
                    {newOptionBadge}
                  </span>
                </button>
              )}
            </>
          )}
          </AnimatedPopover>
        )}
      </AnimatePresence>
    </div>
  );
};

