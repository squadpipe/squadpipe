import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AppIcon } from './components/shared/AppIcon';
import { apiClient, AUTH_EXPIRED_EVENT } from './config/api.config';
import {
  clearAuthSession,
  getStoredAuthToken,
  getStoredCurrentUserRaw,
  updateStoredCurrentUser,
} from './utils/authStorage';
import { formatRateDisplay, getCurrencySymbol, initWorkspaceCurrency } from './utils/currency';
import {
  DEFAULT_WORKSPACE_BRAND,
  getWorkspaceBrand,
  initWorkspaceBrand,
  setWorkspaceBrand,
} from './utils/workspaceBrand';
import { mapCandidateFromApi, mapClientFromApi, mapRequirementFromApi, mapVendorFromApi } from './utils/entityMappers';
import { buildCandidateFormData } from './utils/cvFiles';
import { normalizeSlaBadgeClass } from './utils/stageStyles';

import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { SlaDrawer } from './components/layout/SlaDrawer';

// Feature Views
import { DashboardView } from './features/dashboard/DashboardView';
import { PipelineView } from './features/pipeline/PipelineView';
import { ConsultantsView } from './features/consultants/ConsultantsView';

const ClientsView = React.lazy(() =>
  import('./features/clients/ClientsView').then((m) => ({ default: m.ClientsView }))
);
const VendorsView = React.lazy(() =>
  import('./features/vendors/VendorsView').then((m) => ({ default: m.VendorsView }))
);
const BillablePlacementsView = React.lazy(() =>
  import('./features/billable/BillablePlacementsView').then((m) => ({
    default: m.BillablePlacementsView,
  }))
);
const UserManagementView = React.lazy(() =>
  import('./features/user-management/UserManagementView').then((m) => ({
    default: m.UserManagementView,
  }))
);
const CustomFieldsView = React.lazy(() =>
  import('./features/custom-fields/CustomFieldsView').then((m) => ({
    default: m.CustomFieldsView,
  }))
);
const AutomationsView = React.lazy(() =>
  import('./features/automations/AutomationsView').then((m) => ({
    default: m.AutomationsView,
  }))
);
const ImportDataView = React.lazy(() =>
  import('./features/import-data/ImportDataView').then((m) => ({
    default: m.ImportDataView,
  }))
);
const RequirementDetailPage = React.lazy(() =>
  import('./features/requirements/RequirementDetailPage').then((m) => ({
    default: m.RequirementDetailPage,
  }))
);
const SettingsView = React.lazy(() =>
  import('./features/settings/SettingsView').then((m) => ({
    default: m.SettingsView,
  }))
);

// Auth View
import { LoginView } from './features/auth/LoginView';

// Modals
import { ResumeParserModal } from './features/modals/ResumeParserModal';
import { EmailParserModal } from './features/modals/EmailParserModal';
import { SkillMatcherModal } from './features/modals/SkillMatcherModal';
import { PlacementWizardModal } from './features/modals/PlacementWizardModal';
import { AddConsultantModal } from './components/modals/create/AddConsultantModal';
import { AddRequirementModal } from './components/modals/create/AddRequirementModal';
import { AddClientModal } from './components/modals/create/AddClientModal';
import { AddVendorModal } from './components/modals/create/AddVendorModal';
import { AddPlacementModal } from './components/modals/create/AddPlacementModal';
import { SignOutModal } from './components/modals/SignOutModal';
import { ProfileModal } from './components/modals/ProfileModal';
import { ResumeViewerModal } from './components/modals/ResumeViewerModal';

import {
  Candidate,
  Requirement,
  RequirementSubmission,
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
    customFields: p.customFields || {},
  };
};

export const App: React.FC = () => {
  // Session / Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = getStoredCurrentUserRaw();
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        role: formatUserRole(parsed.role),
        status: formatUserStatus(parsed.status),
      };
    } catch {
      return null;
    }
  });

  const [authToken, setAuthToken] = useState<string | null>(() => getStoredAuthToken());

  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [rateMasked, setRateMasked] = useState<boolean>(() => currentUser?.rateMasked ?? false);
  const [isSlaOpen, setIsSlaOpen] = useState<boolean>(false);

  // Modals visibility
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isMatcherModalOpen, setIsMatcherModalOpen] = useState(false);
  const [isPlacementWizardOpen, setIsPlacementWizardOpen] = useState(false);
  const [activeCreateModal, setActiveCreateModal] = useState<
    'consultant' | 'requirement' | 'client' | 'vendor' | 'placement' | null
  >(null);

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedResumeCand, setSelectedResumeCand] = useState<Candidate | null>(null);
  const [selectedReqForDetail, setSelectedReqForDetail] = useState<Requirement | null>(null);
  const [reqDetailReturnView, setReqDetailReturnView] = useState<string>('pipeline');

  const handleOpenRequirementDetail = (req: Requirement, fromView?: string) => {
    setReqDetailReturnView(
      fromView || (currentView !== 'requirement_detail' ? currentView : reqDetailReturnView)
    );
    setSelectedReqForDetail(req);
    setCurrentView('requirement_detail');
  };

  const handleNavigateView = (nextView: string) => {
    if (nextView !== 'requirement_detail') {
      setSelectedReqForDetail(null);
    }
    setCurrentView(nextView);
  };

  // Selected items for context modals
  const [activeReq, setActiveReq] = useState<Requirement | null>(null);
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);

  // Toast Notification state
  const [toast, setToast] = useState<{ title: string; message: string; icon?: string } | null>(
    null
  );

  const sanitizeToastMessage = (rawMessage: string): string => {
    const internalPatterns = [
      /\bprisma\b/i,
      /PrismaClient/i,
      /ConnectorError/i,
      /PostgresError/i,
      /postgresql:\/\//i,
      /postgres:\/\//i,
      /Invalid `[^`]+` invocation/i,
      /Can't reach database server/i,
      /Unique constraint failed/i,
      /Foreign key constraint/i,
      /\brelation "[^"]+" does not exist\b/i,
      /\bcolumn "[^"]+" (?:of relation "[^"]+" )?does not exist\b/i,
      /\bdatabase "[^"]*" does not exist\b/i,
      /\bpg_hba\b/i,
      /\bECONNREFUSED\b/i,
    ];
    if (internalPatterns.some((pattern) => pattern.test(rawMessage))) {
      return 'An unexpected error occurred. Please try again.';
    }
    return rawMessage;
  };

  const showToast = (
    title: string,
    message: string,
    icon = 'fa-solid fa-circle-check text-emerald-500'
  ) => {
    setToast({ title, message: sanitizeToastMessage(message), icon });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const showApiErrorToast = (e: any, title: string, fallback: string) => {
    const msg = e?.response?.data?.message || e?.response?.data?.error || fallback;
    showToast(title, msg, 'fa-solid fa-circle-exclamation text-rose-500');
  };

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

  useEffect(() => {
    const handleAuthExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      resetWorkspaceState();
      setCurrentUser(null);
      setAuthToken(null);
      setShowSignOutModal(false);
      showToast(
        'Session Expired',
        customEvent.detail?.message || 'Please sign in again to continue.',
        'fa-solid fa-shield-halved text-amber-500'
      );
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

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
      const res = await apiClient.get('/candidates', { params: { page: 1, limit: 50 } });
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
        const totalConsultants = res.data.pagination?.total ?? mapped.length;
        setCandidates(mapped);
        setSidebarCounts((prev) => ({ ...prev, consultants: totalConsultants }));
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
        const mapped = res.data.data.map(mapRequirementFromApi);
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
        const mapped = res.data.data.map(mapClientFromApi);
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
        const mapped = res.data.data.map(mapVendorFromApi);
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
      const res = await apiClient.get('/sla-tasks', { params: { includeCompleted: true } });
      if (res.data?.data) {
        const raw = res.data.data;
        const mapped = raw.map((s: any) => {
          const normalizedAction = String(s.actionType || 'pipeline').toLowerCase();
          return {
            id: s.id,
            category: s.category || '',
            slaRuleTag: s.slaRuleTag || '',
            badgeClass: normalizeSlaBadgeClass(s.badgeClass),
            title: s.title || '',
            desc: s.description || s.desc || '',
            meta: s.meta || '',
            actionType: (
              ['pipeline', 'matcher', 'billable', 'checklist'].includes(normalizedAction)
                ? normalizedAction
                : 'pipeline'
            ) as SlaTask['actionType'],
            actionLabel: s.actionLabel || 'Review',
            relatedEntityType: s.relatedEntityType || undefined,
            relatedEntityId: s.relatedEntityId || undefined,
            done: s.isDone ?? s.done ?? false,
          };
        });
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
          triggerEvent: rl.triggerEvent,
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

  // 1. Fetch lightweight navigation counts, workspace currency, and workspace brand once on authentication
  useEffect(() => {
    if (!authToken && !currentUser) return;
    if (
      currentUser?.agencyName &&
      getWorkspaceBrand().agencyName === DEFAULT_WORKSPACE_BRAND.agencyName
    ) {
      setWorkspaceBrand({ agencyName: currentUser.agencyName });
    }
    fetchSidebarCounts();
    initWorkspaceCurrency();
    initWorkspaceBrand(true);
  }, [authToken]);

  const normalizedUserRole = formatUserRole(currentUser?.role);
  const isAdmin = normalizedUserRole === 'Administrator';
  const canManageDataOperations = [
    'Administrator',
    'Senior Recruiter',
    'Account Executive',
    'Bench Sales Lead',
  ].includes(normalizedUserRole);

  useEffect(() => {
    if (!currentUser) return;
    if (!isAdmin && ['custom_fields', 'settings_general', 'user_management'].includes(currentView)) {
      setCurrentView('dashboard');
    } else if (!canManageDataOperations && currentView === 'import_data') {
      setCurrentView('dashboard');
    }
  }, [currentUser, isAdmin, canManageDataOperations, currentView]);

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
        if (!loadedEntities.current.has('placements')) fetchPlacements();
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

  // Ensure clients, users, and candidates are available when opening create or wizard modals
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
  }, [activeCreateModal, isEmailModalOpen, isPlacementWizardOpen, authToken]);

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

  const updateRequirementInList = (list: Requirement[], updated: Requirement) => {
    const exists = list.some((r) => r.id === updated.id);
    return exists
      ? list.map((r) => (r.id === updated.id ? updated : r))
      : [updated, ...list];
  };

  // Handlers
  const handleStatusChange = async (req: Requirement, newStatus: any) => {
    if (newStatus === 'Onboarding') {
      const hasActivePlacement = placements.some(
        (p) =>
          p.requirementId === req.id &&
          p.status !== 'Completed' &&
          p.status !== 'Terminated'
      );
      if (!hasActivePlacement) {
        const subs = req.submissions || [];
        const preferredSub =
          subs.find((s) => s.stage === 'Selected') ||
          subs.find((s) => s.stage === 'Interview') ||
          subs.find((s) => s.stage !== 'Closed') ||
          subs[0];
        const targetCandidate =
          preferredSub?.candidate ||
          candidates.find(
            (c) =>
              (preferredSub?.candidateId && c.id === preferredSub.candidateId) ||
              (preferredSub?.fullName && c.fullName === preferredSub.fullName) ||
              (req.resourceName && c.fullName === req.resourceName)
          ) ||
          null;
        setActiveCandidate(targetCandidate);
        setActiveReq(req);
        setIsPlacementWizardOpen(true);
        return;
      }
    }

    let previousReqSnapshot: Requirement | null = null;
    setRequirements((prev) => {
      const existing = prev.find((r) => r.id === req.id);
      previousReqSnapshot = existing || req;
      const updated = existing ? { ...existing, status: newStatus } : { ...req, status: newStatus };
      return updateRequirementInList(prev, updated);
    });
    try {
      const res = await apiClient.patch(`/requirements/${req.id}/stage`, {
        status: newStatus,
        resourceName: req.resourceName,
      });
      if (res.data?.data) {
        syncUpdatedRequirement(mapRequirementFromApi(res.data.data));
      }
      fetchSidebarCounts();
      fetchSlaTasks();
      fetchAutomations();
    } catch (e: any) {
      if (previousReqSnapshot) {
        syncUpdatedRequirement(previousReqSnapshot);
      }
      console.warn('API status change failed:', e);
      showApiErrorToast(e, 'Stage Update Failed', `Could not move ${req.code} to ${newStatus}.`);
    }
  };

  const syncUpdatedRequirement = (mapped: Requirement) => {
    setRequirements((prev) => updateRequirementInList(prev, mapped));
    setSelectedReqForDetail((prev) => (prev && prev.id === mapped.id ? mapped : prev));
    setActiveReq((prev) => (prev && prev.id === mapped.id ? mapped : prev));
  };

  const handleAttachCandidates = async (req: Requirement, candidateIds: string[]) => {
    const uniqueIds = Array.from(new Set(candidateIds.filter(Boolean)));
    if (uniqueIds.length === 0) return;

    try {
      const res = await apiClient.post('/submissions', {
        requirementId: req.id,
        candidateIds: uniqueIds,
      });

      if (res.data?.requirement) {
        syncUpdatedRequirement(mapRequirementFromApi(res.data.requirement));
      } else {
        await fetchRequirements();
      }

      const attachedSet = new Set(uniqueIds);
      setCandidates((prev) =>
        prev.map((c) =>
          attachedSet.has(c.id) && c.pipelineStage === 'Available / Bench'
            ? { ...c, pipelineStage: 'Submitted' }
            : c
        )
      );

      fetchSidebarCounts();
      fetchSlaTasks();
      fetchAutomations();

      const addedCount = res.data?.addedCount ?? uniqueIds.length;
      const singleCand =
        uniqueIds.length === 1 ? candidates.find((c) => c.id === uniqueIds[0]) : null;
      showToast(
        addedCount > 1 ? 'Applicants Attached' : 'Candidate Assigned',
        singleCand
          ? `${singleCand.fullName} submitted to ${req.code}!`
          : `${addedCount} applicant${addedCount === 1 ? '' : 's'} submitted to ${req.code}!`,
        'fa-solid fa-circle-check text-emerald-400'
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Could not attach applicant(s) to requirement.';
      showToast('Attachment Notice', msg, 'fa-solid fa-triangle-exclamation text-amber-500');
      throw e;
    }
  };

  const handleAssignCandidate = async (req: Requirement, candidate: Candidate) => {
    await handleAttachCandidates(req, [candidate.id]);
  };

  const handleUpdateSubmissionStage = async (
    req: Requirement,
    submissionId: string,
    stage: RequirementSubmission['stage']
  ) => {
    try {
      const res = await apiClient.patch(`/submissions/${submissionId}/stage`, { stage });
      if (res.data?.requirement) {
        syncUpdatedRequirement(mapRequirementFromApi(res.data.requirement));
      } else {
        await fetchRequirements();
      }
      await Promise.all([
        fetchPlacements(),
        fetchCandidates(),
        fetchSidebarCounts(),
        fetchSlaTasks(),
        fetchAutomations(),
      ]);
      showToast(
        'Applicant Stage Updated',
        `Updated applicant stage on ${req.code} to ${stage}.`,
        'fa-solid fa-circle-check text-brand-600'
      );
    } catch (e: any) {
      showToast(
        'Update Failed',
        e?.response?.data?.message || 'Could not update applicant stage.',
        'fa-solid fa-circle-exclamation text-rose-500'
      );
      throw e;
    }
  };

  const handleUpdateSubmissionNotes = async (
    req: Requirement,
    submissionId: string,
    payload: {
      interviewDate?: string | null;
      interviewNotes?: string | null;
      stage?: string;
      action?: 'add' | 'edit' | 'delete';
      noteId?: string;
      noteText?: string | null;
    }
  ) => {
    try {
      const res = await apiClient.patch(`/submissions/${submissionId}/notes`, payload);
      if (res.data?.requirement) {
        syncUpdatedRequirement(mapRequirementFromApi(res.data.requirement));
      } else {
        await fetchRequirements();
      }
      await Promise.all([
        fetchCandidates(),
        fetchSidebarCounts(),
        fetchSlaTasks(),
        fetchAutomations(),
      ]);
      showToast(
        payload.action === 'delete' ? 'Note Removed' : 'Notes Saved',
        payload.action === 'delete'
          ? `Removed applicant note on ${req.code}.`
          : `Saved applicant call notes & feedback on ${req.code}.`,
        'fa-solid fa-circle-check text-brand-600'
      );
    } catch (e: any) {
      showToast(
        'Save Failed',
        e?.response?.data?.message || 'Could not save applicant notes.',
        'fa-solid fa-circle-exclamation text-rose-500'
      );
      throw e;
    }
  };

  const handleDetachSubmission = async (req: Requirement, submissionId: string) => {
    try {
      const res = await apiClient.delete(`/submissions/${submissionId}`);
      if (res.data?.data?.requirement) {
        syncUpdatedRequirement(mapRequirementFromApi(res.data.data.requirement));
      } else {
        await fetchRequirements();
      }
      await Promise.all([
        fetchPlacements(),
        fetchCandidates(),
        fetchSidebarCounts(),
        fetchSlaTasks(),
        fetchAutomations(),
      ]);
      showToast(
        'Applicant Removed',
        `Detached applicant from ${req.code}.`,
        'fa-solid fa-trash-can text-slate-500'
      );
    } catch (e: any) {
      showToast(
        'Detach Failed',
        e?.response?.data?.message || 'Could not remove applicant from requirement.',
        'fa-solid fa-circle-exclamation text-rose-500'
      );
      throw e;
    }
  };

  const handleConfirmPlacement = async (newPlacement: BillablePlacement, reqId?: string) => {
    let savedPlacement = newPlacement;
    try {
      const res = await apiClient.post('/placements', newPlacement);
      if (res.data?.data) {
        savedPlacement = normalizePlacement(res.data.data);
      }
      fetchSidebarCounts();
      fetchSlaTasks();
      fetchAutomations();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'Could not activate placement.';
      showToast('Placement Blocked', msg, 'fa-solid fa-triangle-exclamation text-amber-500');
      throw e;
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
      setRequirements((prev) => {
        const target = prev.find((r) => r.id === resolvedReqId);
        if (!target) return prev;
        return updateRequirementInList(prev, {
          ...target,
          status: 'Onboarding',
          resourceName: savedPlacement.resourceName || target.resourceName,
        });
      });
      fetchRequirements();
      fetchSlaTasks();
      fetchAutomations();
    }
    showToast(
      'Placement Activated',
      `Locked in commercial placement for ${savedPlacement.resourceName}!`,
      'fa-solid fa-file-invoice-dollar text-emerald-400'
    );
  };

  const handleUpdateCandidate = async (updated: Candidate, cvFile?: File | null) => {
    try {
      const payload = {
        fullName: updated.fullName,
        email: updated.email,
        phone: updated.phone,
        currentTitle: updated.currentTitle,
        workAuth: updated.workAuth,
        education: updated.education,
        skillset: updated.skillset,
        hourlyRateDisplay: updated.hourlyRate,
        relocation: updated.relocation,
        pipelineStage: updated.pipelineStage,
        assignedRecruiter: updated.assignedRecruiter,
        customFields: updated.customFields,
      };
      const requestBody = cvFile
        ? buildCandidateFormData(payload, cvFile)
        : updated;
      const res = await apiClient.put(`/candidates/${updated.id}`, requestBody);
      const saved: Candidate = res.data?.data ? mapCandidateFromApi(res.data.data) : updated;
      setCandidates((prev) => prev.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)));
      setSelectedResumeCand((prev) => (prev && prev.id === saved.id ? { ...prev, ...saved } : prev));
      showToast(
        cvFile ? 'CV & Consultant Updated' : 'Consultant Updated',
        cvFile ? `${saved.fullName} profile and CV file saved.` : `${saved.fullName} details saved.`,
        'fa-solid fa-circle-check text-emerald-500'
      );
    } catch (e: any) {
      console.warn('API update candidate failed:', e);
      showToast(
        'Update Failed',
        e?.response?.data?.message || e?.response?.data?.error || `Could not update ${updated.fullName}.`,
        'fa-solid fa-circle-exclamation text-rose-500'
      );
      throw e;
    }
  };

  const handleUpdateRequirement = async (updated: Requirement) => {
    try {
      const res = await apiClient.put(`/requirements/${updated.id}`, updated);
      const saved: Requirement = res.data?.data
        ? mapRequirementFromApi(res.data.data)
        : updated;
      syncUpdatedRequirement(saved);
      showToast('Requirement Updated', `${saved.opportunityTitle} saved.`, 'fa-solid fa-circle-check text-emerald-500');
    } catch (e: any) {
      console.warn('API update requirement failed:', e);
      showToast('Update Failed', e?.response?.data?.message || e?.response?.data?.error || `Could not update ${updated.opportunityTitle}.`, 'fa-solid fa-circle-exclamation text-rose-500');
      throw e;
    }
  };

  const handleUpdateVendor = async (updated: Vendor) => {
    try {
      const res = await apiClient.put(`/vendors/${updated.id}`, updated);
      const saved: Vendor = res.data?.data ? mapVendorFromApi(res.data.data) : updated;
      setVendors((prev) => prev.map((v) => (v.id === saved.id ? { ...v, ...saved } : v)));
      fetchSlaTasks();
      fetchAutomations();
      showToast('Vendor Updated', `${saved.name} details saved.`, 'fa-solid fa-circle-check text-emerald-500');
    } catch (e: any) {
      console.warn('API update vendor failed:', e);
      showToast('Update Failed', e?.response?.data?.error || `Could not update ${updated.name}.`, 'fa-solid fa-circle-exclamation text-rose-500');
      throw e;
    }
  };

  const syncCandidateStageForPlacement = (
    targetPlacement: Pick<BillablePlacement, 'id' | 'candidateId' | 'resourceName'>,
    nextStage: 'Available / Bench' | 'Billable',
    currentPlacements: BillablePlacement[]
  ) => {
    const targetName = targetPlacement.resourceName.trim().toLowerCase();
    if (nextStage === 'Available / Bench') {
      const hasOtherActive = currentPlacements.some((p) => {
        if (p.id === targetPlacement.id) return false;
        if (p.status === 'Completed' || p.status === 'Terminated') return false;
        if (targetPlacement.candidateId && p.candidateId) {
          return p.candidateId === targetPlacement.candidateId;
        }
        return p.resourceName.trim().toLowerCase() === targetName;
      });
      if (hasOtherActive) return;
    }
    setCandidates((prev) =>
      prev.map((c) =>
        (targetPlacement.candidateId && c.id === targetPlacement.candidateId) ||
        c.fullName.trim().toLowerCase() === targetName
          ? { ...c, pipelineStage: nextStage }
          : c
      )
    );
  };

  const handleUpdatePlacement = async (updated: BillablePlacement) => {
    try {
      const existingBeforeSave = placements.find((p) => p.id === updated.id);
      const billNum = parseFloat(String(updated.billing || '0').replace(/[^0-9.]/g, '')) || 0;
      const payNum = parseFloat(String(updated.payRate || '0').replace(/[^0-9.]/g, '')) || 0;
      const hourlySpread = billNum - payNum;
      const marginPct = billNum > 0 ? parseFloat(((hourlySpread / billNum) * 100).toFixed(2)) : 0;
      const payload = { ...updated, hourlySpread, marginPct };
      const res = await apiClient.put(`/placements/${updated.id}`, payload);
      const saved: BillablePlacement = res.data?.data ? normalizePlacement(res.data.data) : payload;
      setPlacements((prev) => prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)));
      const isEnding = saved.status === 'Completed' || saved.status === 'Terminated';
      if (isEnding) {
        syncCandidateStageForPlacement(saved, 'Available / Bench', placements);
      } else if (saved.status === 'Active' || saved.status === 'Extended' || saved.status === 'Expiring Soon') {
        syncCandidateStageForPlacement(saved, 'Billable', placements);
      }
      fetchCandidates();
      fetchRequirements();
      fetchSidebarCounts();
      fetchSlaTasks();
      fetchAutomations();
      const transitionedToEnded =
        isEnding && existingBeforeSave?.status !== 'Completed' && existingBeforeSave?.status !== 'Terminated';
      if (transitionedToEnded) {
        showToast(
          'Placement Ended',
          `${saved.resourceName}'s engagement marked ${saved.status} and bench availability updated.`,
          'fa-solid fa-circle-check text-emerald-500'
        );
      } else {
        showToast('Placement Updated', `${saved.resourceName} placement saved.`, 'fa-solid fa-circle-check text-emerald-500');
      }
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
      showApiErrorToast(e, 'Update Failed', `Could not update ${updated.name}.`);
      throw e;
    }
  };

  const handleDeleteCandidate = async (candidate: Candidate) => {
    try {
      await apiClient.delete(`/candidates/${candidate.id}`);
      setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
      fetchSidebarCounts();
      showToast('Consultant Removed', `${candidate.fullName} removed from roster.`, 'fa-solid fa-trash-can text-slate-500');
    } catch (e: any) {
      console.warn('API delete candidate:', e);
      showToast(
        'Delete Failed',
        e?.response?.data?.message || `Could not delete ${candidate.fullName}.`,
        'fa-solid fa-circle-exclamation text-rose-500'
      );
      throw e;
    }
  };

  const handleDeleteRequirement = async (req: Requirement) => {
    try {
      await apiClient.delete(`/requirements/${req.id}`);
      setRequirements((prev) => prev.filter((r) => r.id !== req.id));
      fetchSidebarCounts();
      fetchSlaTasks();
      showToast('Requisition Removed', `${req.code} (${req.opportunityTitle}) deleted.`, 'fa-solid fa-trash-can text-slate-500');
    } catch (e: any) {
      console.warn('API delete requirement:', e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        `Could not delete ${req.code}.`;
      showToast('Delete Blocked', msg, 'fa-solid fa-circle-exclamation text-rose-500');
      throw e;
    }
  };

  const handleDeleteClient = async (client: Client) => {
    try {
      await apiClient.delete(`/clients/${client.id}`);
      setClients((prev) => prev.filter((cl) => cl.id !== client.id));
      fetchSidebarCounts();
      showToast('Client Removed', `${client.name} deleted.`, 'fa-solid fa-trash-can text-slate-500');
    } catch (e: any) {
      console.warn('API delete client:', e);
      showApiErrorToast(e, 'Delete Failed', `Could not delete ${client.name}.`);
    }
  };

  const handleDeleteVendor = async (vendor: Vendor) => {
    try {
      await apiClient.delete(`/vendors/${vendor.id}`);
      setVendors((prev) => prev.filter((v) => v.id !== vendor.id));
      fetchSidebarCounts();
      fetchSlaTasks();
      showToast('Vendor Removed', `${vendor.name} deleted.`, 'fa-solid fa-trash-can text-slate-500');
    } catch (e: any) {
      console.warn('API delete vendor:', e);
      showApiErrorToast(e, 'Delete Failed', `Could not delete ${vendor.name}.`);
    }
  };

  const handleDeletePlacement = async (placement: BillablePlacement) => {
    try {
      await apiClient.delete(`/placements/${placement.id}`);
      const remainingPlacements = placements.filter((p) => p.id !== placement.id);
      setPlacements(remainingPlacements);
      const targetName = placement.resourceName.trim().toLowerCase();
      const stillHasPlacement = remainingPlacements.some(
        (p) =>
          (placement.candidateId && p.candidateId === placement.candidateId) ||
          p.resourceName.trim().toLowerCase() === targetName
      );
      if (!stillHasPlacement) {
        setCandidates((prev) =>
          prev.map((c) =>
            c.pipelineStage === 'Billable' &&
            ((placement.candidateId && c.id === placement.candidateId) ||
              c.fullName.trim().toLowerCase() === targetName)
              ? { ...c, pipelineStage: 'Available / Bench' }
              : c
          )
        );
      }
      fetchSidebarCounts();
      fetchSlaTasks();
      showToast('Placement Removed', `${placement.resourceName}'s placement removed.`, 'fa-solid fa-trash-can text-slate-500');
    } catch (e: any) {
      console.warn('API delete placement:', e);
      showApiErrorToast(e, 'Delete Failed', `Could not delete placement.`);
      throw e;
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

    try {
      const res = await apiClient.post(`/placements/${placement.id}/extend`, payload);
      const updatedPlacement = res.data?.data ? normalizePlacement(res.data.data) : null;
      syncCandidateStageForPlacement(updatedPlacement || placement, 'Billable', placements);
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
      fetchCandidates();
      fetchRequirements();
      fetchSidebarCounts();
      fetchSlaTasks();
      fetchAutomations();
      showToast(
        'Contract Extended',
        `SOW for ${placement.resourceName} extended through ${newEnd}!`,
        'fa-solid fa-circle-check text-emerald-400'
      );
    } catch (e: any) {
      console.warn('API placement extension failed:', e);
      showApiErrorToast(e, 'Extension Failed', `Could not extend SOW for ${placement.resourceName}.`);
      throw e;
    }
  };

  const handleTaskAction = (task: SlaTask) => {
    const action = String(task.actionType || '').toLowerCase();
    const matchedReq =
      task.relatedEntityId
        ? requirements.find((r) => r.id === task.relatedEntityId)
        : undefined;

    if (action === 'matcher') {
      setActiveReq(matchedReq || requirements[0] || null);
      setIsMatcherModalOpen(true);
    } else if (action === 'billable') {
      setCurrentView('billable');
    } else if (action === 'checklist') {
      setCurrentView('vendors');
    } else {
      if (matchedReq) {
        handleOpenRequirementDetail(matchedReq, 'pipeline');
      } else {
        handleNavigateView('pipeline');
      }
    }
    setIsSlaOpen(false);
  };

  const handleSignOut = () => {
    apiClient.post('/auth/logout').catch(() => {});
    clearAuthSession();
    resetWorkspaceState();
    setCurrentUser(null);
    setAuthToken(null);
    setShowSignOutModal(false);
    showToast(
      'Signed Out',
      `You have been signed out of ${getWorkspaceBrand().agencyName || 'your workspace'}.`,
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
    updateStoredCurrentUser(switchedUser, true);
    showToast(
      'Persona Switched',
      `Active account switched to ${persona.name} (${persona.role}).`,
      'fa-solid fa-arrows-rotate text-brand-600'
    );
  };

  const handleUpdateProfile = async (updated: User) => {
    try {
      const res = await apiClient.patch('/auth/profile', {
        name: updated.name,
        email: updated.email,
        desk: updated.desk,
      });
      const savedUser: User = res.data?.data
        ? {
            ...updated,
            ...res.data.data,
            role: formatUserRole(res.data.data.role || updated.role),
            status: formatUserStatus(res.data.data.status || updated.status),
          }
        : updated;
      setCurrentUser(savedUser);
      updateStoredCurrentUser(savedUser);
      setUsers((prev) => prev.map((u) => (u.id === savedUser.id ? savedUser : u)));
    } catch (e: any) {
      console.warn('API update profile failed:', e);
      showApiErrorToast(e, 'Profile Update Failed', 'Could not update your profile details.');
      throw e;
    }
  };

  // If unauthenticated, render the full-screen Mineral Carbon Login View
  if (!currentUser) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-[#141615]">
        {/* Global Toast Banner */}
        {toast && (
          <div
            style={{ zIndex: 9999 }}
            className="fixed bottom-5 right-5 z-[9999] max-w-md bg-white border border-slate-200 shadow-2xl rounded-xl p-4 flex items-center gap-3 animate-fade-in"
          >
            <AppIcon icon={toast.icon} className="w-4 h-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900">{toast.title}</div>
              <div className="text-[11px] text-slate-500 break-words">{toast.message}</div>
            </div>
            <button
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
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
    consultants: sidebarCounts.consultants || candidates.length,
    clients: clients.length || sidebarCounts.clients,
    vendors: vendors.length || sidebarCounts.vendors,
    billable: loadedEntities.current.has('placements')
      ? placements.filter((p) => p.status !== 'Completed' && p.status !== 'Terminated').length
      : sidebarCounts.billable,
    users: users.length || sidebarCounts.users,
    customFields: customFields.length || sidebarCounts.customFields,
    activeRules: loadedEntities.current.has('automations')
      ? rules.filter((r) => r.active).length
      : sidebarCounts.activeRules,
  };

  return (
    <div className="h-screen w-full flex overflow-hidden text-slate-800 bg-[#FAFAFA]">
      {/* Toast Banner */}
      {toast && (
        <div
          style={{ zIndex: 9999 }}
          className="fixed bottom-5 right-5 z-[9999] max-w-md bg-white border border-slate-200 card-shadow rounded-xl p-4 flex items-center gap-3 animate-fade-in"
        >
          <AppIcon icon={toast.icon} className="w-4 h-4 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900">{toast.title}</div>
            <div className="text-[11px] text-slate-500 break-words">{toast.message}</div>
          </div>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Obsidian Dark Sidebar with live counts & profile popover */}
      <Sidebar
        currentView={
          currentView === 'requirement_detail'
            ? reqDetailReturnView === 'dashboard'
              ? 'dashboard'
              : 'pipeline'
            : currentView
        }
        onNavigate={handleNavigateView}
        counts={computedSidebarCounts}
        currentUser={currentUser}
        isAdmin={isAdmin}
        canImportData={canManageDataOperations}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenSignOut={() => setShowSignOutModal(true)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Topbar with clean design matching prototype (Left: View Title, Right: + Quick Add dropdown) */}
        <Topbar
          currentView={currentView}
          canCreatePlacement={!rateMasked}
          onOpenCreateModal={(type) => setActiveCreateModal(type)}
        />

        {/* Dynamic View Body */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center py-20 text-xs font-medium text-slate-400">
                Loading workspace module...
              </div>
            }
          >
            {currentView === 'dashboard' && (
            <DashboardView
              requirements={requirements}
              candidates={candidates}
              placements={placements}
              slaTasks={slaTasks}
              rateMasked={rateMasked}
              onNavigate={handleNavigateView}
              onOpenCreateReq={() => setActiveCreateModal('requirement')}
              onSelectReq={(r) => handleOpenRequirementDetail(r, 'dashboard')}
              onUpdateReq={handleUpdateRequirement}
              onDeleteReq={canManageDataOperations ? handleDeleteRequirement : undefined}
              onPreviewResumeByName={(candName) => {
                const c = candidates.find((cand) => cand.fullName === candName);
                if (c) setSelectedResumeCand(c);
              }}
              onStatusChange={handleStatusChange}
              onOpenMatcher={(req) => {
                setActiveReq(req);
                setIsMatcherModalOpen(true);
              }}
              onOpenSlaDrawer={() => setIsSlaOpen(true)}
              onRefreshSla={async () => {
                await Promise.all([fetchSlaTasks(), fetchAutomations(), fetchSidebarCounts()]);
              }}
              showToast={showToast}
            />
          )}

          {currentView === 'pipeline' && (
            <PipelineView
              requirements={requirements}
              candidates={candidates}
              rateMasked={rateMasked}
              onStatusChange={handleStatusChange}
              onOpenEmailParser={() => setIsEmailModalOpen(true)}
              onOpenMatcher={(req) => {
                setActiveReq(req);
                setIsMatcherModalOpen(true);
              }}
              onOpenPlacementWizard={(req) => {
                setActiveCandidate(null);
                setActiveReq(req);
                setIsPlacementWizardOpen(true);
              }}
              onSelectReq={(r) => handleOpenRequirementDetail(r, 'pipeline')}
              onOpenAddReq={() => setActiveCreateModal('requirement')}
              onUpdateReq={handleUpdateRequirement}
              onDeleteReq={canManageDataOperations ? handleDeleteRequirement : undefined}
            />
          )}

          {currentView === 'requirement_detail' && (
            <RequirementDetailPage
              requirement={
                requirements.find((r) => r.id === selectedReqForDetail?.id) ||
                selectedReqForDetail
              }
              backLabel={
                reqDetailReturnView === 'dashboard' ? 'Back to Dashboard' : 'Back to Pipeline'
              }
              onBack={() => handleNavigateView(reqDetailReturnView)}
              candidates={candidates}
              rateMasked={rateMasked}
              onAssignCandidate={handleAssignCandidate}
              onAttachCandidates={handleAttachCandidates}
              onUpdateSubmissionStage={handleUpdateSubmissionStage}
              onUpdateSubmissionNotes={handleUpdateSubmissionNotes}
              onDetachSubmission={handleDetachSubmission}
              onOpenResumePreview={(cand) => setSelectedResumeCand(cand)}
              onOpenPlacementWizard={(req, cand) => {
                setActiveCandidate(cand || null);
                setActiveReq(req);
                setIsPlacementWizardOpen(true);
              }}
              onUpdateReq={handleUpdateRequirement}
            />
          )}

          {currentView === 'consultants' && (
            <ConsultantsView
              candidates={candidates}
              placements={placements}
              rateMasked={rateMasked}
              onOpenResumeParser={() => setIsResumeModalOpen(true)}
              onPreviewResume={(c) => setSelectedResumeCand(c)}
              onOpenAddConsultant={() => setActiveCreateModal('consultant')}
              onOpenCsvImport={canManageDataOperations ? () => setCurrentView('import_data') : undefined}
              onNavigateToBillable={() => setCurrentView('billable')}
              onUpdateCandidate={handleUpdateCandidate}
              onDeleteCandidate={canManageDataOperations ? handleDeleteCandidate : undefined}
            />
          )}

          {currentView === 'clients' && (
            <ClientsView
              clients={clients}
              requirements={requirements}
              placements={placements}
              onOpenAddClient={() => setActiveCreateModal('client')}
              onDeleteClient={isAdmin ? handleDeleteClient : undefined}
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
              onDeleteVendor={isAdmin ? handleDeleteVendor : undefined}
            />
          )}

          {currentView === 'billable' && (
            <BillablePlacementsView
              placements={placements}
              rateMasked={rateMasked}
              onOpenNewPlacement={!rateMasked ? () => setActiveCreateModal('placement') : undefined}
              onExtendContract={!rateMasked ? handleExtendContract : undefined}
              onUpdatePlacement={!rateMasked ? handleUpdatePlacement : undefined}
              onDeletePlacement={isAdmin && !rateMasked ? handleDeletePlacement : undefined}
              showToast={showToast}
            />
          )}

          {currentView === 'user_management' && isAdmin && (
            <UserManagementView
              users={users}
              onToggleRateMask={async (user) => {
                try {
                  await apiClient.patch(`/users/${user.id}/rate-mask`);
                  setUsers((prev) =>
                    prev.map((u) => (u.id === user.id ? { ...u, rateMasked: !u.rateMasked } : u))
                  );
                  showToast(
                    'Clearance Updated',
                    `${user.name}'s billing rate visibility is now ${
                      !user.rateMasked ? 'Masked (••••)' : 'Visible'
                    }.`
                  );
                } catch (e: any) {
                  console.warn('API toggle rate-mask:', e);
                  showApiErrorToast(e, 'Action Not Allowed', `Could not update rate visibility for ${user.name}.`);
                }
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
                  setUsers((prev) => [...prev, invitedUser]);
                  fetchSidebarCounts();
                } catch (e: any) {
                  console.warn('API invite user failed:', e);
                  showApiErrorToast(e, 'Invitation Failed', `Could not invite ${email}.`);
                  throw e;
                }
              }}
              onToggleUserStatus={async (user) => {
                try {
                  const res = await apiClient.patch(`/users/${user.id}/status`);
                  const newStatus = res.data?.data?.status === 'SUSPENDED' ? 'Suspended' : 'Active';
                  setUsers((prev) =>
                    prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
                  );
                  showToast('Status Updated', `${user.name} is now ${newStatus}.`, 'fa-solid fa-user-shield text-brand-600');
                } catch (e: any) {
                  console.warn('API toggle status failed:', e);
                  showApiErrorToast(e, 'Status Update Failed', `Could not update status for ${user.name}.`);
                }
              }}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={async (user) => {
                try {
                  await apiClient.delete(`/users/${user.id}`);
                  setUsers((prev) => prev.filter((u) => u.id !== user.id));
                  showToast('Member Removed', `${user.name} has been removed from agency roster.`, 'fa-solid fa-trash-can text-slate-500');
                } catch (e: any) {
                  console.warn('API delete user failed:', e);
                  showApiErrorToast(e, 'Remove Failed', `Could not remove ${user.name}.`);
                  throw e;
                }
              }}
              showToast={showToast}
            />
          )}

          {currentView === 'custom_fields' && isAdmin && (
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
              canManageRules={isAdmin}
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

          {currentView === 'import_data' && canManageDataOperations && (
            <ImportDataView
              onImportCandidates={(newCands) => {
                setCandidates((prev) => [...newCands, ...prev]);
              }}
              onOpenResumeParser={() => setIsResumeModalOpen(true)}
              onNavigate={setCurrentView}
              showToast={showToast}
            />
          )}

            {currentView === 'settings_general' && isAdmin && (
              <SettingsView
                activeTab="general"
                onTabChange={() => setCurrentView('settings_general')}
                showToast={showToast}
              />
            )}
          </React.Suspense>
        </main>
      </div>

      {/* SLA Action Center Flyout Drawer */}
      <SlaDrawer
        isOpen={isSlaOpen}
        onClose={() => setIsSlaOpen(false)}
        tasks={slaTasks}
        onTaskAction={handleTaskAction}
        onEvaluateSla={async () => {
          try {
            const res = await apiClient.post('/sla-tasks/evaluate');
            const count = res.data?.data?.createdTasksCount ?? 0;
            await Promise.all([fetchSlaTasks(), fetchAutomations(), fetchSidebarCounts()]);
            showToast('SLA Scan Complete', `Evaluated workspace rules (${count} new alert(s) queued).`);
          } catch {
            showToast('Scan Failed', 'Could not evaluate SLA tasks right now.', 'fa-solid fa-triangle-exclamation text-rose-500');
          }
        }}
        onToggleTaskDone={async (id) => {
          try {
            const res = await apiClient.patch(`/sla-tasks/${id}/complete`);
            const nextDone = res.data?.data?.isDone;
            setSlaTasks((prev) =>
              prev.map((t) =>
                t.id === id ? { ...t, done: typeof nextDone === 'boolean' ? nextDone : !t.done } : t
              )
            );
          } catch (e: any) {
            console.warn('API sla-task complete:', e);
            showApiErrorToast(e, 'Task Update Failed', 'Could not update SLA task status.');
          }
        }}
      />

      {/* Candidate Resume Dossier Preview Modal */}
      <ResumeViewerModal
        isOpen={Boolean(selectedResumeCand)}
        onClose={() => setSelectedResumeCand(null)}
        candidate={selectedResumeCand}
        requirements={requirements}
        rateMasked={rateMasked}
        onSubmitToReq={(candidate, req) => {
          handleAssignCandidate(req, candidate).catch(() => {});
        }}
        showToast={showToast}
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
          fetchSlaTasks();
          fetchAutomations();
        }}
        showToast={showToast}
      />

      <SkillMatcherModal
        isOpen={isMatcherModalOpen}
        onClose={() => setIsMatcherModalOpen(false)}
        requirements={requirements}
        candidates={candidates}
        initialRequirement={
          requirements.find((r) => r.id === activeReq?.id) || activeReq
        }
        onSubmitCandidate={(candidate, requirement) =>
          handleAssignCandidate(requirement, candidate)
        }
        onAttachCandidates={handleAttachCandidates}
        showToast={showToast}
      />

      <PlacementWizardModal
        isOpen={isPlacementWizardOpen}
        onClose={() => setIsPlacementWizardOpen(false)}
        candidate={activeCandidate}
        candidates={candidates}
        vendors={vendors}
        requirement={
          requirements.find((r) => r.id === activeReq?.id) || activeReq
        }
        onConfirmPlacement={handleConfirmPlacement}
        showToast={showToast}
      />

      {/* 5 Distinct Dedicated Add Modals matching Prototype lines 3700-4210 */}
      <AddConsultantModal
        isOpen={activeCreateModal === 'consultant'}
        onClose={() => setActiveCreateModal(null)}
        users={users}
        onSave={async (c, cvFile) => {
          const payload = {
            fullName: c.fullName,
            email: c.email,
            phone: c.phone,
            currentTitle: c.currentTitle,
            workAuth: c.workAuth,
            education: c.education,
            skillset: c.skillset,
            hourlyRateDisplay: c.hourlyRate,
            relocation: c.relocation,
            assignedRecruiter: c.assignedRecruiter,
            pipelineStage: c.pipelineStage,
            resumeFileName: cvFile ? cvFile.name : c.resumeName,
            resumeFormat: cvFile ? undefined : c.resumeFormat,
            customFields: c.customFields,
          };
          const requestBody = cvFile
            ? buildCandidateFormData(payload, cvFile)
            : payload;
          const res = await apiClient.post('/candidates', requestBody);
          const saved = res.data?.data ? mapCandidateFromApi(res.data.data) : c;
          fetchSidebarCounts();
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
          const res = await apiClient.post('/requirements', r);
          const saved = res.data?.data ? mapRequirementFromApi(res.data.data) : r;
          fetchSidebarCounts();
          fetchSlaTasks();
          fetchAutomations();
          setRequirements((prev) => [saved, ...prev]);
        }}
        showToast={showToast}
      />

      <AddClientModal
        isOpen={activeCreateModal === 'client'}
        onClose={() => setActiveCreateModal(null)}
        onSave={async (cl) => {
          try {
            const res = await apiClient.post('/clients', cl);
            const saved = res.data?.data?.id ? mapClientFromApi(res.data.data) : cl;
            fetchSidebarCounts();
            setClients((prev) => [saved, ...prev]);
          } catch (e: any) {
            console.warn('API save client failed:', e);
            showApiErrorToast(e, 'Client Save Failed', `Could not register ${cl.name}.`);
            throw e;
          }
        }}
        showToast={showToast}
      />

      <AddVendorModal
        isOpen={activeCreateModal === 'vendor'}
        onClose={() => setActiveCreateModal(null)}
        onSave={async (v) => {
          try {
            const res = await apiClient.post('/vendors', v);
            const saved = res.data?.data?.id ? mapVendorFromApi(res.data.data) : v;
            fetchSidebarCounts();
            setVendors((prev) => [saved, ...prev]);
          } catch (e: any) {
            console.warn('API save vendor failed:', e);
            showApiErrorToast(e, 'Vendor Save Failed', `Could not register ${v.name}.`);
            throw e;
          }
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
          try {
            const res = await apiClient.post('/placements', p);
            const saved = res.data?.data ? normalizePlacement(res.data.data) : p;
            fetchSidebarCounts();
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
              setRequirements((prev) => {
                const target = prev.find((r) => r.id === saved.requirementId);
                if (!target) return prev;
                return updateRequirementInList(prev, {
                  ...target,
                  status: 'Onboarding',
                  resourceName: saved.resourceName || target.resourceName,
                });
              });
            }
          } catch (e: any) {
            console.warn('API save placement failed:', e);
            showApiErrorToast(e, 'Placement Failed', `Could not activate placement for ${p.resourceName}.`);
            throw e;
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
