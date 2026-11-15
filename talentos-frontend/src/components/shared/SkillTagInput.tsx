import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { MULTI_INDUSTRY_SKILLS_TAXONOMY } from '../../utils/skillsTaxonomy';

interface SkillTagInputProps {
  value: string;
  onChange: (nextCsv: string) => void;
  placeholder?: string;
}

export const mergeSkillCsv = (existingCsv: string, rawToAdd: string): string => {
  const existing = existingCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const additions = rawToAdd
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (additions.length === 0) return existing.join(', ');
  const seen = new Set(existing.map((t) => t.toLowerCase()));
  const merged = [...existing];
  for (const item of additions) {
    if (!seen.has(item.toLowerCase())) {
      seen.add(item.toLowerCase());
      merged.push(item);
    }
  }
  return merged.join(', ');
};

export const SkillTagInput: React.FC<SkillTagInputProps> = ({
  value,
  onChange,
  placeholder = 'Type skill & press Enter (or pick from suggestions)...',
}) => {
  const [skillInput, setSkillInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);

  const skillTags = useMemo(
    () =>
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [value]
  );

  const suggestions = useMemo(() => {
    const selectedSet = new Set(skillTags.map((t) => t.toLowerCase()));
    const available = MULTI_INDUSTRY_SKILLS_TAXONOMY.filter(
      (s) => !selectedSet.has(s.toLowerCase())
    );
    const q = skillInput.trim().toLowerCase();
    if (!q) return available.slice(0, 12);
    const startsWith: string[] = [];
    const contains: string[] = [];
    for (const s of available) {
      const lower = s.toLowerCase();
      if (lower.startsWith(q)) startsWith.push(s);
      else if (lower.includes(q)) contains.push(s);
    }
    return [...startsWith, ...contains].slice(0, 12);
  }, [skillInput, skillTags]);

  const handleAdd = (raw: string) => {
    if (!raw.trim()) return;
    onChange(mergeSkillCsv(value, raw));
    setSkillInput('');
    setHighlightedIdx(-1);
  };

  const handleRemove = (tagToRemove: string) => {
    const remaining = skillTags.filter((t) => t !== tagToRemove);
    onChange(remaining.join(', '));
  };

  return (
    <div className="space-y-1.5">
      {skillTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skillTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                aria-label={`Remove ${tag}`}
                className="text-slate-400 hover:text-rose-600 cursor-pointer inline-flex items-center"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative flex gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={skillInput}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            onChange={(e) => {
              setSkillInput(e.target.value);
              setShowSuggestions(true);
              setHighlightedIdx(-1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && suggestions.length > 0) {
                e.preventDefault();
                setShowSuggestions(true);
                setHighlightedIdx((prev) => (prev + 1) % suggestions.length);
              } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
                e.preventDefault();
                setHighlightedIdx((prev) =>
                  prev <= 0 ? suggestions.length - 1 : prev - 1
                );
              } else if (e.key === 'Escape') {
                setShowSuggestions(false);
                setHighlightedIdx(-1);
              } else if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                if (
                  e.key === 'Enter' &&
                  showSuggestions &&
                  highlightedIdx >= 0 &&
                  suggestions[highlightedIdx]
                ) {
                  handleAdd(suggestions[highlightedIdx]);
                } else {
                  handleAdd(skillInput);
                }
              }
            }}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:border-brand-600 focus:outline-none"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl p-2 max-h-48 overflow-y-auto">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1 pb-1.5">
                Suggested Skills ({suggestions.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={suggestion}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAdd(suggestion);
                    }}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                      idx === highlightedIdx
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-slate-50 hover:bg-brand-50 text-slate-700 hover:text-brand-700 border-slate-200 hover:border-brand-200'
                    }`}
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleAdd(skillInput)}
          className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer flex-shrink-0"
        >
          + Add
        </button>
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Java, Spring Boot, Kafka, AWS..."
        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-[11px] bg-white/80 text-slate-600 focus:border-brand-600 focus:outline-none"
      />
    </div>
  );
};
