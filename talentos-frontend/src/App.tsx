import React, { useState, useEffect } from 'react';
import { apiClient } from './config/api.config';
import { formatRateDisplay, getCurrencySymbol, initWorkspaceCurrency } from './utils/currency';

import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { SlaDrawer } from './components/layout/SlaDrawer';

// Feature Views
import { DashboardView } from './features/dashboard/DashboardView';
import { PipelineView } from './features/pipeline/PipelineView';
import { ConsultantsView } from './features/consultants/ConsultantsView';
import { ClientsView } from './features/clients/ClientsView';
import { VendorsView } from './features/vendors/VendorsView';
import { BillablePlacementsView } from './features/billable/BillablePlacementsView';
import { UserManagementView } from './features/user-management/UserManagementView';
import { CustomFieldsView } from './features/custom-fields/CustomFieldsView';
import { AutomationsView } from './features/automations/AutomationsView';
import { ImportDataView } from './features/import-data/ImportDataView';
import { SettingsView } from './features/settings/SettingsView';

// Auth View
import { LoginView } from './features/auth/LoginView';

// Modals
import { ResumeParserModal } from './features/modals/ResumeParserModal';
import { EmailParserModal } from './features/modals/EmailParserModal';
import { SkillMatcherModal } from './features/modals/SkillMatcherModal';
import { SubmissionPitchModal } from './features/modals/SubmissionPitchModal';
import { PlacementWizardModal } from './features/modals/PlacementWizardModal';
import { AddConsultantModal } from './components/modals/create/AddConsultantModal';
import { AddRequirementModal } from './components/modals/create/AddRequirementModal';
import { AddClientModal } from './components/modals/create/AddClientModal';
import { AddVendorModal } from './components/modals/create/AddVendorModal';
import { AddPlacementModal } from './components/modals/create/AddPlacementModal';
import { SignOutModal } from './components/modals/SignOutModal';
import { ProfileModal } from './components/modals/ProfileModal';
import { ResumeViewerModal } from './components/modals/ResumeViewerModal';
import { RequirementDetailModal } from './components/modals/RequirementDetailModal';

import {
  Candidate,
  Requirement,
  Client,
  Vendor,
  BillablePlacement,
  User,
  SlaTask,
  AutomationRule,
  AutomationAuditLog,
  CustomField,
} from './types';

const formatCandidateStage = (stage?: string): string => {
  const map: Record<string, string> = {
    AVAILABLE_BENCH: 'Available / Bench',
    SUBMITTED: 'Submitted',
    INTERVIEW: 'Interview',
    SELECTED: 'Selected',
    ONBOARDING: 'Onboarding',
    BILLABLE: 'Billable',
    ARCHIVED: 'Archived',
  };
  return (stage && map[stage]) || stage || 'Available / Bench';
};

const formatRequirementStatus = (status?: string): Requirement['status'] => {
  const map: Record<string, Requirement['status']> = {
    REQUIREMENT: 'Requirement',
    SUBMITTED: 'Submitted',
    INTERVIEW: 'Interview',
    SELECTED: 'Selected',
    ONBOARDING: 'Onboarding',
    CLOSED: 'Onboarding',
  };
  return (status && map[status]) || (status as Requirement['status']) || 'Requirement';
};

const formatUserRole = (role?: string): string => {
  const map: Record<string, string> = {
    ADMINISTRATOR: 'Administrator',
    SENIOR_RECRUITER: 'Senior Recruiter',
    TECHNICAL_RECRUITER: 'Technical Recruiter',
    BENCH_SALES_LEAD: 'Bench Sales Lead',
    ACCOUNT_EXECUTIVE: 'Account Executive',
    ASSOCIATE_RECRUITER: 'Associate Recruiter',
  };
  return (role && map[role]) || role || 'Technical Recruiter';
};

const formatUserStatus = (status?: string): User['status'] => {
  const map: Record<string, User['status']> = {
    ACTIVE: 'Active',
    SUSPENDED: 'Suspended',
    INVITED: 'Invited',
  };
  return (status && map[status]) || (status as User['status']) || 'Active';
};

const safeIsoDate = (val: any, fallback = ''): string => {
  if (!val || (typeof val !== 'string' && typeof val !== 'number' && !(val instanceof Date))) {
    return fallback;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d.toISOString().split('T')[0];
};

const normalizePlacement = (p: any): BillablePlacement => {
  const depRaw = String(p.deployment || 'Onshore').toUpperCase();
  const deployment =
    depRaw === 'OFFSHORE'
      ? 'Offshore'
      : depRaw === 'NEARSHORE'
      ? 'Nearshore'
      : depRaw === 'ONSHORE'
      ? 'Onshore'
      : p.deployment || 'Onshore';

  const typeRaw = String(p.placementType || 'C2C Subcontractor').toUpperCase();
  const placementType =
    typeRaw === 'W2_HOURLY'
      ? 'W2 Hourly'
      : typeRaw === 'TEN_NINETY_NINE'
      ? '1099'
      : typeRaw === 'FULL_TIME'
      ? 'Full-Time'
      : typeRaw === 'C2C_SUBCONTRACTOR'
      ? 'C2C Subcontractor'
      : p.placementType || 'C2C Subcontractor';

  const statusRaw = String(p.status || 'Active').toUpperCase().replace(/\s+/g, '_');
  const statusMap: Record<string, BillablePlacement['status']> = {
    ACTIVE: 'Active',
    EXTENDED: 'Extended',
    EXPIRING_SOON: 'Expiring Soon',
    COMPLETED: 'Completed',
    TERMINATED: 'Terminated',
  };
  const status = statusMap[statusRaw] || 'Active';

  const parseNum = (val: any): number => {
    const n = parseFloat(String(val ?? '').replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const sym = getCurrencySymbol();
  let billing = '';
  if (typeof p.billing === 'string' && p.billing.trim()) {
    const num = parseNum(p.billing);
    billing = /(?:A\$|S\$|[$£€₹])/.test(p.billing) ? formatRateDisplay(p.billing.trim(), sym) : num > 0 ? `${sym}${num}/hr` : p.billing.trim();
  } else if (p.billRate !== undefined && p.billRate !== null && p.billRate !== '') {
    billing = `${sym}${parseNum(p.billRate)}/hr`;
  }

  let payRate = '';
  if (typeof p.payRate === 'string' && /(?:A\$|S\$|[$£€₹])/.test(p.payRate)) {
    payRate = formatRateDisplay(p.payRate.trim(), sym);
  } else if (p.payRate !== undefined && p.payRate !== null && p.payRate !== '') {
    payRate = `${sym}${parseNum(p.payRate)}/hr`;
  } else if (p.payRateAmount !== undefined && p.payRateAmount !== null && p.payRateAmount !== '') {
    payRate = `${sym}${parseNum(p.payRateAmount)}/hr`;
  }

  const billNum = parseNum(billing || p.billRate);
  const payNum = parseNum(payRate || p.payRateAmount);
  const computedSpread = billNum - payNum;
  const computedMargin = billNum > 0 ? parseFloat(((computedSpread / billNum) * 100).toFixed(2)) : 0;

  return {
    id: p.id,
    recruiter:
      p.recruiter?.fullName ||
      p.recruiter?.name ||
      (typeof p.recruiter === 'string' ? p.recruiter : ''),
    deployment,
    customer: p.customer || p.client?.name || '',
    customerContact:
      p.customerContact?.fullName ||
      p.customerContact?.name ||
      (typeof p.customerContact === 'string' ? p.customerContact : ''),
    resourceName:
      p.resourceName ||
      p.candidate?.fullName ||
      p.candidate?.name ||
      (typeof p.candidate === 'string' ? p.candidate : ''),
    phone: p.phone || p.candidate?.phone || '',
    email: p.email || p.candidate?.email || '',
    skillRole: p.skillRole || '',
    startDate: safeIsoDate(p.startDate),
    endDate: safeIsoDate(p.endDate),
    billing,
    payRate,
    placementType,
    hourlySpread:
      p.hourlySpread !== undefined && p.hourlySpread !== null ? Number(p.hourlySpread) : computedSpread,
    marginPct:
      p.marginPct !== undefined && p.marginPct !== null ? Number(p.marginPct) : computedMargin,
    status,
    purchaseOrderNumber: p.purchaseOrderNumber || '',
    vendorName: p.vendor?.name || p.vendorName || '',
    candidateId: p.candidateId || p.candidate?.id || undefined,
    requirementId: p.requirementId || undefined,
    clientId: p.clientId || p.client?.id || undefined,
    vendorId: p.vendorId || p.vendor?.id || undefined,
  };
};

export const App: React.FC = () => {
  // Session / Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved =
        localStorage.getItem('talentos_current_user') ||
        sessionStorage.getItem('talentos_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authToken, setAuthToken] = useState<string | null>(() => {
    return (
      localStorage.getItem('talentos_access_token') ||
      sessionStorage.getItem('talentos_access_token')
    );
  });

  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [rateMasked, setRateMasked] = useState<boolean>(() => currentUser?.rateMasked ?? false);
  const [isSlaOpen, setIsSlaOpen] = useState<boolean>(false);

  // Modals visibility
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isMatcherModalOpen, setIsMatcherModalOpen] = useState(false);
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);
  const [isPlacementWizardOpen, setIsPlacementWizardOpen] = useState(false);
  const [activeCreateModal, setActiveCreateModal] = useState<
    'consultant' | 'requirement' | 'client' | 'vendor' | 'placement' | null
  >(null);

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedResumeCand, setSelectedResumeCand] = useState<Candidate | null>(null);
  const [selectedReqForDetail, setSelectedReqForDetail] = useState<Requirement | null>(null);

  // Selected items for context modals
  const [activeReq, setActiveReq] = useState<Requirement | null>(null);
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);

  // Toast Notification state
  const [toast, setToast] = useState<{ title: string; message: string; icon?: string } | null>(
    null
  );

  const showToast = (
    title: string,
    message: string,
    icon = 'fa-solid fa-circle-check text-emerald-500'
  ) => {
    setToast({ title, message, icon });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Dynamic State Stores (Loaded from TalentOS Backend API)
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [placements, setPlacements] = useState<BillablePlacement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [slaTasks, setSlaTasks] = useState<SlaTask[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [auditLogs, setAuditLogs] = useState<AutomationAuditLog[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Sidebar counts (lightweight navigation metadata)
  const [sidebarCounts, setSidebarCounts] = useState({
    requirements: 0,
    consultants: 0,
    clients: 0,
    vendors: 0,
    billable: 0,
    users: 0,
    customFields: 0,
    activeRules: 0,
  });

  // Track loaded entities to support view-scoped lazy loading without duplicate requests
  const loadedEntities = React.useRef<Set<string>>(new Set());

  const resetWorkspaceState = () => {
    loadedEntities.current.clear();
    setCandidates([]);
    setRequirements([]);
    setClients([]);
    setVendors([]);
    setPlacements([]);
    setUsers([]);
    setSlaTasks([]);
    setRules([]);
    setAuditLogs([]);
    setCustomFields([]);
    setSidebarCounts({
      requirements: 0,
      consultants: 0,
      clients: 0,
      vendors: 0,
      billable: 0,
      users: 0,
      customFields: 0,
      activeRules: 0,
    });
  };

  // Dedicated, view-scoped fetch functions
  const fetchSidebarCounts = async () => {
    try {
      const res = await apiClient.get('/sidebar/counts');
      if (res.data?.success && res.data?.data) {
        setSidebarCounts((prev) => ({ ...prev, ...res.data.data }));
      }
    } catch {
      // Graceful fallback to local counts
    }
  };

  const fetchCandidates = async () => {
    try {
      const res = await apiClient.get('/candidates');
      if (res.data?.data) {
        const raw = res.data.data;
        const mapped = raw.map((c: any) => ({
          id: c.id,
          fullName: c.fullName || '',
          phone: c.phone || '',
          email: c.email || '',
          workAuth: c.workAuth || '',
          education: c.education || '',
          currentTitle: c.currentTitle || '',
          skillset: c.skillset || '',
          hourlyRate: formatRateDisplay(c.hourlyRateDisplay || (c.hourlyRateW2 ? `${getCurrencySymbol()}${c.hourlyRateW2}/hr (W2)` : '')),
          relocation: c.relocation || 'Yes',
          resumeName: c.resumeFileName || '',
          resumeFormat: c.resumeFormat || 'PDF',
          assignedRecruiter: c.assignedRecruiter?.fullName || c.assignedRecruiter || '',
          pipelineStage: formatCandidateStage(c.pipelineStage),
          rawSnippet: c.rawSnippet || '',
        }));
        setCandidates(mapped);
        setSidebarCounts((prev) => ({ ...prev, consultants: mapped.length }));
        loadedEntities.current.add('candidates');
      }
    } catch (e) {
      console.warn('API fetch candidates:', e);
    }
  };

  const fetchRequirements = async () => {
    try {
      const res = await apiClient.get('/requirements');
      if (res.data?.data) {
        const raw = res.data.data;
        const mapped = raw.map((r: any) => ({
          id: r.id,
          code: r.code || '',
          companyName: r.companyName || r.client?.name || '',
          opportunityTitle: r.opportunityTitle || '',
          location: r.location || '',
          clientContact:
            r.clientContact?.fullName ||
            r.clientContact?.name ||
            (typeof r.clientContact === 'string' ? r.clientContact : ''),
          clientContactTitle:
            r.clientContact?.designation ||
            (typeof r.clientContactTitle === 'string' ? r.clientContactTitle : ''),
          skillsRequired: r.skillsRequired || '',
          status: formatRequirementStatus(r.status),
          resourceName: r.resourceName || r.submissions?.[0]?.candidate?.fullName || '',
          assignedRecruiter:
            r.assignedRecruiter?.fullName ||
            r.assignedRecruiter?.name ||
            (typeof r.assignedRecruiter === 'string' ? r.assignedRecruiter : ''),
          targetBillRate: r.targetBillRate,
          targetPayRate: r.targetPayRate,
          createdAt: safeIsoDate(r.createdAt, new Date().toISOString().split('T')[0]),
        }));
        setRequirements(mapped);
        setSidebarCounts((prev) => ({ ...prev, requirements: mapped.length }));
        loadedEntities.current.add('requirements');
      }
    } catch (e) {
      console.warn('API fetch requirements:', e);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await apiClient.get('/clients');
      if (res.data?.data) {
        const raw = res.data.data;
        const mapped = raw.map((cl: any) => ({
          id: cl.id,
          name: cl.name || '',
          website: cl.website || '',
          boardNumber: cl.boardNumber || '',
          location: cl.location || '',
          contacts: (cl.contacts || []).map((cnt: any) => ({
            name: cnt.fullName || cnt.name || '',
            designation: cnt.designation || '',
            phone: cnt.phone || '',
            email: cnt.email || '',
            isPrimary: cnt.isPrimary ?? false,
          })),
        }));
        setClients(mapped);
        setSidebarCounts((prev) => ({ ...prev, clients: mapped.length }));
        loadedEntities.current.add('clients');
      }
    } catch (e) {
      console.warn('API fetch clients:', e);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await apiClient.get('/vendors');
      if (res.data?.data) {
        const raw = res.data.data;
        const mapped = raw.map((v: any) => ({
          id: v.id,
          name: v.name || '',
          contactName: v.contactName || '',
          phone: v.phone || '',
          email: v.email || '',
          location: v.location || '',
          skillSpecialization: v.skillSpecialization || '',
          paymentTerms: v.paymentTerms || '',
          invoicingTerms: v.invoicingTerms || '',
          msa: v.msaSigned ? 'Active' : v.msa || 'Pending',
        }));
        setVendors(mapped);
        setSidebarCounts((prev) => ({ ...prev, vendors: mapped.length }));
        loadedEntities.current.add('vendors');
      }
    } catch (e) {
      console.warn('API fetch vendors:', e);
    }
  };

  const fetchPlacements = async () => {
    try {
      const res = await apiClient.get('/placements');
      if (res.data?.data) {
        const mapped = res.data.data.map(normalizePlacement);
        setPlacements(mapped);
        setSidebarCounts((prev) => ({ ...prev, billable: mapped.length }));
        loadedEntities.current.add('placements');
      }
    } catch (e) {
      console.warn('API fetch placements:', e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get('/users');
      if (res.data?.data) {
        const raw = res.data.data;
        const mapped = raw.map((u: any) => ({
          id: u.id,
          name: u.fullName || u.name || '',
          email: u.email || '',
          role: formatUserRole(u.role),
          desk: u.desk || '',
          rateMasked: u.rateMasked ?? true,
          workload: u.workload || '',
          status: formatUserStatus(u.status),
          isCurrentUser: u.isCurrentUser ?? false,
          lastActive: u.lastActive || 'Active Now',
        }));
        setUsers(mapped);
        setSidebarCounts((prev) => ({ ...prev, users: mapped.length }));
        loadedEntities.current.add('users');
      }
    } catch (e) {
      console.warn('API fetch users:', e);
    }
  };

  const fetchSlaTasks = async () => {
    try {
      const res = await apiClient.get('/sla-tasks');
      if (res.data?.data) {
        const raw = res.data.data;
        const mapped = raw.map((s: any) => ({
          id: s.id,
          category: s.category || '',
          slaRuleTag: s.slaRuleTag || '',
          badgeClass: s.badgeClass || 'bg-blue-50 text-blue-700 border-blue-200',
          title: s.title || '',
          desc: s.description || s.desc || '',
          meta: s.meta || '',
          actionType: s.actionType || 'pipeline',
          actionLabel: s.actionLabel || 'Review',
          done: s.isDone ?? s.done ?? false,
        }));
        setSlaTasks(mapped);
        loadedEntities.current.add('slaTasks');
      }
    } catch (e) {
      console.warn('API fetch sla-tasks:', e);
    }
  };

  const fetchAutomations = async () => {
    try {
      const [ruleRes, auditRes] = await Promise.allSettled([
        apiClient.get('/automations/rules'),
        apiClient.get('/automations/audit-logs'),
      ]);

      if (ruleRes.status === 'fulfilled' && ruleRes.value.data?.data) {
        const raw = ruleRes.value.data.data;
        const formatCategory = (cat?: string) => {
          const upper = String(cat || '').toUpperCase();
          if (upper === 'FEEDBACK' || upper === 'STALE_REQ' || upper === 'CUSTOM') return 'Feedback';
          if (upper === 'INTERVIEW') return 'Interview';
          if (upper === 'CONTRACT') return 'Contract';
          if (upper === 'COMPLIANCE') return 'Compliance';
          return cat || 'Feedback';
        };
        const mappedRules = raw.map((rl: any) => ({
          id: rl.id,
          tenantId: rl.tenantId,
          name: rl.name,
          category: formatCategory(rl.category),
          icon: rl.icon || 'fa-solid fa-gear',
          color: rl.color || 'amber',
          active: rl.active ?? rl.isActive ?? true,
          whenText: rl.whenText || '',
          threshold: rl.threshold || '',
          thenSummary: rl.thenSummary || '',
          actionPills: rl.actionPills || (Array.isArray(rl.actions) ? rl.actions : []),
          executionsToday: rl.executionsToday ?? rl.executionsCount ?? 0,
          lastFired: rl.lastFiredAt
            ? new Date(rl.lastFiredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : rl.lastFired || 'Ready',
        }));
        setRules(mappedRules);
        setSidebarCounts((prev) => ({
          ...prev,
          activeRules: mappedRules.filter((r: any) => r.active).length,
        }));
      }

      if (auditRes.status === 'fulfilled' && auditRes.value.data?.data) {
        const raw = auditRes.value.data.data;
        setAuditLogs(
          raw.map((lg: any) => ({
            id: lg.id,
            timestamp: lg.createdAt
              ? new Date(lg.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : lg.timestamp || 'Just now',
            ruleName: lg.ruleName,
            target: lg.target,
            conditionsMet: lg.conditionsMet,
            actionDispatched: lg.actionDispatched,
            status: lg.status === 'EXECUTED' ? 'Executed' : lg.status || 'Executed',
          }))
        );
      }
      loadedEntities.current.add('automations');
    } catch (e) {
      console.warn('API fetch automations:', e);
    }
  };

  const fetchCustomFields = async () => {
    try {
      const res = await apiClient.get('/custom-fields');
      if (res.data?.success && Array.isArray(res.data.data)) {
        const mapped = res.data.data.map((f: any) => ({
          id: f.id,
          name: f.name,
          entity: (f.entity || 'consultant').toLowerCase(),
          entityLabel:
            (f.entity || 'Consultant').charAt(0).toUpperCase() +
            (f.entity || 'Consultant').slice(1).toLowerCase(),
          type:
            f.type === 'NUMBER'
              ? `Currency (${getCurrencySymbol()})`
              : f.type === 'DROPDOWN'
              ? 'Dropdown'
              : f.type === 'DATE'
              ? 'Date'
              : 'Text',
          options: Array.isArray(f.options)
            ? f.options.join(', ')
            : typeof f.options === 'object' && f.options?.values
            ? f.options.values
            : typeof f.options === 'string'
            ? f.options
            : 'Standard Format',
          required: !!f.required,
          active: f.active ?? true,
        }));
        setCustomFields(mapped);
        setSidebarCounts((prev) => ({ ...prev, customFields: mapped.length }));
        loadedEntities.current.add('custom_fields');
      }
    } catch (e) {
      console.warn('API fetch custom fields:', e);
    }
  };

  // 1. Fetch lightweight navigation counts and workspace currency once on authentication
  useEffect(() => {
    if (!authToken && !currentUser) return;
    fetchSidebarCounts();
    initWorkspaceCurrency();
  }, [authToken]);

  // 2. ON-DEMAND / VIEW-SCOPED FETCHING: Only call APIs for the active view when opened!
  useEffect(() => {
    if (!authToken && !currentUser) return;

    switch (currentView) {
      case 'dashboard':
        // Only fetch Dashboard requirements, candidates, placements, and SLA radar
        if (!loadedEntities.current.has('requirements')) fetchRequirements();
        if (!loadedEntities.current.has('candidates')) fetchCandidates();
        if (!loadedEntities.current.has('placements')) fetchPlacements();
        if (!loadedEntities.current.has('slaTasks')) fetchSlaTasks();
        break;

      case 'pipeline':
        if (!loadedEntities.current.has('requirements')) fetchRequirements();
        if (!loadedEntities.current.has('candidates')) fetchCandidates();
        break;

      case 'consultants':
        if (!loadedEntities.current.has('candidates')) fetchCandidates();
        break;

      case 'clients':
        if (!loadedEntities.current.has('clients')) fetchClients();
        if (!loadedEntities.current.has('requirements')) fetchRequirements();
        if (!loadedEntities.current.has('placements')) fetchPlacements();
        break;

      case 'vendors':
        if (!loadedEntities.current.has('vendors')) fetchVendors();
        break;

      case 'billable':
        if (!loadedEntities.current.has('placements')) fetchPlacements();
        if (!loadedEntities.current.has('candidates')) fetchCandidates();
        if (!loadedEntities.current.has('clients')) fetchClients();
        if (!loadedEntities.current.has('vendors')) fetchVendors();
        if (!loadedEntities.current.has('requirements')) fetchRequirements();
        if (!loadedEntities.current.has('users')) fetchUsers();
        break;

      case 'user_management':
        if (!loadedEntities.current.has('users')) fetchUsers();
        break;

      case 'automation':
        if (!loadedEntities.current.has('automations')) fetchAutomations();
        break;

      case 'custom_fields':
        if (!loadedEntities.current.has('custom_fields')) fetchCustomFields();
        break;

      default:
        break;
    }
  }, [currentView, authToken]);

  // Ensure clients, users, and candidates are available when opening create or pitch modals
  useEffect(() => {
    if (!authToken && !currentUser) return;
    if (
      activeCreateModal === 'requirement' ||
      activeCreateModal === 'placement' ||
      activeCreateModal === 'consultant' ||
      isEmailModalOpen ||
      isPlacementWizardOpen
    ) {
      if (!loadedEntities.current.has('clients')) fetchClients();
      if (!loadedEntities.current.has('users')) fetchUsers();
      if (activeCreateModal === 'placement' || isPlacementWizardOpen) {
        if (!loadedEntities.current.has('candidates')) fetchCandidates();
        if (!loadedEntities.current.has('vendors')) fetchVendors();
        if (!loadedEntities.current.has('requirements')) fetchRequirements();
      }
    }
    if (isPitchModalOpen) {
      if (!loadedEntities.current.has('candidates')) fetchCandidates();
      if (!loadedEntities.current.has('clients')) fetchClients();
    }
  }, [activeCreateModal, isPitchModalOpen, isEmailModalOpen, isPlacementWizardOpen, authToken]);

  // Financial KPI calculations
  const totalMonthlyGrossProfit = placements.reduce(
    (sum, p) => sum + (Number(p.hourlySpread) || 0) * 160,
    0
  );
  const avgHourlyMarginSpread = placements.length
    ? (
        placements.reduce((sum, p) => sum + (Number(p.hourlySpread) || 0), 0) /
        placements.length
      ).toFixed(2)
    : '0.00';
  const avgMarginPercent = placements.length
    ? (
        placements.reduce((sum, p) => sum + (Number(p.marginPct) || 0), 0) / placements.length
      ).toFixed(1)
    : '0.0';

  const expiringPlacementsCount = placements.filter((p) => {
    const diff = (new Date(p.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 30;
  }).length;

  const metrics = {
    activeReqsCount: requirements.length,
    submittedCount: requirements.filter((r) => r.status === 'Submitted').length,
    interviewsCount: requirements.filter((r) => r.status === 'Interview').length,
    selectedCount: requirements.filter((r) => r.status === 'Selected').length,
    onboardingCount: requirements.filter((r) => r.status === 'Onboarding').length,
    totalMonthlyGrossProfit,
    avgHourlyMarginSpread,
    avgMarginPercent,
    expiringPlacementsCount,
  };

  // Handlers
  const handleStatusChange = async (req: Requirement, newStatus: any) => {
    setRequirements((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: newStatus } : r))
    );
    try {
      await apiClient.patch(`/requirements/${req.id}/stage`, {
        status: newStatus,
        resourceName: req.resourceName,
      });
      fetchSidebarCounts();
    } catch (e) {
      console.warn('API status change:', e);
    }

    showToast(
      'Stage Updated',
      `${req.opportunityTitle} moved to ${newStatus}.`,
      'fa-solid fa-arrows-spin text-brand-600'
    );
  };

  const handleAssignCandidate = async (req: Requirement, candidate: Candidate) => {
    setRequirements((prev) =>
      prev.map((r) =>
        r.id === req.id
          ? { ...r, resourceName: candidate.fullName, status: 'Submitted' }
          : r
      )
    );
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidate.id ? { ...c, pipelineStage: 'Submitted' } : c
      )
    );
    try {
      await apiClient.post('/submissions', {
        requirementId: req.id,
        candidateId: candidate.id,
      });
      fetchSidebarCounts();
    } catch (e) {
      console.warn('API assign candidate:', e);
    }

    setAuditLogs((prev) => [
      {
        id: 'log_' + Date.now(),
        timestamp: 'Just now',
        ruleName: 'Direct Candidate Submittal',
        target: `${candidate.fullName} → ${req.code} (${req.companyName})`,
        conditionsMet: `Skillset Match: ${candidate.skillset}`,
        actionDispatched: 'Advanced to Client Review & Queued Follow-Up SLA',
        status: 'Executed',
      },
      ...prev,
    ]);
    showToast(
      'Candidate Assigned',
      `${candidate.fullName} submitted to ${req.code}!`,
      'fa-solid fa-circle-check text-emerald-400'
    );
  };

  const handleConfirmPlacement = async (newPlacement: BillablePlacement, reqId?: string) => {
    let savedPlacement = newPlacement;
    try {
      const res = await apiClient.post('/placements', newPlacement);
      if (res.data?.data) {
        savedPlacement = normalizePlacement(res.data.data);
      }
      fetchSidebarCounts();
    } catch (e) {
      console.warn('API confirm placement:', e);
    }
    setPlacements((prev) => [savedPlacement, ...prev]);
    if (savedPlacement.candidateId || savedPlacement.resourceName) {
      const targetName = savedPlacement.resourceName.trim().toLowerCase();
      setCandidates((prev) =>
        prev.map((c) =>
          (savedPlacement.candidateId && c.id === savedPlacement.candidateId) ||
          c.fullName.trim().toLowerCase() === targetName
            ? { ...c, pipelineStage: 'Billable' }
            : c
        )
      );
    }
    const resolvedReqId = reqId || savedPlacement.requirementId;
    if (resolvedReqId) {
      setRequirements((prev) =>
        prev.map((r) =>
          r.id === resolvedReqId
            ? { ...r, status: 'Onboarding', resourceName: savedPlacement.resourceName || r.resourceName }
            : r
        )
      );
      apiClient
        .patch(`/requirements/${resolvedReqId}/stage`, {
          status: 'Onboarding',
          resourceName: savedPlacement.resourceName,
        })
        .catch((e) => console.warn('API update requirement status:', e));
    }
    setAuditLogs((prev) => [
      {
        id: 'log_' + Date.now(),
        timestamp: 'Just now',
        ruleName: 'Placement Activation & Margin Lock',
        target: `${savedPlacement.resourceName} @ ${savedPlacement.customer}`,
        conditionsMet: `Bill: ${formatRateDisplay(savedPlacement.billing)} | Spread: +${getCurrencySymbol()}${Number(
          savedPlacement.hourlySpread || 0
        ).toFixed(2)}/hr`,
        actionDispatched: 'Registered to Billable Ledger & 30d Expiration Radar Scheduled',
        status: 'Executed',
      },
      ...prev,
    ]);
    showToast(
      'Placement Activated',
      `Locked in commercial placement for ${savedPlacement.resourceName}!`,
      'fa-solid fa-file-invoice-dollar text-emerald-400'
    );
  };

  const handleUpdateCandidate = async (updated: Candidate) => {
    try {
      const res = await apiClient.put(`/candidates/${updated.id}`, updated);
      const saved: Candidate = res.data?.data ?? updated;
      setCandidates((prev) => prev.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)));
      showToast('Consultant Updated', `${saved.fullName} details saved.`, 'fa-solid fa-circle-check text-emerald-500');
    } catch (e: any) {
      console.warn('API update candidate failed:', e);
      showToast('Update Failed', e?.response?.data?.error || `Could not update ${updated.fullName}.`, 'fa-solid fa-circle-exclamation text-rose-500');
      throw e;
    }
  };

  const handleUpdateRequirement = async (updated: Requirement) => {
    try {
      const res = await apiClient.put(`/requirements/${updated.id}`, updated);
      const saved: Requirement = res.data?.data ?? updated;
      setRequirements((prev) => prev.map((r) => (r.id === saved.id ? { ...r, ...saved } : r)));
      setSelectedReqForDetail((prev) => (prev && prev.id === saved.id ? { ...prev, ...saved } : prev));
      showToast('Requirement Updated', `${saved.opportunityTitle} saved.`, 'fa-solid fa-circle-check text-emerald-500');
    } catch (e: any) {
      console.warn('API update requirement failed:', e);
      showToast('Update Failed', e?.response?.data?.error || `Could not update ${updated.opportunityTitle}.`, 'fa-solid fa-circle-exclamation text-rose-500');
      throw e;
    }
  };

  const handleUpdateVendor = async (updated: Vendor) => {
    try {
      const res = await apiClient.put(`/vendors/${updated.id}`, updated);
      const saved: Vendor = res.data?.data ?? updated;
      setVendors((prev) => prev.map((v) => (v.id === saved.id ? { ...v, ...saved } : v)));
      showToast('Vendor Updated', `${saved.name} details saved.`, 'fa-solid fa-circle-check text-emerald-500');
    } catch (e: any) {
      console.warn('API update vendor failed:', e);
      showToast('Update Failed', e?.response?.data?.error || `Could not update ${updated.name}.`, 'fa-solid fa-circle-exclamation text-rose-500');
      throw e;
    }
  };

  const handleUpdatePlacement = async (updated: BillablePlacement) => {
    try {
      const billNum = parseFloat(String(updated.billing || '0').replace(/[^0-9.]/g, '')) || 0;
      const payNum = parseFloat(String(updated.payRate || '0').replace(/[^0-9.]/g, '')) || 0;
      const hourlySpread = billNum - payNum;
      const marginPct = billNum > 0 ? parseFloat(((hourlySpread / billNum) * 100).toFixed(2)) : 0;
      const payload = { ...updated, hourlySpread, marginPct };
      const res = await apiClient.put(`/placements/${updated.id}`, payload);
      const saved: BillablePlacement = res.data?.data ? normalizePlacement(res.data.data) : payload;
      setPlacements((prev) => prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)));
      if (saved.status === 'Completed' || saved.status === 'Terminated' || saved.status === 'Active' || saved.status === 'Extended') {
        const nextStage = saved.status === 'Completed' || saved.status === 'Terminated' ? 'Available / Bench' : 'Billable';
        const targetName = saved.resourceName.trim().toLowerCase();
        setCandidates((prev) =>
          prev.map((c) =>
            (saved.candidateId && c.id === saved.candidateId) || c.fullName.trim().toLowerCase() === targetName
              ? { ...c, pipelineStage: nextStage }
              : c
          )
        );
      }
      showToast('Placement Updated', `${saved.resourceName} placement saved.`, 'fa-solid fa-circle-check text-emerald-500');
    } catch (e: any) {
      console.warn('API update placement failed:', e);
      showToast('Update Failed', e?.response?.data?.error || `Could not update ${updated.resourceName}.`, 'fa-solid fa-circle-exclamation text-rose-500');
      throw e;
    }
  };

  const handleUpdateUser = async (updated: User) => {
    try {
      const res = await apiClient.put(`/users/${updated.id}`, updated);
      const saved: User = res.data?.data ?? updated;
      setUsers((prev) => prev.map((u) => (u.id === saved.id ? { ...u, ...saved } : u)));
      showToast('Member Updated', `${saved.name} profile saved.`, 'fa-solid fa-circle-check text-emerald-500');
    } catch (e: any) {
      console.warn('API update user failed:', e);
      showToast('Update Failed', e?.response?.data?.error || `Could not update ${updated.name}.`, 'fa-solid fa-circle-exclamation text-rose-500');
      throw e;
    }
  };

  const handleDeleteCandidate = async (candidate: Candidate) => {
    try {
      await apiClient.delete(`/candidates/${candidate.id}`);
      setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
      fetchSidebarCounts();
      showToast('Consultant Removed', `${candidate.fullName} removed from roster.`, 'fa-solid fa-trash-can text-slate-500');
    } catch (e) {
      console.warn('API delete candidate:', e);
      showToast('Delete Failed', `Could not delete ${candidate.fullName}.`, 'fa-solid fa-circle-exclamation text-rose-500');
    }
  };

  const handleDeleteRequirement = async (req: Requirement) => {
    try {
      await apiClient.delete(`/requirements/${req.id}`);
      setRequirements((prev) => prev.filter((r) => r.id !== req.id));
      fetchSidebarCounts();
      showToast('Requisition Removed', `${req.code} (${req.opportunityTitle}) deleted.`, 'fa-solid fa-trash-can text-slate-500');
    } catch (e) {
      console.warn('API delete requirement:', e);
      showToast('Delete Failed', `Could not delete ${req.code}.`, 'fa-solid fa-circle-exclamation text-rose-500');
    }
  };

  const handleDeleteClient = async (client: Client) => {
    try {
      await apiClient.delete(`/clients/${client.id}`);
      setClients((prev) => prev.filter((cl) => cl.id !== client.id));
      fetchSidebarCounts();
      showToast('Client Removed', `${client.name} deleted.`, 'fa-solid fa-trash-can text-slate-500');
    } catch (e) {
      console.warn('API delete client:', e);
      showToast('Delete Failed', `Could not delete ${client.name}.`, 'fa-solid fa-circle-exclamation text-rose-500');
    }
  };

  const handleDeleteVendor = async (vendor: Vendor) => {
    try {
      await apiClient.delete(`/vendors/${vendor.id}`);
      setVendors((prev) => prev.filter((v) => v.id !== vendor.id));
      fetchSidebarCounts();
      showToast('Vendor Removed', `${vendor.name} deleted.`, 'fa-solid fa-trash-can text-slate-500');
    } catch (e) {
      console.warn('API delete vendor:', e);
      showToast('Delete Failed', `Could not delete ${vendor.name}.`, 'fa-solid fa-circle-exclamation text-rose-500');
    }
  };

  const handleDeletePlacement = async (placement: BillablePlacement) => {
    try {
      await apiClient.delete(`/placements/${placement.id}`);
      setPlacements((prev) => prev.filter((p) => p.id !== placement.id));
      fetchSidebarCounts();
      showToast('Placement Removed', `${placement.resourceName}'s placement removed.`, 'fa-solid fa-trash-can text-slate-500');
    } catch (e) {
      console.warn('API delete placement:', e);
      showToast('Delete Failed', `Could not delete placement.`, 'fa-solid fa-circle-exclamation text-rose-500');
    }
  };

  const handleExtendContract = async (
    placement: BillablePlacement,
    extensionData?: { newEndDate: string; billing?: string; payRate?: string; purchaseOrderNumber?: string }
  ) => {
    const parsedEnd = placement.endDate ? new Date(placement.endDate) : new Date();
    const currentEnd = isNaN(parsedEnd.getTime()) ? new Date() : parsedEnd;
    currentEnd.setFullYear(currentEnd.getFullYear() + 1);
    const newEnd = extensionData?.newEndDate || currentEnd.toISOString().split('T')[0];

    const payload = {
      newEndDate: newEnd,
      ...(extensionData?.billing ? { billing: extensionData.billing } : {}),
      ...(extensionData?.payRate ? { payRate: extensionData.payRate } : {}),
      ...(extensionData?.purchaseOrderNumber !== undefined
        ? { purchaseOrderNumber: extensionData.purchaseOrderNumber }
        : {}),
    };

    let updatedPlacement: BillablePlacement | null = null;
    try {
      const res = await apiClient.post(`/placements/${placement.id}/extend`, payload);
      if (res.data?.data) {
        updatedPlacement = normalizePlacement(res.data.data);
      }
    } catch (e) {
      console.warn('API placement extension:', e);
    }

    setPlacements((prev) =>
      prev.map((p) => {
        if (p.id !== placement.id) return p;
        if (updatedPlacement) return { ...p, ...updatedPlacement };
        const billing = extensionData?.billing || p.billing;
        const payRate = extensionData?.payRate || p.payRate || '';
        const billNum = parseFloat(String(billing).replace(/[^0-9.]/g, '')) || 0;
        const payNum = parseFloat(String(payRate).replace(/[^0-9.]/g, '')) || 0;
        const hourlySpread = billNum - payNum;
        const marginPct = billNum > 0 ? parseFloat(((hourlySpread / billNum) * 100).toFixed(2)) : 0;
        return {
          ...p,
          endDate: newEnd,
          status: 'Extended',
          billing,
          payRate,
          hourlySpread,
          marginPct,
          purchaseOrderNumber: extensionData?.purchaseOrderNumber ?? p.purchaseOrderNumber,
        };
      })
    );
    setAuditLogs((prev) => [
      {
        id: 'log_' + Date.now(),
        timestamp: 'Just now',
        ruleName: 'SOW Extension Protocol',
        target: `${placement.resourceName} @ ${placement.customer}`,
        conditionsMet: 'Client Extension Verified',
        actionDispatched: `Extended SOW through ${newEnd}`,
        status: 'Executed',
      },
      ...prev,
    ]);
    showToast(
      'Contract Extended',
      `SOW for ${placement.resourceName} extended through ${newEnd}!`,
      'fa-solid fa-circle-check text-emerald-400'
    );
  };

  const handleTestTriggerRule = async (rule: AutomationRule) => {
    try {
      await apiClient.post(`/automations/rules/${rule.id}/test`);
    } catch (e) {
      console.warn('API test rule trigger:', e);
    }
    setRules((prev) =>
      prev.map((r) =>
        r.id === rule.id
          ? { ...r, executionsToday: r.executionsToday + 1, lastFired: 'Just now' }
          : r
      )
    );
    setAuditLogs((prev) => [
      {
        id: 'log_' + Date.now(),
        timestamp: 'Just now',
        ruleName: rule.name,
        target: 'Manual Verification Probe',
        conditionsMet: `Threshold verified: ${rule.threshold}`,
        actionDispatched: rule.thenSummary,
        status: 'Executed',
      },
      ...prev,
    ]);
    showToast(
      'Automation Triggered',
      `Rule "${rule.name}" fired successfully!`,
      'fa-solid fa-bolt text-amber-500'
    );
  };

  const handleTaskAction = (task: SlaTask) => {
    if (task.actionType === 'pitch') {
      setIsPitchModalOpen(true);
    } else if (task.actionType === 'matcher') {
      setIsMatcherModalOpen(true);
    } else if (task.actionType === 'billable') {
      setCurrentView('billable');
    } else {
      setCurrentView('pipeline');
    }
    setIsSlaOpen(false);
  };

  const handleSignOut = () => {
    localStorage.removeItem('talentos_access_token');
    localStorage.removeItem('talentos_current_user');
    sessionStorage.removeItem('talentos_access_token');
    sessionStorage.removeItem('talentos_current_user');
    resetWorkspaceState();
    setCurrentUser(null);
    setAuthToken(null);
    setShowSignOutModal(false);
    showToast(
      'Signed Out',
      'You have been signed out of TalentOS.',
      'fa-solid fa-arrow-right-from-bracket text-slate-700'
    );
  };

  const handleSwitchPersona = (persona: {
    name: string;
    email: string;
    role: string;
    desk: string;
    rateMasked: boolean;
  }) => {
    const switchedUser: User = {
      id: 'usr_' + persona.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: persona.name,
      email: persona.email,
      role: persona.role,
      desk: persona.desk,
      rateMasked: persona.rateMasked,
      workload: 'Active Operational Desk',
      status: 'Active',
      lastActive: 'Active Now',
    };
    setCurrentUser(switchedUser);
    setRateMasked(persona.rateMasked);
    localStorage.setItem('talentos_current_user', JSON.stringify(switchedUser));
    showToast(
      'Persona Switched',
      `Active account switched to ${persona.name} (${persona.role}).`,
      'fa-solid fa-arrows-rotate text-brand-600'
    );
  };

  const handleUpdateProfile = async (updated: User) => {
    let savedUser = updated;
    try {
      const res = await apiClient.patch('/auth/profile', {
        name: updated.name,
        email: updated.email,
        desk: updated.desk,
      });
      if (res.data?.data) {
        savedUser = {
          ...updated,
          ...res.data.data,
          role: formatUserRole(res.data.data.role || updated.role),
          status: formatUserStatus(res.data.data.status || updated.status),
        };
      }
    } catch (e) {
      console.warn('API update profile:', e);
    }
    setCurrentUser(savedUser);
    if (localStorage.getItem('talentos_current_user')) {
      localStorage.setItem('talentos_current_user', JSON.stringify(savedUser));
    }
    if (sessionStorage.getItem('talentos_current_user')) {
      sessionStorage.setItem('talentos_current_user', JSON.stringify(savedUser));
    }
    setUsers((prev) => prev.map((u) => (u.id === savedUser.id ? savedUser : u)));
  };

  // If unauthenticated, render the full-screen Obsidian SaaS Login View
  if (!currentUser) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-[#0B0F17]">
        {/* Global Toast Banner */}
        {toast && (
          <div
            style={{ zIndex: 9999 }}
            className="fixed bottom-5 right-5 z-[9999] max-w-md bg-white border border-slate-200 shadow-2xl rounded-xl p-4 flex items-center gap-3 animate-fade-in"
          >
            <i className={`${toast.icon} text-base flex-shrink-0`}></i>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900">{toast.title}</div>
              <div className="text-[11px] text-slate-500 break-words">{toast.message}</div>
            </div>
            <button
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer flex-shrink-0"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
        )}

        <LoginView
          onLoginSuccess={(user, token) => {
            resetWorkspaceState();
            const normalizedUser: User = {
              ...user,
              role: formatUserRole(user.role),
              status: formatUserStatus(user.status),
            };
            setCurrentUser(normalizedUser);
            setAuthToken(token);
            setRateMasked(normalizedUser.rateMasked ?? false);
          }}
          showToast={showToast}
        />
      </div>
    );
  }

  const computedSidebarCounts = {
    requirements: requirements.length || sidebarCounts.requirements,
    consultants: candidates.length || sidebarCounts.consultants,
    clients: clients.length || sidebarCounts.clients,
    vendors: vendors.length || sidebarCounts.vendors,
    billable: placements.length || sidebarCounts.billable,
    users: users.length || sidebarCounts.users,
    customFields: customFields.length || sidebarCounts.customFields,
    activeRules: rules.filter((r) => r.active).length || sidebarCounts.activeRules,
  };

  return (
    <div className="h-screen w-full flex overflow-hidden text-slate-800 bg-[#FAFAFA]">
      {/* Toast Banner */}
      {toast && (
        <div
          style={{ zIndex: 9999 }}
          className="fixed bottom-5 right-5 z-[9999] max-w-md bg-white border border-slate-200 card-shadow rounded-xl p-4 flex items-center gap-3 animate-fade-in"
        >
          <i className={`${toast.icon} text-base flex-shrink-0`}></i>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900">{toast.title}</div>
            <div className="text-[11px] text-slate-500 break-words">{toast.message}</div>
          </div>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer flex-shrink-0"
          >
            <i className="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>
      )}

      {/* Obsidian Dark Sidebar with live counts & profile popover */}
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        counts={computedSidebarCounts}
        currentUser={currentUser}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenSignOut={() => setShowSignOutModal(true)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Topbar with clean design matching prototype (Left: View Title, Right: + Quick Add dropdown) */}
        <Topbar
          currentView={currentView}
          onOpenCreateModal={(type) => setActiveCreateModal(type)}
        />

        {/* Dynamic View Body */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {currentView === 'dashboard' && (
            <DashboardView
              requirements={requirements}
              candidates={candidates}
              placements={placements}
              slaTasks={slaTasks}
              rateMasked={rateMasked}
              onNavigate={setCurrentView}
              onOpenCreateReq={() => setActiveCreateModal('requirement')}
              onSelectReq={(r) => setSelectedReqForDetail(r)}
              onPreviewResumeByName={(candName) => {
                const c = candidates.find((cand) => cand.fullName === candName);
                if (c) setSelectedResumeCand(c);
              }}
              onStatusChange={handleStatusChange}
              onOpenMatcher={(req) => {
                setActiveReq(req);
                setIsMatcherModalOpen(true);
              }}
              onOpenPitchWriter={(req) => {
                setActiveReq(req);
                setIsPitchModalOpen(true);
              }}
              onOpenSlaDrawer={() => setIsSlaOpen(true)}
              showToast={showToast}
            />
          )}

          {currentView === 'pipeline' && (
            <PipelineView
              requirements={requirements}
              candidates={candidates}
              onStatusChange={handleStatusChange}
              onOpenEmailParser={() => setIsEmailModalOpen(true)}
              onOpenMatcher={(req) => {
                setActiveReq(req);
                setIsMatcherModalOpen(true);
              }}
              onOpenPitchWriter={(req) => {
                setActiveReq(req);
                setIsPitchModalOpen(true);
              }}
              onOpenPlacementWizard={(req) => {
                setActiveReq(req);
                setIsPlacementWizardOpen(true);
              }}
              onSelectReq={(r) => setSelectedReqForDetail(r)}
              onOpenAddReq={() => setActiveCreateModal('requirement')}
              onUpdateReq={handleUpdateRequirement}
              onDeleteReq={handleDeleteRequirement}
            />
          )}

          {currentView === 'consultants' && (
            <ConsultantsView
              candidates={candidates}
              rateMasked={rateMasked}
              onOpenResumeParser={() => setIsResumeModalOpen(true)}
              onPreviewResume={(c) => setSelectedResumeCand(c)}
              onOpenAddConsultant={() => setActiveCreateModal('consultant')}
              onOpenCsvImport={() => setCurrentView('import_data')}
              onUpdateCandidate={handleUpdateCandidate}
              onDeleteCandidate={handleDeleteCandidate}
            />
          )}

          {currentView === 'clients' && (
            <ClientsView
              clients={clients}
              requirements={requirements}
              placements={placements}
              onOpenAddClient={() => setActiveCreateModal('client')}
              onDeleteClient={handleDeleteClient}
              onClientUpdated={(updatedClient) =>
                setClients((prev) =>
                  prev.map((c) => (c.id === updatedClient.id ? updatedClient : c))
                )
              }
              showToast={showToast}
            />
          )}

          {currentView === 'vendors' && (
            <VendorsView
              vendors={vendors}
              onOpenAddVendor={() => setActiveCreateModal('vendor')}
              onUpdateVendor={handleUpdateVendor}
              onDeleteVendor={handleDeleteVendor}
            />
          )}

          {currentView === 'billable' && (
            <BillablePlacementsView
              placements={placements}
              rateMasked={rateMasked}
              onOpenNewPlacement={() => setActiveCreateModal('placement')}
              onExtendContract={handleExtendContract}
              onUpdatePlacement={handleUpdatePlacement}
              onDeletePlacement={handleDeletePlacement}
              showToast={showToast}
            />
          )}

          {currentView === 'user_management' && (
            <UserManagementView
              users={users}
              onToggleRateMask={async (user) => {
                try {
                  await apiClient.patch(`/users/${user.id}/rate-mask`);
                } catch (e) {
                  console.warn('API toggle rate-mask:', e);
                }
                setUsers((prev) =>
                  prev.map((u) => (u.id === user.id ? { ...u, rateMasked: !u.rateMasked } : u))
                );
                showToast(
                  'Clearance Updated',
                  `${user.name}'s billing rate visibility is now ${
                    !user.rateMasked ? 'Masked (••••)' : 'Visible'
                  }.`
                );
              }}
              onInviteUser={async (newUser) => {
                if (!newUser.name || !newUser.email) return;
                const name: string = newUser.name;
                const email: string = newUser.email;
                let invitedUser: User = {
                  id: 'usr_' + Date.now(),
                  name,
                  email,
                  role: newUser.role || 'Technical Recruiter',
                  desk: newUser.desk || 'US IT Contract (C2C & W2)',
                  rateMasked: newUser.rateMasked ?? true,
                  workload: '0 Requisitions • 0 Submissions',
                  status: 'Invited',
                  lastActive: 'Active Now',
                };
                try {
                  const res = await apiClient.post('/users/invite', newUser);
                  if (res.data?.data) {
                    const u = res.data.data;
                    invitedUser = {
                      id: u.id,
                      name: u.fullName || name,
                      email: u.email || email,
                      role: formatUserRole(u.role),
                      desk: u.desk || invitedUser.desk,
                      rateMasked: u.rateMasked ?? invitedUser.rateMasked,
                      workload: u.workload || invitedUser.workload,
                      status: formatUserStatus(u.status),
                      lastActive: 'Invited',
                    };
                  }
                  fetchSidebarCounts();
                } catch (e) {
                  console.warn('API invite user failed:', e);
                }
                setUsers((prev) => [...prev, invitedUser]);
              }}
              onToggleUserStatus={async (user) => {
                try {
                  const res = await apiClient.patch(`/users/${user.id}/status`);
                  const newStatus = res.data?.data?.status === 'SUSPENDED' ? 'Suspended' : 'Active';
                  setUsers((prev) =>
                    prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
                  );
                  showToast('Status Updated', `${user.name} is now ${newStatus}.`, 'fa-solid fa-user-shield text-indigo-500');
                } catch (e) {
                  console.warn('API toggle status failed:', e);
                }
              }}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={async (user) => {
                try {
                  await apiClient.delete(`/users/${user.id}`);
                  setUsers((prev) => prev.filter((u) => u.id !== user.id));
                  showToast('Member Removed', `${user.name} has been removed from agency roster.`, 'fa-solid fa-trash-can text-slate-500');
                } catch (e) {
                  console.warn('API delete user failed:', e);
                }
              }}
              showToast={showToast}
            />
          )}

          {currentView === 'custom_fields' && (
            <CustomFieldsView
              customFields={customFields}
              onAddCustomField={(f) => setCustomFields((prev) => [...prev, f])}
              showToast={showToast}
            />
          )}

          {currentView === 'automation' && (
            <AutomationsView
              rules={rules}
              auditLogs={auditLogs}
              tenantId={currentUser?.tenantId || 'talentos-agency'}
              onTestTrigger={handleTestTriggerRule}
              onToggleRule={(id) => {
                setRules((prev) =>
                  prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
                );
              }}
              onRefreshAutomations={() => {
                fetchAutomations();
                fetchSlaTasks();
                fetchSidebarCounts();
              }}
              showToast={showToast}
            />
          )}

          {currentView === 'import_data' && (
            <ImportDataView
              onImportCandidates={(newCands) => {
                setCandidates((prev) => [...newCands, ...prev]);
              }}
              onOpenResumeParser={() => setIsResumeModalOpen(true)}
              onNavigate={setCurrentView}
              showToast={showToast}
            />
          )}

          {(currentView === 'settings_general' || currentView === 'settings_smtp') && (
            <SettingsView
              activeTab={currentView === 'settings_smtp' ? 'smtp' : 'general'}
              onTabChange={(tab) => setCurrentView(tab === 'smtp' ? 'settings_smtp' : 'settings_general')}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {/* SLA Action Center Flyout Drawer */}
      <SlaDrawer
        isOpen={isSlaOpen}
        onClose={() => setIsSlaOpen(false)}
        tasks={slaTasks}
        onTaskAction={handleTaskAction}
        onToggleTaskDone={async (id) => {
          try {
            await apiClient.patch(`/sla-tasks/${id}/complete`);
          } catch (e) {
            console.warn('API sla-task complete:', e);
          }
          setSlaTasks((prev) =>
            prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
          );
        }}
      />

      {/* Candidate Resume Dossier Preview Modal */}
      <ResumeViewerModal
        isOpen={Boolean(selectedResumeCand)}
        onClose={() => setSelectedResumeCand(null)}
        candidate={selectedResumeCand}
        requirements={requirements}
        onSubmitToReq={(candidate, req) => {
          handleAssignCandidate(req, candidate);
          showToast(
            'Candidate Submitted',
            `${candidate.fullName} submitted to ${req.code} (${req.opportunityTitle})!`,
            'fa-solid fa-bolt text-amber-500'
          );
        }}
        showToast={showToast}
      />

      {/* Job Requisition Detail & Inline Bench Matcher Modal */}
      <RequirementDetailModal
        isOpen={Boolean(selectedReqForDetail)}
        onClose={() => setSelectedReqForDetail(null)}
        requirement={selectedReqForDetail}
        candidates={candidates}
        onAssignCandidate={(req, cand) => {
          handleAssignCandidate(req, cand);
          setSelectedReqForDetail((prev) =>
            prev ? { ...prev, resourceName: cand.fullName, status: 'Submitted' } : null
          );
        }}
        onOpenResumePreview={(cand) => setSelectedResumeCand(cand)}
        onOpenPitchWriter={(req) => {
          setActiveReq(req);
          setIsPitchModalOpen(true);
        }}
        onOpenPlacementWizard={(req) => {
          setActiveReq(req);
          setIsPlacementWizardOpen(true);
        }}
        onUpdateReq={handleUpdateRequirement}
      />

      {/* Specialized Modals */}
      <ResumeParserModal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        onApprove={(c) => {
          setCandidates((prev) => [c, ...prev]);
          fetchSidebarCounts();
        }}
        onSwitchToCsvImport={() => {
          setIsResumeModalOpen(false);
          setCurrentView('import_data');
        }}
        showToast={showToast}
      />

      <EmailParserModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        clients={clients}
        users={users}
        onApprove={(req) => {
          setRequirements((prev) => [req, ...prev]);
          fetchClients();
          fetchSidebarCounts();
        }}
        showToast={showToast}
      />

      <SkillMatcherModal
        isOpen={isMatcherModalOpen}
        onClose={() => setIsMatcherModalOpen(false)}
        requirements={requirements}
        candidates={candidates}
        onSubmitCandidate={(candidate, requirement) =>
          handleAssignCandidate(requirement, candidate)
        }
        showToast={showToast}
      />

      <SubmissionPitchModal
        isOpen={isPitchModalOpen}
        onClose={() => setIsPitchModalOpen(false)}
        candidate={activeCandidate}
        candidates={candidates}
        requirement={activeReq}
        showToast={showToast}
      />

      <PlacementWizardModal
        isOpen={isPlacementWizardOpen}
        onClose={() => setIsPlacementWizardOpen(false)}
        candidate={activeCandidate}
        candidates={candidates}
        vendors={vendors}
        requirement={activeReq}
        onConfirmPlacement={handleConfirmPlacement}
        showToast={showToast}
      />

      {/* 5 Distinct Dedicated Add Modals matching Prototype lines 3700-4210 */}
      <AddConsultantModal
        isOpen={activeCreateModal === 'consultant'}
        onClose={() => setActiveCreateModal(null)}
        users={users}
        onSave={async (c) => {
          let saved = c;
          try {
            const res = await apiClient.post('/candidates', c);
            if (res.data?.data?.id) {
              saved = { ...c, id: res.data.data.id };
            }
            fetchSidebarCounts();
          } catch (e) {
            console.warn('API save candidate:', e);
          }
          setCandidates((prev) => [saved, ...prev]);
        }}
        showToast={showToast}
      />

      <AddRequirementModal
        isOpen={activeCreateModal === 'requirement'}
        onClose={() => setActiveCreateModal(null)}
        clients={clients}
        users={users}
        onSave={async (r) => {
          let saved = r;
          try {
            const res = await apiClient.post('/requirements', r);
            if (res.data?.data) {
              saved = {
                ...r,
                id: res.data.data.id || r.id,
                code: res.data.data.code || r.code,
                status: formatRequirementStatus(res.data.data.status || r.status),
              };
            }
            fetchSidebarCounts();
          } catch (e) {
            console.warn('API save requirement:', e);
          }
          setRequirements((prev) => [saved, ...prev]);
        }}
        showToast={showToast}
      />

      <AddClientModal
        isOpen={activeCreateModal === 'client'}
        onClose={() => setActiveCreateModal(null)}
        onSave={async (cl) => {
          let saved = cl;
          try {
            const res = await apiClient.post('/clients', cl);
            if (res.data?.data?.id) {
              saved = {
                ...cl,
                id: res.data.data.id,
                contacts: (res.data.data.contacts || cl.contacts || []).map((cnt: any) => ({
                  name: cnt.fullName || cnt.name || '',
                  designation: cnt.designation || '',
                  phone: cnt.phone || '',
                  email: cnt.email || '',
                  isPrimary: cnt.isPrimary ?? false,
                })),
              };
            }
            fetchSidebarCounts();
          } catch (e) {
            console.warn('API save client:', e);
          }
          setClients((prev) => [saved, ...prev]);
        }}
        showToast={showToast}
      />

      <AddVendorModal
        isOpen={activeCreateModal === 'vendor'}
        onClose={() => setActiveCreateModal(null)}
        onSave={async (v) => {
          let saved = v;
          try {
            const res = await apiClient.post('/vendors', v);
            if (res.data?.data?.id) {
              saved = { ...v, id: res.data.data.id };
            }
            fetchSidebarCounts();
          } catch (e) {
            console.warn('API save vendor:', e);
          }
          setVendors((prev) => [saved, ...prev]);
        }}
        showToast={showToast}
      />

      <AddPlacementModal
        isOpen={activeCreateModal === 'placement'}
        onClose={() => setActiveCreateModal(null)}
        clients={clients}
        users={users}
        candidates={candidates}
        vendors={vendors}
        requirements={requirements}
        onSave={async (p) => {
          let saved = p;
          try {
            const res = await apiClient.post('/placements', p);
            if (res.data?.data) {
              saved = normalizePlacement(res.data.data);
            }
            fetchSidebarCounts();
          } catch (e) {
            console.warn('API save placement:', e);
          }
          setPlacements((prev) => [saved, ...prev]);
          if (saved.candidateId || saved.resourceName) {
            const targetName = saved.resourceName.trim().toLowerCase();
            setCandidates((prev) =>
              prev.map((c) =>
                (saved.candidateId && c.id === saved.candidateId) ||
                c.fullName.trim().toLowerCase() === targetName
                  ? { ...c, pipelineStage: 'Billable' }
                  : c
              )
            );
          }
          if (saved.requirementId) {
            setRequirements((prev) =>
              prev.map((r) =>
                r.id === saved.requirementId
                  ? { ...r, status: 'Onboarding', resourceName: saved.resourceName || r.resourceName }
                  : r
              )
            );
          }
        }}
        showToast={showToast}
      />

      {/* Account Settings / Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentUser={currentUser}
        onUpdateUser={handleUpdateProfile}
        onOpenSignOut={() => {
          setShowProfileModal(false);
          setShowSignOutModal(true);
        }}
        showToast={showToast}
      />

      {/* Sign Out Confirmation Modal */}
      <SignOutModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        currentUser={currentUser}
        onConfirm={handleSignOut}
      />
    </div>
  );
};

export default App;
