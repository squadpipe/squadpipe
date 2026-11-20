import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Buildings,
  FileXls,
  Handshake,
  MagnifyingGlass,
  Users,
  X,
} from '@phosphor-icons/react';
import { apiClient } from '../../config/api.config';
import {
  BillablePlacement,
  Candidate,
  Client,
  Requirement,
  Vendor,
} from '../../types';
import {
  mapCandidateFromApi,
  mapClientFromApi,
  mapRequirementFromApi,
  mapVendorFromApi,
} from '../../utils/entityMappers';
import { useDebounce } from '../../utils/useDebounce';
import { AnimatedModal } from '../shared/MotionPrimitives';
import { StatusBadge } from '../shared/StatusBadge';

type SearchCategory =
  | 'All'
  | 'Requirements'
  | 'Consultants'
  | 'Placements'
  | 'Clients'
  | 'Vendors';

interface SearchResultItem {
  id: string;
  group: Exclude<SearchCategory, 'All'>;
  label: string;
  subtitle?: string;
  badge?: string;
  keywords: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

interface ServerSearchData {
  query: string;
  requirements: Requirement[];
  candidates: Candidate[];
  placements: BillablePlacement[];
  clients: Client[];
  vendors: Vendor[];
}

const EMPTY_SERVER_DATA: ServerSearchData = {
  query: '',
  requirements: [],
  candidates: [],
  placements: [],
  clients: [],
  vendors: [],
};

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirements: Requirement[];
  candidates: Candidate[];
  placements: BillablePlacement[];
  clients: Client[];
  vendors: Vendor[];
  mapPlacementFromApi?: (raw: any) => BillablePlacement;
  onSelectRequirement: (req: Requirement) => void;
  onSelectConsultant: (cand: Candidate) => void;
  onSelectPlacement: (placement: BillablePlacement) => void;
  onSelectClient: (client: Client) => void;
  onSelectVendor: (vendor: Vendor) => void;
}

/**
 * Unified Global Search modal (Cmd+K / Ctrl+K) searching across all database
 * requirements, consultants/resumes, billable placements, clients/contacts, and vendors.
 */
export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  requirements,
  candidates,
  placements,
  clients,
  vendors,
  mapPlacementFromApi,
  onSelectRequirement,
  onSelectConsultant,
  onSelectPlacement,
  onSelectClient,
  onSelectVendor,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('All');
  const [activeIdx, setActiveIdx] = useState(0);
  const [serverData, setServerData] = useState<ServerSearchData>(EMPTY_SERVER_DATA);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const effectiveQuery = query.trim() === '' ? '' : debouncedQuery.trim();
  const isWaitingDebounce = query.trim() !== '' && query.trim() !== debouncedQuery.trim();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCategory('All');
      setActiveIdx(0);
      setServerData(EMPTY_SERVER_DATA);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    let active = true;
    const q = effectiveQuery;
    setIsSearching(true);

    apiClient
      .get('/search', {
        params: {
          ...(q ? { q } : {}),
          limit: q ? 8 : 4,
        },
        signal: controller.signal,
      })
      .then((res) => {
        if (!active || !res.data?.data) return;
        const d = res.data.data;
        setServerData({
          query: q,
          requirements: Array.isArray(d.requirements)
            ? d.requirements.map(mapRequirementFromApi)
            : [],
          candidates: Array.isArray(d.candidates)
            ? d.candidates.map(mapCandidateFromApi)
            : [],
          placements:
            Array.isArray(d.placements) && mapPlacementFromApi
              ? d.placements.map(mapPlacementFromApi)
              : [],
          clients: Array.isArray(d.clients) ? d.clients.map(mapClientFromApi) : [],
          vendors: Array.isArray(d.vendors) ? d.vendors.map(mapVendorFromApi) : [],
        });
      })
      .catch(() => {
        // Fallback smoothly to cached records
      })
      .finally(() => {
        if (active) setIsSearching(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isOpen, effectiveQuery, mapPlacementFromApi]);

  const mergedPools = useMemo(() => {
    const dedupe = <T extends { id: string }>(primary: T[], fallback: T[]): T[] => {
      const seen = new Set<string>();
      const out: T[] = [];
      for (const item of primary) {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id);
          out.push(item);
        }
      }
      for (const item of fallback) {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id);
          out.push(item);
        }
      }
      return out;
    };

    return {
      requirements: dedupe(serverData.requirements, requirements),
      candidates: dedupe(serverData.candidates, candidates),
      placements: dedupe(serverData.placements, placements),
      clients: dedupe(serverData.clients, clients),
      vendors: dedupe(serverData.vendors, vendors),
    };
  }, [serverData, requirements, candidates, placements, clients, vendors]);

  const allItems = useMemo<SearchResultItem[]>(() => {
    const items: SearchResultItem[] = [];

    mergedPools.requirements.forEach((req) => {
      items.push({
        id: `req_${req.id}`,
        group: 'Requirements',
        label: `${req.code} — ${req.opportunityTitle}`,
        subtitle: `${req.companyName} · ${req.location || 'Remote'}`,
        badge: req.status,
        keywords: `${req.code} ${req.opportunityTitle} ${req.companyName} ${req.skillsRequired || ''} ${req.location || ''} ${req.clientContact || ''}`,
        icon: <Briefcase className="w-4 h-4 text-brand-600" />,
        onSelect: () => onSelectRequirement(req),
      });
    });

    mergedPools.candidates.forEach((c) => {
      items.push({
        id: `cand_${c.id}`,
        group: 'Consultants',
        label: c.fullName,
        subtitle: `${c.currentTitle || 'Consultant'}${c.workAuth ? ` · ${c.workAuth}` : ''}${c.email ? ` · ${c.email}` : ''}`,
        badge: c.pipelineStage,
        keywords: `${c.fullName} ${c.currentTitle || ''} ${c.email || ''} ${c.phone || ''} ${c.skillset || ''} ${c.workAuth || ''} ${c.vendorName || ''} ${c.rawSnippet || ''}`,
        icon: <Users className="w-4 h-4 text-slate-500" />,
        onSelect: () => onSelectConsultant(c),
      });
    });

    mergedPools.placements.forEach((p) => {
      items.push({
        id: `pl_${p.id}`,
        group: 'Placements',
        label: `${p.resourceName}${p.purchaseOrderNumber ? ` · ${p.purchaseOrderNumber}` : ''}`,
        subtitle: `${p.customer} · ${p.skillRole || p.deployment}`,
        badge: p.status,
        keywords: `${p.resourceName} ${p.customer} ${p.customerContact || ''} ${p.skillRole || ''} ${p.purchaseOrderNumber || ''} ${p.vendorName || ''} ${p.email || ''} ${p.phone || ''}`,
        icon: <FileXls className="w-4 h-4 text-emerald-600" />,
        onSelect: () => onSelectPlacement(p),
      });
    });

    mergedPools.clients.forEach((cl) => {
      const contactText = (cl.contacts || [])
        .map((cnt) => `${cnt.name || ''} ${cnt.email || ''} ${cnt.phone || ''} ${cnt.designation || ''}`)
        .join(' ');
      items.push({
        id: `client_${cl.id}`,
        group: 'Clients',
        label: cl.name,
        subtitle: cl.location || cl.website || cl.boardNumber || 'Client account',
        keywords: `${cl.name} ${cl.location || ''} ${cl.website || ''} ${cl.boardNumber || ''} ${contactText}`,
        icon: <Buildings className="w-4 h-4 text-slate-500" />,
        onSelect: () => onSelectClient(cl),
      });
    });

    mergedPools.vendors.forEach((v) => {
      const contactText = (v.contacts || [])
        .map((cnt) => `${cnt.fullName || ''} ${cnt.email || ''} ${cnt.phone || ''} ${cnt.designation || ''}`)
        .join(' ');
      items.push({
        id: `vendor_${v.id}`,
        group: 'Vendors',
        label: v.name,
        subtitle: v.skillSpecialization || v.location || v.paymentTerms || 'Staffing partner',
        badge: v.msa === 'Yes' || v.msa === 'Active' ? 'MSA Executed' : undefined,
        keywords: `${v.name} ${v.skillSpecialization || ''} ${v.location || ''} ${v.paymentTerms || ''} ${v.contactName || ''} ${v.email || ''} ${v.phone || ''} ${contactText}`,
        icon: <Handshake className="w-4 h-4 text-slate-500" />,
        onSelect: () => onSelectVendor(v),
      });
    });

    return items;
  }, [
    mergedPools,
    onSelectRequirement,
    onSelectConsultant,
    onSelectPlacement,
    onSelectClient,
    onSelectVendor,
  ]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    const serverIds = new Set<string>([
      ...serverData.requirements.map((r) => `req_${r.id}`),
      ...serverData.candidates.map((c) => `cand_${c.id}`),
      ...serverData.placements.map((p) => `pl_${p.id}`),
      ...serverData.clients.map((cl) => `client_${cl.id}`),
      ...serverData.vendors.map((v) => `vendor_${v.id}`),
    ]);

    const scoped = category === 'All' ? allItems : allItems.filter((item) => item.group === category);
    if (tokens.length === 0) {
      const groups: Array<Exclude<SearchCategory, 'All'>> = [
        'Requirements',
        'Consultants',
        'Placements',
        'Clients',
        'Vendors',
      ];
      const out: SearchResultItem[] = [];
      for (const g of groups) {
        out.push(...scoped.filter((i) => i.group === g).slice(0, category === 'All' ? 3 : 8));
      }
      return out.slice(0, 18);
    }

    return scoped
      .filter((item) => {
        if (serverIds.has(item.id) && query.trim() === serverData.query) {
          return true;
        }
        const hay = `${item.label} ${item.subtitle || ''} ${item.keywords}`.toLowerCase();
        return tokens.every((tok) => hay.includes(tok));
      })
      .slice(0, 24);
  }, [allItems, category, query, serverData]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, category]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((prev) => (filteredItems.length ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((prev) =>
        filteredItems.length ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
      );
    } else if (e.key === 'Enter' && filteredItems[activeIdx]) {
      e.preventDefault();
      const target = filteredItems[activeIdx];
      onClose();
      target.onSelect();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';
  const categories: SearchCategory[] = [
    'All',
    'Requirements',
    'Consultants',
    'Placements',
    'Clients',
    'Vendors',
  ];

  return (
    <AnimatedModal
      isOpen={isOpen}
      onBackdropClick={onClose}
      zIndexClass="z-[75]"
      backdropClassName="bg-slate-900/50 backdrop-blur-[2px] flex items-start justify-center pt-[10vh] p-4"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[75vh]"
      ariaLabel="Global Search"
    >
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5 bg-white">
        <MagnifyingGlass className="w-4 h-4 text-brand-600 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search anything — requirements, consultants, resumes, placements, clients, vendors..."
          className="flex-1 text-xs text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
        />
        {(isSearching || isWaitingDebounce) && (
          <span className="text-[11px] text-slate-400 font-medium shrink-0">Searching...</span>
        )}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search query"
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-500 shrink-0">
          ESC
        </kbd>
      </div>

      {/* Category Filter Strip */}
      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {categories.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                active
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate-600 border-slate-200/90 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="overflow-y-auto p-2 space-y-0.5 flex-1">
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            {isSearching
              ? 'Searching workspace records...'
              : query.trim()
                ? <>No matching records found for &ldquo;{query}&rdquo;.</>
                : 'Type a name, skill, requirement code, PO number, email, phone, or keyword.'}
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const showGroupHeader = item.group !== lastGroup;
            lastGroup = item.group;
            const isSelected = idx === activeIdx;
            return (
              <React.Fragment key={item.id}>
                {showGroupHeader && (
                  <div className="px-2.5 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {item.group}
                  </div>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => {
                    onClose();
                    item.onSelect();
                  }}
                  className={`w-full px-2.5 py-2 rounded-lg text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-900 truncate">
                        {item.label}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-slate-400 truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && <StatusBadge stage={item.badge} size="xs" />}
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                </button>
              </React.Fragment>
            );
          })
        )}
      </div>

      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-[11px] text-slate-400">
        <span>
          {query.trim()
            ? `${filteredItems.length} result${filteredItems.length === 1 ? '' : 's'} across workspace data`
            : 'Recent records · Type to search all records'}
        </span>
        <span>↑↓ to navigate · Enter to open · ⌘K</span>
      </div>
    </AnimatedModal>
  );
};
