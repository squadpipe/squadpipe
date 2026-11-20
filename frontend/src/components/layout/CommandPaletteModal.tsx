import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Buildings,
  ChartPieSlice,
  Columns,
  Envelope,
  FileText,
  FileXls,
  Handshake,
  Kanban,
  Lightning,
  MagnifyingGlass,
  Plus,
  SlidersHorizontal,
  UploadSimple,
  Users,
} from '@phosphor-icons/react';
import { Candidate, Client, Requirement, Vendor } from '../../types';
import { AnimatedModal } from '../shared/MotionPrimitives';
import { StatusBadge } from '../shared/StatusBadge';

interface CommandItem {
  id: string;
  group: 'Quick Actions' | 'Pages' | 'Requirements' | 'Consultants' | 'Clients' | 'Vendors';
  label: string;
  subtitle?: string;
  badge?: string;
  keywords: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  canManageDataOperations: boolean;
  canCreatePlacement: boolean;
  requirements: Requirement[];
  candidates: Candidate[];
  clients: Client[];
  vendors: Vendor[];
  onNavigate: (view: string) => void;
  onOpenWorkflowPage: (
    view:
      | 'requirement_new'
      | 'consultant_new'
      | 'requirement_from_email'
      | 'import_resume'
      | 'import_csv'
      | 'placement_new'
  ) => void;
  onOpenCreateModal: (type: 'client' | 'vendor') => void;
  onSelectRequirement: (req: Requirement) => void;
  onSelectConsultant: (cand: Candidate) => void;
  onSelectClient: (client: Client) => void;
  onSelectVendor: (vendor: Vendor) => void;
}

/**
 * Global Cmd+K / Ctrl+K Command Palette for rapid page switching, record creation,
 * and instant jump-to Consultant, Requirement, Client, or Vendor lookup.
 */
export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  canManageDataOperations,
  canCreatePlacement,
  requirements,
  candidates,
  clients,
  vendors,
  onNavigate,
  onOpenWorkflowPage,
  onOpenCreateModal,
  onSelectRequirement,
  onSelectConsultant,
  onSelectClient,
  onSelectVendor,
}) => {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const allItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        id: 'act_req_new',
        group: 'Quick Actions',
        label: 'New Requirement',
        subtitle: 'Create an open client requisition',
        keywords: 'create add requirement job req order',
        icon: <Plus className="w-4 h-4 text-brand-600" />,
        onSelect: () => onOpenWorkflowPage('requirement_new'),
      },
      {
        id: 'act_cand_new',
        group: 'Quick Actions',
        label: 'New Consultant',
        subtitle: 'Register a consultant profile into roster',
        keywords: 'create add consultant candidate bench talent',
        icon: <Plus className="w-4 h-4 text-brand-600" />,
        onSelect: () => onOpenWorkflowPage('consultant_new'),
      },
      {
        id: 'act_req_email',
        group: 'Quick Actions',
        label: 'Create Job from Client Email',
        subtitle: 'Parse hiring manager email into requirement',
        keywords: 'parse email import jd requirement',
        icon: <Envelope className="w-4 h-4 text-slate-500" />,
        onSelect: () => onOpenWorkflowPage('requirement_from_email'),
      },
      ...(canCreatePlacement
        ? [
            {
              id: 'act_placement_new',
              group: 'Quick Actions' as const,
              label: 'New Billable Placement',
              subtitle: 'Activate SOW and bill/pay spread',
              keywords: 'placement billable sow margin contract',
              icon: <FileXls className="w-4 h-4 text-emerald-600" />,
              onSelect: () => onOpenWorkflowPage('placement_new'),
            },
          ]
        : []),
      {
        id: 'act_parse_resume',
        group: 'Quick Actions',
        label: 'Parse Resumes (Single or Bulk)',
        subtitle: 'Upload PDF/DOCX CVs to add candidates',
        keywords: 'resume cv upload parse pdf docx',
        icon: <UploadSimple className="w-4 h-4 text-slate-500" />,
        onSelect: () => onOpenWorkflowPage('import_resume'),
      },
      ...(canManageDataOperations
        ? [
            {
              id: 'act_csv_import',
              group: 'Quick Actions' as const,
              label: 'Import Spreadsheet Candidates',
              subtitle: 'CSV / Excel bulk candidate migration',
              keywords: 'csv excel spreadsheet bulk import',
              icon: <FileXls className="w-4 h-4 text-slate-500" />,
              onSelect: () => onOpenWorkflowPage('import_csv'),
            },
          ]
        : []),
      {
        id: 'act_client_new',
        group: 'Quick Actions',
        label: 'New Client Account',
        subtitle: 'Quick modal to add an account',
        keywords: 'add client company account',
        icon: <Buildings className="w-4 h-4 text-slate-500" />,
        onSelect: () => onOpenCreateModal('client'),
      },
      {
        id: 'act_vendor_new',
        group: 'Quick Actions',
        label: 'New Staffing Vendor',
        subtitle: 'Quick modal to add a C2C partner',
        keywords: 'add vendor supplier partner',
        icon: <Handshake className="w-4 h-4 text-slate-500" />,
        onSelect: () => onOpenCreateModal('vendor'),
      },
      // Core Pages
      {
        id: 'nav_dashboard',
        group: 'Pages',
        label: 'Dashboard',
        keywords: 'home overview kpi metrics dashboard',
        icon: <ChartPieSlice className="w-4 h-4 text-slate-500" />,
        onSelect: () => onNavigate('dashboard'),
      },
      {
        id: 'nav_pipeline',
        group: 'Pages',
        label: 'Pipeline',
        keywords: 'kanban board requirements orders pipeline',
        icon: <Kanban className="w-4 h-4 text-slate-500" />,
        onSelect: () => onNavigate('pipeline'),
      },
      {
        id: 'nav_consultants',
        group: 'Pages',
        label: 'Consultants',
        keywords: 'roster candidates talent bench consultants',
        icon: <Users className="w-4 h-4 text-slate-500" />,
        onSelect: () => onNavigate('consultants'),
      },
      {
        id: 'nav_clients',
        group: 'Pages',
        label: 'Clients',
        keywords: 'clients accounts companies',
        icon: <Buildings className="w-4 h-4 text-slate-500" />,
        onSelect: () => onNavigate('clients'),
      },
      {
        id: 'nav_vendors',
        group: 'Pages',
        label: 'Vendors',
        keywords: 'vendors partners c2c suppliers',
        icon: <Handshake className="w-4 h-4 text-slate-500" />,
        onSelect: () => onNavigate('vendors'),
      },
      {
        id: 'nav_billable',
        group: 'Pages',
        label: 'Billable Consultants',
        keywords: 'billable placements revenue active billing',
        icon: <FileXls className="w-4 h-4 text-slate-500" />,
        onSelect: () => onNavigate('billable'),
      },
      {
        id: 'nav_automation',
        group: 'Pages',
        label: 'Smart Reminders',
        keywords: 'automations sla alerts reminders',
        icon: <Lightning className="w-4 h-4 text-slate-500" />,
        onSelect: () => onNavigate('automation'),
      },
      ...(isAdmin
        ? [
            {
              id: 'nav_forms',
              group: 'Pages' as const,
              label: 'Application Forms',
              keywords: 'public application forms builder templates',
              icon: <FileText className="w-4 h-4 text-slate-500" />,
              onSelect: () => onNavigate('application_forms'),
            },
            {
              id: 'nav_custom_fields',
              group: 'Pages' as const,
              label: 'Custom Form Fields',
              keywords: 'custom fields attributes schema',
              icon: <Columns className="w-4 h-4 text-slate-500" />,
              onSelect: () => onNavigate('custom_fields'),
            },
            {
              id: 'nav_settings',
              group: 'Pages' as const,
              label: 'General Settings',
              keywords: 'settings branding policies workspace',
              icon: <SlidersHorizontal className="w-4 h-4 text-slate-500" />,
              onSelect: () => onNavigate('settings_general'),
            },
          ]
        : []),
    ];

    requirements.forEach((req) => {
      items.push({
        id: `req_${req.id}`,
        group: 'Requirements',
        label: `${req.code} — ${req.opportunityTitle}`,
        subtitle: `${req.companyName} · ${req.location || 'Remote'}`,
        badge: req.status,
        keywords: `${req.code} ${req.opportunityTitle} ${req.companyName} ${req.skillsRequired}`,
        icon: <Briefcase className="w-4 h-4 text-brand-600" />,
        onSelect: () => onSelectRequirement(req),
      });
    });

    candidates.forEach((c) => {
      items.push({
        id: `cand_${c.id}`,
        group: 'Consultants',
        label: c.fullName,
        subtitle: `${c.currentTitle || 'Consultant'}${c.workAuth ? ` · ${c.workAuth}` : ''}`,
        badge: c.pipelineStage,
        keywords: `${c.fullName} ${c.currentTitle} ${c.email} ${c.skillset} ${c.workAuth}`,
        icon: <Users className="w-4 h-4 text-slate-500" />,
        onSelect: () => onSelectConsultant(c),
      });
    });

    clients.forEach((cl) => {
      items.push({
        id: `client_${cl.id}`,
        group: 'Clients',
        label: cl.name,
        subtitle: cl.location || cl.website || 'Client account',
        keywords: `${cl.name} ${cl.location} ${cl.website || ''}`,
        icon: <Buildings className="w-4 h-4 text-slate-500" />,
        onSelect: () => onSelectClient(cl),
      });
    });

    vendors.forEach((v) => {
      items.push({
        id: `vendor_${v.id}`,
        group: 'Vendors',
        label: v.name,
        subtitle: v.skillSpecialization || v.location || 'Staffing partner',
        keywords: `${v.name} ${v.skillSpecialization} ${v.location} ${v.paymentTerms}`,
        icon: <Handshake className="w-4 h-4 text-slate-500" />,
        onSelect: () => onSelectVendor(v),
      });
    });

    return items;
  }, [
    isAdmin,
    canManageDataOperations,
    canCreatePlacement,
    requirements,
    candidates,
    clients,
    vendors,
    onNavigate,
    onOpenWorkflowPage,
    onOpenCreateModal,
    onSelectRequirement,
    onSelectConsultant,
    onSelectClient,
    onSelectVendor,
  ]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [
        ...allItems.filter((i) => i.group === 'Quick Actions').slice(0, 6),
        ...allItems.filter((i) => i.group === 'Pages').slice(0, 6),
      ];
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    return allItems
      .filter((item) => {
        const hay = `${item.label} ${item.subtitle || ''} ${item.keywords}`.toLowerCase();
        return tokens.every((tok) => hay.includes(tok));
      })
      .slice(0, 14);
  }, [allItems, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

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

  return (
    <AnimatedModal
      isOpen={isOpen}
      onBackdropClick={onClose}
      zIndexClass="z-[75]"
      backdropClassName="bg-slate-900/50 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] p-4"
      panelClassName="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[70vh]"
      ariaLabel="Master Search"
    >
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2.5 bg-white">
        <MagnifyingGlass className="w-4 h-4 text-brand-600 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Master search: requirements, consultants, clients, vendors, or pages..."
          className="flex-1 text-xs text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
        />
        <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-500">
          ESC
        </kbd>
      </div>

      <div className="overflow-y-auto p-2 space-y-0.5 flex-1">
        {filteredItems.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No matching actions or records found for &ldquo;{query}&rdquo;.
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const showGroupHeader = item.group !== lastGroup;
            lastGroup = item.group;
            const isSelected = idx === activeIdx;
            return (
              <React.Fragment key={item.id}>
                {showGroupHeader && (
                  <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-slate-400">
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

      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-400">
        <span>Navigate with ↑↓ · Enter to open</span>
        <span>⌘K to toggle</span>
      </div>
    </AnimatedModal>
  );
};
