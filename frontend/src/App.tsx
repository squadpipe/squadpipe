import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { AppIcon } from './components/shared/AppIcon';
import { AiBadge } from './components/shared/AiBrand';
import { AnimatedToast } from './components/shared/MotionPrimitives';
import { useBulkResumeQueue } from './hooks/useBulkResumeQueue';
import { apiClient, AUTH_EXPIRED_EVENT, USER_SESSION_SYNC_EVENT } from './config/api.config';
import {
  clearAuthSession,
  getStoredAuthToken,
  getStoredCurrentUserRaw,
  updateStoredCurrentUser,
} from './utils/authStorage';
import { formatRateDisplay, getCurrencySymbol, initWorkspaceCurrency, parseRateNumber } from './utils/currency';
import {
  DEFAULT_AI_CAPABILITIES,
  DEFAULT_WORKSPACE_BRAND,
  getWorkspaceBrand,
  initWorkspaceBrand,
  setAiCapabilities,
  setWorkspaceBrand,
} from './utils/workspaceBrand';
import { mapCandidateFromApi, mapClientFromApi, mapRequirementFromApi, mapUserFromApi, mapVendorFromApi } from './utils/entityMappers';
import {
  BrowserHistoryRouteState,
  buildAppPath,
  buildDocumentTitle,
  parseAppRoute,
} from './utils/appRoutes';
import { buildCandidateFormData } from './utils/cvFiles';
import { normalizeSlaBadgeClass } from './utils/stageStyles';

import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { SlaDrawer } from './components/layout/SlaDrawer';
import { CommandPaletteModal } from './components/layout/CommandPaletteModal';
import { PageSkeleton } from './components/shared/PageSkeleton';
import { AccessRestrictedView } from './components/shared/AccessRestrictedView';

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
const ConsultantDetailPage = React.lazy(() =>
  import('./features/consultants/ConsultantDetailPage').then((m) => ({
    default: m.ConsultantDetailPage,
  }))
);
const ClientDetailPage = React.lazy(() =>
  import('./features/clients/ClientDetailPage').then((m) => ({
    default: m.ClientDetailPage,
  }))
);
const VendorDetailPage = React.lazy(() =>
  import('./features/vendors/VendorDetailPage').then((m) => ({
    default: m.VendorDetailPage,
  }))
);
const PlacementDetailPage = React.lazy(() =>
  import('./features/billable/PlacementDetailPage').then((m) => ({
    default: m.PlacementDetailPage,
  }))
);
const PlacementCreatePage = React.lazy(() =>
  import('./features/billable/PlacementCreatePage').then((m) => ({
    default: m.PlacementCreatePage,
  }))
);
const RequirementFromEmailPage = React.lazy(() =>
  import('./features/requirements/RequirementFromEmailPage').then((m) => ({
    default: m.RequirementFromEmailPage,
  }))
);
const RequirementFormPage = React.lazy(() =>
  import('./features/requirements/RequirementFormPage').then((m) => ({
    default: m.RequirementFormPage,
  }))
);
const RequirementFormPreviewPage = React.lazy(() =>
  import('./features/requirements/RequirementFormPreviewPage').then((m) => ({
    default: m.RequirementFormPreviewPage,
  }))
);
const ConsultantCreatePage = React.lazy(() =>
  import('./features/consultants/ConsultantCreatePage').then((m) => ({
    default: m.ConsultantCreatePage,
  }))
);
const ResumeImportPage = React.lazy(() =>
  import('./features/import-data/ResumeImportPage').then((m) => ({
    default: m.ResumeImportPage,
  }))
);
const CsvImportPage = React.lazy(() =>
  import('./features/import-data/CsvImportPage').then((m) => ({
    default: m.CsvImportPage,
  }))
);
const SettingsView = React.lazy(() =>
  import('./features/settings/SettingsView').then((m) => ({
    default: m.SettingsView,
  }))
);
const TeamPerformanceView = React.lazy(() =>
  import('./features/team-performance/TeamPerformanceView').then((m) => ({
    default: m.TeamPerformanceView,
  }))
);
const UsageView = React.lazy(() =>
  import('./features/usage/UsageView').then((m) => ({
    default: m.UsageView,
  }))
);
const PublicRequirementApplyView = React.lazy(() =>
  import('./features/public/PublicRequirementApplyView').then((m) => ({
    default: m.PublicRequirementApplyView,
  }))
);

// Auth View
import { LoginView } from './features/auth/LoginView';

// Modals
import { SkillMatcherModal } from './features/modals/SkillMatcherModal';
import { ResumeParserModal } from './components/modals/ResumeParserModal';
import { CsvImportModal } from './components/modals/CsvImportModal';
import { AddClientModal } from './components/modals/create/AddClientModal';
import { AddVendorModal } from './components/modals/create/AddVendorModal';
import { SignOutModal } from './components/modals/SignOutModal';
import { ProfileModal } from './components/modals/ProfileModal';

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

  const parseNum = (val: any): number => parseRateNumber(val, 0);

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
  const publicApplyToken = React.useMemo(() => {
    const match = window.location.pathname.match(/^\/apply\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }, []);

  const initialRoute = React.useMemo(
    () =>
      publicApplyToken
        ? { view: 'dashboard' }
        : parseAppRoute(window.location.pathname, window.location.search),
    [publicApplyToken]
  );

  const [currentView, setCurrentView] = useState<string>(() => initialRoute.view);
  const [routeTarget, setRouteTarget] = useState<{
    view: string;
    entityId?: string;
    query?: Record<string, string>;
  }>(() => initialRoute);
  const [resolvingRouteId, setResolvingRouteId] = useState<string | null>(
    () => initialRoute.entityId || null
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('squadpipe_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [rateMasked, setRateMasked] = useState<boolean>(() => currentUser?.rateMasked ?? false);
  const [isSlaOpen, setIsSlaOpen] = useState<boolean>(false);

  // Modals visibility
  const [isMatcherModalOpen, setIsMatcherModalOpen] = useState(false);
  const [isInlineResumeModalOpen, setIsInlineResumeModalOpen] = useState(false);
  const [isInlineCsvModalOpen, setIsInlineCsvModalOpen] = useState(false);
  const [inlineImportTargetReq, setInlineImportTargetReq] = useState<Requirement | null>(null);
  const [benchPickerCloseToken, setBenchPickerCloseToken] = useState(0);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [activeCreateModal, setActiveCreateModal] = useState<
    'client' | 'vendor' | null
  >(null);
  const [workflowReturnView, setWorkflowReturnView] = useState<string>(() => {
    if (initialRoute.query?.from) return initialRoute.query.from;
    if (initialRoute.view === 'requirement_from_email' || initialRoute.view === 'requirement_new') {
      return 'pipeline';
    }
    if (initialRoute.view === 'requirement_edit') return 'requirement_detail';
    if (initialRoute.view === 'consultant_new') return 'consultants';
    if (initialRoute.view === 'consultant_edit') return 'consultant_detail';
    if (initialRoute.view === 'import_resume' || initialRoute.view === 'import_csv') {
      return initialRoute.query?.requirementId ? 'requirement_detail' : 'import_data';
    }
    if (initialRoute.view === 'placement_new') {
      return initialRoute.query?.requirementId ? 'requirement_detail' : 'billable';
    }
    return 'dashboard';
  });
  const [workflowReturnReqId, setWorkflowReturnReqId] = useState<string | null>(
    () => initialRoute.query?.requirementId || null
  );
  const [placementLaunchContext, setPlacementLaunchContext] = useState<{
    requirement?: Requirement | null;
    candidate?: Candidate | null;
  } | null>(null);
  const consultantNewReturnViewRef = React.useRef<string>(
    initialRoute.view === 'consultant_new' && initialRoute.query?.from
      ? initialRoute.query.from
      : 'consultants'
  );

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedReqForDetail, setSelectedReqForDetail] = useState<Requirement | null>(null);
  const [reqDetailReturnView, setReqDetailReturnView] = useState<string>('pipeline');
  const [selectedCandForDetail, setSelectedCandForDetail] = useState<Candidate | null>(null);
  const [candDetailReturnView, setCandDetailReturnView] = useState<string>('consultants');
  const [candDetailInitialEdit, setCandDetailInitialEdit] = useState<boolean>(false);
  const [selectedClientForDetail, setSelectedClientForDetail] = useState<Client | null>(null);
  const [clientDetailReturnView, setClientDetailReturnView] = useState<string>('clients');
  const [clientDetailInitialEdit, setClientDetailInitialEdit] = useState<boolean>(false);
  const [selectedVendorForDetail, setSelectedVendorForDetail] = useState<Vendor | null>(null);
  const [vendorDetailReturnView, setVendorDetailReturnView] = useState<string>('vendors');
  const [vendorDetailInitialEdit, setVendorDetailInitialEdit] = useState<boolean>(false);
  const [vendorDetailInitialTab, setVendorDetailInitialTab] = useState<
    'consultants' | 'contacts' | 'placements' | 'terms'
  >('consultants');
  const [vendorDetailAuditTask, setVendorDetailAuditTask] = useState<SlaTask | null>(null);
  const [selectedPlacementForDetail, setSelectedPlacementForDetail] =
    useState<BillablePlacement | null>(null);
  const [placementDetailReturnView, setPlacementDetailReturnView] = useState<string>('billable');

  const handleToggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('squadpipe_sidebar_collapsed', String(next));
      } catch {
        // Ignore storage errors in restricted environments
      }
      return next;
    });
  };

  const pushRouteUrl = (
    nextView: string,
    options?: {
      entityId?: string;
      returnView?: string;
      returnReqId?: string;
      query?: Record<string, string | undefined | null>;
      replace?: boolean;
    }
  ) => {
    if (publicApplyToken || (!authToken && !currentUserRef.current)) return;
    const nextPath = buildAppPath(nextView, options?.entityId, options?.query);
    const cleanedQuery = options?.query
      ? (Object.fromEntries(
        Object.entries(options.query).filter(([, v]) => Boolean(v && String(v).trim()))
      ) as Record<string, string>)
      : undefined;
    const historyState: BrowserHistoryRouteState = {
      view: nextView,
      entityId: options?.entityId,
      returnView: options?.returnView,
      returnReqId: options?.returnReqId,
      query: cleanedQuery && Object.keys(cleanedQuery).length > 0 ? cleanedQuery : undefined,
    };
    const currentFullPath = `${window.location.pathname}${window.location.search}`;
    if (options?.replace || currentFullPath === nextPath) {
      window.history.replaceState(historyState, '', nextPath);
    } else {
      window.history.pushState(historyState, '', nextPath);
    }
  };

  const handleOpenRequirementDetail = (
    req: Requirement,
    fromView?: string,
    options?: { skipHistory?: boolean }
  ) => {
    const returnView =
      fromView || (currentView !== 'requirement_detail' ? currentView : reqDetailReturnView);
    setReqDetailReturnView(returnView);
    setSelectedReqForDetail(req);
    setResolvingRouteId(null);
    setRouteTarget({ view: 'requirement_detail', entityId: req.id });
    setCurrentView('requirement_detail');
    if (!options?.skipHistory) {
      pushRouteUrl('requirement_detail', { entityId: req.id, returnView });
    }
  };

  const handleOpenRequirementEdit = (
    req: Requirement,
    fromView?: string,
    options?: { skipHistory?: boolean }
  ) => {
    const originView =
      fromView || (currentView !== 'requirement_edit' ? currentView : workflowReturnView);
    if (originView && originView !== 'requirement_detail' && originView !== 'requirement_edit') {
      setReqDetailReturnView(originView);
    }
    setWorkflowReturnView(originView || 'pipeline');
    setWorkflowReturnReqId(req.id);
    setSelectedReqForDetail(req);
    setResolvingRouteId(null);
    setRouteTarget({ view: 'requirement_edit', entityId: req.id });
    setCurrentView('requirement_edit');
    if (!options?.skipHistory) {
      pushRouteUrl('requirement_edit', {
        entityId: req.id,
        returnView: originView || 'pipeline',
        returnReqId: req.id,
      });
    }
  };

  const handleOpenRequirementFormPreview = (
    req: Requirement,
    templateId?: string,
    fromView?: string,
    options?: { skipHistory?: boolean }
  ) => {
    const originView =
      fromView ||
      (reqDetailReturnView && reqDetailReturnView !== 'requirement_form_preview'
        ? reqDetailReturnView
        : 'pipeline');
    if (originView && originView !== 'requirement_detail' && originView !== 'requirement_form_preview') {
      setReqDetailReturnView(originView);
    }
    setSelectedReqForDetail(req);
    setResolvingRouteId(null);
    const query = templateId ? { templateId } : undefined;
    setRouteTarget({ view: 'requirement_form_preview', entityId: req.id, query });
    setCurrentView('requirement_form_preview');
    if (!options?.skipHistory) {
      pushRouteUrl('requirement_form_preview', {
        entityId: req.id,
        returnView: originView,
        returnReqId: req.id,
        query,
      });
    }
  };

  const handleOpenConsultantDetail = (
    cand: Candidate,
    startEditing = false,
    fromView?: string,
    options?: { skipHistory?: boolean }
  ) => {
    const returnView =
      fromView || (currentView !== 'consultant_detail' ? currentView : candDetailReturnView);
    setCandDetailReturnView(returnView);
    setSelectedCandForDetail(cand);
    setCandDetailInitialEdit(Boolean(startEditing));
    setResolvingRouteId(null);
    setRouteTarget({ view: 'consultant_detail', entityId: cand.id });
    setCurrentView('consultant_detail');
    if (!options?.skipHistory) {
      pushRouteUrl('consultant_detail', { entityId: cand.id, returnView });
    }
  };

  const handleOpenConsultantEdit = (
    cand: Candidate,
    fromView?: string,
    options?: { skipHistory?: boolean }
  ) => {
    const originView =
      fromView || (currentView !== 'consultant_edit' ? currentView : workflowReturnView);
    if (originView && originView !== 'consultant_detail' && originView !== 'consultant_edit') {
      setCandDetailReturnView(originView);
    }
    setWorkflowReturnView(originView || 'consultants');
    setSelectedCandForDetail(cand);
    setCandDetailInitialEdit(false);
    setResolvingRouteId(null);
    setRouteTarget({ view: 'consultant_edit', entityId: cand.id });
    setCurrentView('consultant_edit');
    if (!options?.skipHistory) {
      pushRouteUrl('consultant_edit', {
        entityId: cand.id,
        returnView: originView || 'consultants',
      });
    }
  };

  const handleOpenClientDetail = (
    client: Client,
    startEditing = false,
    fromView?: string,
    options?: { skipHistory?: boolean }
  ) => {
    const returnView =
      fromView || (currentView !== 'client_detail' ? currentView : clientDetailReturnView);
    setClientDetailReturnView(returnView);
    setSelectedClientForDetail(client);
    setClientDetailInitialEdit(Boolean(startEditing));
    setResolvingRouteId(null);
    setRouteTarget({ view: 'client_detail', entityId: client.id });
    setCurrentView('client_detail');
    if (!options?.skipHistory) {
      pushRouteUrl('client_detail', { entityId: client.id, returnView });
    }
  };

  const handleOpenVendorDetail = (
    vendor: Vendor,
    startEditing = false,
    fromView?: string,
    options?: {
      initialTab?: 'consultants' | 'contacts' | 'placements' | 'terms';
      auditTask?: SlaTask | null;
      skipHistory?: boolean;
    }
  ) => {
    const returnView =
      fromView || (currentView !== 'vendor_detail' ? currentView : vendorDetailReturnView);
    setVendorDetailReturnView(returnView);
    setSelectedVendorForDetail(vendor);
    setVendorDetailInitialEdit(Boolean(startEditing));
    setVendorDetailInitialTab(options?.initialTab || (options?.auditTask ? 'terms' : 'consultants'));
    setVendorDetailAuditTask(options?.auditTask || null);
    setResolvingRouteId(null);
    setRouteTarget({ view: 'vendor_detail', entityId: vendor.id });
    setCurrentView('vendor_detail');
    if (!options?.skipHistory) {
      pushRouteUrl('vendor_detail', { entityId: vendor.id, returnView });
    }
  };

  const handleOpenPlacementDetail = (
    placement: BillablePlacement,
    fromView?: string,
    options?: { skipHistory?: boolean }
  ) => {
    const returnView =
      fromView || (currentView !== 'placement_detail' ? currentView : placementDetailReturnView);
    setPlacementDetailReturnView(returnView);
    setSelectedPlacementForDetail(placement);
    setResolvingRouteId(null);
    setRouteTarget({ view: 'placement_detail', entityId: placement.id });
    setCurrentView('placement_detail');
    if (!options?.skipHistory) {
      pushRouteUrl('placement_detail', { entityId: placement.id, returnView });
    }
  };

  const handleNavigateView = (nextView: string, options?: { skipHistory?: boolean }) => {
    if (!['requirement_detail', 'consultant_detail', 'placement_detail'].includes(nextView)) {
      setSelectedReqForDetail(null);
    }
    if (!['consultant_detail', 'placement_detail'].includes(nextView)) {
      setSelectedCandForDetail(null);
      setCandDetailInitialEdit(false);
    }
    if (!['client_detail', 'requirement_detail', 'placement_detail'].includes(nextView)) {
      setSelectedClientForDetail(null);
      setClientDetailInitialEdit(false);
    }
    if (!['vendor_detail', 'placement_detail'].includes(nextView)) {
      setSelectedVendorForDetail(null);
      setVendorDetailInitialEdit(false);
      setVendorDetailAuditTask(null);
      setVendorDetailInitialTab('consultants');
    }
    if (
      ![
        'placement_detail',
        'client_detail',
        'vendor_detail',
        'consultant_detail',
        'requirement_detail',
      ].includes(nextView)
    ) {
      setSelectedPlacementForDetail(null);
    }
    setResolvingRouteId(null);
    setRouteTarget({ view: nextView });
    setCurrentView(nextView);
    if (!options?.skipHistory) {
      pushRouteUrl(nextView);
    }
  };

  const handleOpenApplicationFormPage = (
    target: { mode: 'list' } | { mode: 'new' } | { mode: 'edit'; formId: string },
    options?: { skipHistory?: boolean }
  ) => {
    setResolvingRouteId(null);
    if (target.mode === 'edit') {
      setRouteTarget({ view: 'application_form_edit', entityId: target.formId });
      setCurrentView('application_form_edit');
      if (!options?.skipHistory) {
        pushRouteUrl('application_form_edit', {
          entityId: target.formId,
          returnView: 'application_forms',
        });
      }
      return;
    }
    handleNavigateView(
      target.mode === 'new' ? 'application_form_new' : 'application_forms',
      options
    );
  };

  const handleOpenWorkflowPage = (
    targetView:
      | 'requirement_new'
      | 'requirement_from_email'
      | 'consultant_new'
      | 'import_resume'
      | 'import_csv'
      | 'placement_new',
    options?: {
      requirementId?: string;
      candidateId?: string;
      fromView?: string;
      returnReqId?: string;
      skipHistory?: boolean;
      replaceHistory?: boolean;
    }
  ) => {
    const resolvedFrom =
      options?.fromView ||
      (![
        'requirement_new',
        'requirement_edit',
        'requirement_from_email',
        'consultant_new',
        'import_resume',
        'import_csv',
        'placement_new',
      ].includes(currentView)
        ? currentView
        : workflowReturnView);
    const resolvedReturnReqId =
      options?.returnReqId ||
      options?.requirementId ||
      (resolvedFrom === 'requirement_detail'
        ? selectedReqForDetail?.id || workflowReturnReqId
        : null) ||
      undefined;

    if (targetView === 'consultant_new' && resolvedFrom && resolvedFrom !== 'import_resume') {
      consultantNewReturnViewRef.current = resolvedFrom;
    }

    setWorkflowReturnView(resolvedFrom);
    setWorkflowReturnReqId(resolvedReturnReqId || null);
    setResolvingRouteId(null);

    const query: Record<string, string> = {};
    if (options?.requirementId) query.requirementId = options.requirementId;
    if (options?.candidateId) query.candidateId = options.candidateId;
    if (resolvedFrom) query.from = resolvedFrom;
    const normalizedQuery = Object.keys(query).length > 0 ? query : undefined;

    setRouteTarget({ view: targetView, query: normalizedQuery });
    setCurrentView(targetView);

    if (!options?.skipHistory) {
      pushRouteUrl(targetView, {
        returnView: resolvedFrom,
        returnReqId: resolvedReturnReqId,
        query: normalizedQuery,
        replace: options?.replaceHistory,
      });
    }
  };

  const handleOpenPlacementPage = (
    req?: Requirement | null,
    cand?: Candidate | null,
    fromViewOverride?: string
  ) => {
    setPlacementLaunchContext({
      requirement: req || null,
      candidate: cand || null,
    });
    handleOpenWorkflowPage('placement_new', {
      requirementId: req?.id,
      candidateId: cand?.id,
      fromView: fromViewOverride || currentView,
      returnReqId: req?.id,
    });
  };

  const handleReturnFromWorkflowPage = (fallbackView?: string) => {
    const targetView = workflowReturnView || fallbackView;
    if (targetView === 'consultant_new') {
      handleOpenWorkflowPage('consultant_new', {
        fromView: consultantNewReturnViewRef.current || 'consultants',
      });
      return;
    }
    if (targetView === 'requirement_detail') {
      const reqId = workflowReturnReqId || selectedReqForDetail?.id;
      const matched = reqId ? requirements.find((r) => r.id === reqId) : selectedReqForDetail;
      if (matched) {
        handleOpenRequirementDetail(matched, reqDetailReturnView || 'pipeline');
        return;
      }
      if (reqId) {
        setReqDetailReturnView('pipeline');
        setSelectedReqForDetail(null);
        setResolvingRouteId(reqId);
        setRouteTarget({ view: 'requirement_detail', entityId: reqId });
        setCurrentView('requirement_detail');
        pushRouteUrl('requirement_detail', { entityId: reqId, returnView: 'pipeline' });
        return;
      }
    }
    handleNavigateView(targetView || 'dashboard');
  };

  // Selected items for context modals
  const [activeReq, setActiveReq] = useState<Requirement | null>(null);

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
    icon = 'success'
  ) => {
    setToast({ title, message: sanitizeToastMessage(message), icon });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const showApiErrorToast = (e: any, title: string, fallback: string) => {
    const msg = e?.response?.data?.message || e?.response?.data?.error || fallback;
    showToast(title, msg, 'error');
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
  const resetBulkResumeRef = React.useRef<() => void>(() => { });

  const resetWorkspaceState = () => {
    resetBulkResumeRef.current();
    loadedEntities.current.clear();
    setAiCapabilities(DEFAULT_AI_CAPABILITIES);
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
        'shield-warn'
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

  const fetchClients = async (): Promise<Client[]> => {
    try {
      const res = await apiClient.get('/clients');
      if (res.data?.data) {
        const mapped = res.data.data.map(mapClientFromApi);
        setClients(mapped);
        setSidebarCounts((prev) => ({ ...prev, clients: mapped.length }));
        loadedEntities.current.add('clients');
        return mapped;
      }
    } catch (e) {
      console.warn('API fetch clients:', e);
    }
    return [];
  };

  const fetchVendors = async (): Promise<Vendor[]> => {
    try {
      const res = await apiClient.get('/vendors');
      if (res.data?.data) {
        const mapped: Vendor[] = res.data.data.map(mapVendorFromApi);
        setVendors(mapped);
        setSidebarCounts((prev) => ({ ...prev, vendors: mapped.length }));
        loadedEntities.current.add('vendors');
        return mapped;
      }
    } catch (e) {
      console.warn('API fetch vendors:', e);
    }
    return [];
  };

  const fetchPlacements = async (): Promise<BillablePlacement[]> => {
    try {
      const res = await apiClient.get('/placements');
      if (res.data?.data) {
        const mapped = res.data.data.map(normalizePlacement);
        setPlacements(mapped);
        setSidebarCounts((prev) => ({ ...prev, billable: mapped.length }));
        loadedEntities.current.add('placements');
        return mapped;
      }
    } catch (e) {
      console.warn('API fetch placements:', e);
    }
    return [];
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
          isSuperAdmin: Boolean(u.isSuperAdmin),
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
            agentPayload: s.agentPayload || null,
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
          if (upper === 'FEEDBACK') return 'Feedback';
          if (upper === 'STALE_REQ') return 'STALE_REQ';
          if (upper === 'INTERVIEW') return 'Interview';
          if (upper === 'CONTRACT') return 'Contract';
          if (upper === 'COMPLIANCE') return 'Compliance';
          if (upper === 'CUSTOM') return 'Custom';
          return cat || 'Feedback';
        };
        const mappedRules = raw.map((rl: any) => ({
          id: rl.id,
          tenantId: rl.tenantId,
          name: rl.name,
          category: formatCategory(rl.category),
          triggerEvent: rl.triggerEvent,
          icon: rl.icon || 'settings',
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

  const loadEntitiesForView = (view: string, adminAccess: boolean) => {
    switch (view) {
      case 'dashboard':
        // Only fetch Dashboard requirements, candidates, placements, and SLA radar
        if (!loadedEntities.current.has('requirements')) fetchRequirements();
        if (!loadedEntities.current.has('candidates')) fetchCandidates();
        if (!loadedEntities.current.has('placements')) fetchPlacements();
        if (!loadedEntities.current.has('slaTasks')) fetchSlaTasks();
        break;

      case 'pipeline':
      case 'requirement_detail':
      case 'requirement_form_preview':
        if (!loadedEntities.current.has('requirements')) fetchRequirements();
        if (!loadedEntities.current.has('candidates')) fetchCandidates();
        break;

      case 'requirement_from_email':
        if (!loadedEntities.current.has('clients')) fetchClients();
        if (!loadedEntities.current.has('users')) fetchUsers();
        break;

      case 'import_resume':
        if (!loadedEntities.current.has('users')) fetchUsers();
        if (!loadedEntities.current.has('requirements')) fetchRequirements();
        break;

      case 'import_csv':
        if (!loadedEntities.current.has('requirements')) fetchRequirements();
        break;

      case 'consultants':
      case 'consultant_detail':
        if (!loadedEntities.current.has('candidates')) fetchCandidates();
        if (!loadedEntities.current.has('placements')) fetchPlacements();
        if (!loadedEntities.current.has('vendors')) fetchVendors();
        break;

      case 'clients':
      case 'client_detail':
        if (!loadedEntities.current.has('clients')) fetchClients();
        if (!loadedEntities.current.has('requirements')) fetchRequirements();
        if (!loadedEntities.current.has('placements')) fetchPlacements();
        break;

      case 'vendors':
      case 'vendor_detail':
        if (!loadedEntities.current.has('vendors')) fetchVendors();
        if (view === 'vendor_detail') {
          if (!loadedEntities.current.has('candidates')) fetchCandidates();
          if (!loadedEntities.current.has('placements')) fetchPlacements();
        }
        break;

      case 'billable':
      case 'placement_new':
      case 'placement_detail':
        if (!loadedEntities.current.has('placements')) fetchPlacements();
        if (!loadedEntities.current.has('candidates')) fetchCandidates();
        if (!loadedEntities.current.has('clients')) fetchClients();
        if (!loadedEntities.current.has('vendors')) fetchVendors();
        if (!loadedEntities.current.has('requirements')) fetchRequirements();
        if (!loadedEntities.current.has('users')) fetchUsers();
        break;

      case 'user_management':
        if (adminAccess && !loadedEntities.current.has('users')) fetchUsers();
        break;

      case 'automation':
        if (!loadedEntities.current.has('automations')) fetchAutomations();
        break;

      case 'custom_fields':
        if (adminAccess && !loadedEntities.current.has('custom_fields')) fetchCustomFields();
        break;

      default:
        break;
    }
  };

  // Live permission & rate-masking synchronization (page load, throttled tab focus, and API headers)
  const SESSION_SYNC_COOLDOWN_MS = 60_000;
  const currentViewRef = React.useRef(currentView);
  currentViewRef.current = currentView;
  const currentUserRef = React.useRef(currentUser);
  currentUserRef.current = currentUser;
  const rateMaskedRef = React.useRef(rateMasked);
  rateMaskedRef.current = rateMasked;
  const selectedDetailIdsRef = React.useRef({
    candId: selectedCandForDetail?.id,
    reqId: selectedReqForDetail?.id,
    placementId: selectedPlacementForDetail?.id,
  });
  selectedDetailIdsRef.current = {
    candId: selectedCandForDetail?.id,
    reqId: selectedReqForDetail?.id,
    placementId: selectedPlacementForDetail?.id,
  };
  const lastSessionSyncAtRef = React.useRef<number>(0);
  const inFlightSessionSyncRef = React.useRef<boolean>(false);

  const applySyncedUser = React.useCallback(
    (incoming: Partial<User> & { role?: string; rateMasked?: boolean }) => {
      const prevUser = currentUserRef.current;
      if (!prevUser) return;

      const prevRole = formatUserRole(prevUser.role);
      const nextRole = incoming.role ? formatUserRole(incoming.role) : prevRole;
      const prevMasked = Boolean(rateMaskedRef.current);
      const nextMasked =
        typeof incoming.rateMasked === 'boolean' ? incoming.rateMasked : prevMasked;

      const roleChanged = prevRole !== nextRole;
      const maskChanged = prevMasked !== nextMasked;

      const mergedUser: User = {
        ...prevUser,
        ...incoming,
        role: nextRole,
        status: formatUserStatus(incoming.status || prevUser.status),
        rateMasked: nextMasked,
      };

      const hasDetailsChange =
        roleChanged ||
        maskChanged ||
        mergedUser.name !== prevUser.name ||
        mergedUser.email !== prevUser.email ||
        mergedUser.agencyName !== prevUser.agencyName ||
        mergedUser.desk !== prevUser.desk;

      if (hasDetailsChange) {
        currentUserRef.current = mergedUser;
        setCurrentUser(mergedUser);
        updateStoredCurrentUser(mergedUser);
      }

      if (maskChanged) {
        rateMaskedRef.current = nextMasked;
        setRateMasked(nextMasked);
        if (nextMasked) {
          setCandidates([]);
          setRequirements([]);
          setPlacements([]);
          setSelectedCandForDetail((prev) => (prev ? { ...prev, hourlyRate: '••••••' } : null));
          setSelectedReqForDetail((prev) =>
            prev ? { ...prev, targetBillRate: 0, targetPayRate: 0 } : null
          );
          setSelectedPlacementForDetail((prev) =>
            prev
              ? { ...prev, billing: '••••••', payRate: '••••••', hourlySpread: 0, marginPct: 0 }
              : null
          );
        }
      }

      if (roleChanged || maskChanged) {
        const nextIsAdmin = nextRole === 'Administrator';
        loadedEntities.current.clear();
        fetchSidebarCounts();
        loadEntitiesForView(currentViewRef.current, nextIsAdmin);
        if (maskChanged) {
          const { candId, reqId, placementId } = selectedDetailIdsRef.current;
          if (currentViewRef.current === 'consultant_detail' && candId) {
            apiClient
              .get(`/candidates/${candId}`)
              .then((r) => r.data?.data && setSelectedCandForDetail(mapCandidateFromApi(r.data.data)))
              .catch(() => { });
          } else if (currentViewRef.current === 'requirement_detail' && reqId) {
            apiClient
              .get(`/requirements/${reqId}`)
              .then((r) => r.data?.data && setSelectedReqForDetail(mapRequirementFromApi(r.data.data)))
              .catch(() => { });
          } else if (currentViewRef.current === 'placement_detail' && placementId) {
            apiClient
              .get(`/placements/${placementId}`)
              .then((r) => r.data?.data && setSelectedPlacementForDetail(normalizePlacement(r.data.data)))
              .catch(() => { });
          }
        }
      }
    },
    []
  );

  const syncUserSession = React.useCallback(
    async (lite: boolean) => {
      if (!authToken && !currentUserRef.current) return;
      if (inFlightSessionSyncRef.current) return;
      inFlightSessionSyncRef.current = true;
      lastSessionSyncAtRef.current = Date.now();
      try {
        const res = await apiClient.get('/auth/me', {
          params: lite ? { lite: '1' } : undefined,
        });
        if (res.data?.user) {
          applySyncedUser(res.data.user);
        }
      } catch {
        // 401/suspended responses are handled by apiClient interceptor
      } finally {
        inFlightSessionSyncRef.current = false;
      }
    },
    [authToken, applySyncedUser]
  );

  useEffect(() => {
    const handleHeaderSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ role?: string; rateMasked?: boolean }>;
      if (!customEvent.detail || !currentUserRef.current) return;
      lastSessionSyncAtRef.current = Date.now();
      applySyncedUser(customEvent.detail);
    };
    window.addEventListener(USER_SESSION_SYNC_EVENT, handleHeaderSync);
    return () => window.removeEventListener(USER_SESSION_SYNC_EVENT, handleHeaderSync);
  }, [applySyncedUser]);

  useEffect(() => {
    if (!authToken) return;

    // Sync full session once on initial page load / refresh (skip redundant call right after login)
    if (Date.now() - lastSessionSyncAtRef.current > 2_000) {
      syncUserSession(false);
    }

    const onVisibilityOrFocus = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastSessionSyncAtRef.current < SESSION_SYNC_COOLDOWN_MS) return;
      syncUserSession(true);
    };

    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
    };
  }, [authToken, syncUserSession]);

  // 2. ON-DEMAND / VIEW-SCOPED FETCHING: Only call APIs for the active view when opened!
  useEffect(() => {
    if (!authToken && !currentUser) return;
    loadEntitiesForView(currentView, isAdmin);
  }, [currentView, authToken]);

  const routeStateRef = React.useRef({
    requirements,
    candidates,
    clients,
    vendors,
    placements,
    selectedReqForDetail,
    selectedCandForDetail,
    selectedClientForDetail,
    selectedVendorForDetail,
    selectedPlacementForDetail,
  });
  routeStateRef.current = {
    requirements,
    candidates,
    clients,
    vendors,
    placements,
    selectedReqForDetail,
    selectedCandForDetail,
    selectedClientForDetail,
    selectedVendorForDetail,
    selectedPlacementForDetail,
  };

  const routeHandlersRef = React.useRef({
    handleNavigateView,
    handleOpenRequirementDetail,
    handleOpenRequirementEdit,
    handleOpenRequirementFormPreview,
    handleOpenConsultantDetail,
    handleOpenConsultantEdit,
    handleOpenClientDetail,
    handleOpenVendorDetail,
    handleOpenPlacementDetail,
    handleOpenWorkflowPage,
  });
  routeHandlersRef.current = {
    handleNavigateView,
    handleOpenRequirementDetail,
    handleOpenRequirementEdit,
    handleOpenRequirementFormPreview,
    handleOpenConsultantDetail,
    handleOpenConsultantEdit,
    handleOpenClientDetail,
    handleOpenVendorDetail,
    handleOpenPlacementDetail,
    handleOpenWorkflowPage,
  };

  // Global Cmd+K / Ctrl+K shortcut for Command Palette
  useEffect(() => {
    if (publicApplyToken || (!authToken && !currentUser)) return;
    const handleGlobalCmdK = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalCmdK);
    return () => window.removeEventListener('keydown', handleGlobalCmdK);
  }, [publicApplyToken, authToken, currentUser]);

  // Sync `/` -> `/dashboard` once authenticated (preserving query tokens like ?inviteToken=)
  useEffect(() => {
    if (publicApplyToken || (!authToken && !currentUser)) return;
    if (window.location.pathname === '/' && !window.location.search) {
      pushRouteUrl('dashboard', { replace: true });
    }
  }, [publicApplyToken, authToken, currentUser]);

  // Keep browser document title aligned with active view or detail record
  useEffect(() => {
    if (publicApplyToken || (!authToken && !currentUser)) {
      document.title = 'SquadPipe — Staffing Workflow Platform';
      return;
    }
    let recordLabel: string | undefined;
    if (
      (currentView === 'requirement_detail' ||
        currentView === 'requirement_edit' ||
        currentView === 'requirement_form_preview') &&
      selectedReqForDetail
    ) {
      const baseLabel = selectedReqForDetail.code
        ? `${selectedReqForDetail.code} · ${selectedReqForDetail.opportunityTitle}`
        : selectedReqForDetail.opportunityTitle;
      recordLabel =
        currentView === 'requirement_edit'
          ? `Edit ${baseLabel}`
          : currentView === 'requirement_form_preview'
            ? `Form Preview · ${baseLabel}`
            : baseLabel;
    } else if (
      (currentView === 'consultant_detail' || currentView === 'consultant_edit') &&
      selectedCandForDetail
    ) {
      recordLabel =
        currentView === 'consultant_edit'
          ? `Edit ${selectedCandForDetail.fullName}`
          : selectedCandForDetail.fullName;
    } else if (currentView === 'client_detail' && selectedClientForDetail) {
      recordLabel = selectedClientForDetail.name;
    } else if (currentView === 'vendor_detail' && selectedVendorForDetail) {
      recordLabel = selectedVendorForDetail.name;
    } else if (currentView === 'placement_detail' && selectedPlacementForDetail) {
      recordLabel =
        selectedPlacementForDetail.resourceName || selectedPlacementForDetail.deployment;
    }
    document.title = buildDocumentTitle(currentView, recordLabel);
  }, [
    publicApplyToken,
    authToken,
    currentUser,
    currentView,
    selectedReqForDetail,
    selectedCandForDetail,
    selectedClientForDetail,
    selectedVendorForDetail,
    selectedPlacementForDetail,
  ]);

  // Support browser Back / Forward navigation via popstate
  useEffect(() => {
    if (publicApplyToken) return;
    const handlePopState = () => {
      if (!currentUserRef.current && !authToken) return;
      const parsed = parseAppRoute(window.location.pathname, window.location.search);
      const historyState = window.history.state as BrowserHistoryRouteState | null;
      const returnView = historyState?.returnView;

      if (!parsed.entityId) {
        if (
          [
            'requirement_new',
            'requirement_from_email',
            'consultant_new',
            'import_resume',
            'import_csv',
            'placement_new',
          ].includes(parsed.view)
        ) {
          routeHandlersRef.current.handleOpenWorkflowPage(
            parsed.view as
            | 'requirement_new'
            | 'requirement_from_email'
            | 'consultant_new'
            | 'import_resume'
            | 'import_csv'
            | 'placement_new',
            {
              requirementId: parsed.query?.requirementId,
              candidateId: parsed.query?.candidateId,
              fromView: returnView || parsed.query?.from,
              returnReqId: historyState?.returnReqId || parsed.query?.requirementId,
              skipHistory: true,
            }
          );
          return;
        }
        routeHandlersRef.current.handleNavigateView(parsed.view, { skipHistory: true });
        return;
      }

      const stateSnapshot = routeStateRef.current;
      const entityId = parsed.entityId;

      if (parsed.view === 'requirement_edit') {
        const matched = stateSnapshot.requirements.find((r) => r.id === entityId);
        if (matched) {
          routeHandlersRef.current.handleOpenRequirementEdit(matched, returnView, {
            skipHistory: true,
          });
          return;
        }
        if (returnView) setReqDetailReturnView(returnView);
        setSelectedReqForDetail(null);
      } else if (parsed.view === 'requirement_form_preview') {
        const matched = stateSnapshot.requirements.find((r) => r.id === entityId);
        if (matched) {
          routeHandlersRef.current.handleOpenRequirementFormPreview(
            matched,
            parsed.query?.templateId,
            returnView,
            { skipHistory: true }
          );
          return;
        }
        if (returnView) setReqDetailReturnView(returnView);
        setSelectedReqForDetail(null);
      } else if (parsed.view === 'requirement_detail') {
        const matched = stateSnapshot.requirements.find((r) => r.id === entityId);
        if (matched) {
          routeHandlersRef.current.handleOpenRequirementDetail(matched, returnView, {
            skipHistory: true,
          });
          return;
        }
        if (returnView) setReqDetailReturnView(returnView);
        setSelectedReqForDetail(null);
      } else if (parsed.view === 'consultant_edit') {
        const matched = stateSnapshot.candidates.find((c) => c.id === entityId);
        if (matched) {
          routeHandlersRef.current.handleOpenConsultantEdit(matched, returnView, {
            skipHistory: true,
          });
          return;
        }
        if (returnView && returnView !== 'consultant_detail' && returnView !== 'consultant_edit') {
          setCandDetailReturnView(returnView);
        }
        setSelectedCandForDetail(null);
      } else if (parsed.view === 'consultant_detail') {
        const matched = stateSnapshot.candidates.find((c) => c.id === entityId);
        if (matched) {
          routeHandlersRef.current.handleOpenConsultantDetail(matched, false, returnView, {
            skipHistory: true,
          });
          return;
        }
        if (returnView) setCandDetailReturnView(returnView);
        setSelectedCandForDetail(null);
      } else if (parsed.view === 'client_detail') {
        const matched = stateSnapshot.clients.find((c) => c.id === entityId);
        if (matched) {
          routeHandlersRef.current.handleOpenClientDetail(matched, false, returnView, {
            skipHistory: true,
          });
          return;
        }
        if (returnView) setClientDetailReturnView(returnView);
        setSelectedClientForDetail(null);
      } else if (parsed.view === 'vendor_detail') {
        const matched = stateSnapshot.vendors.find((v) => v.id === entityId);
        if (matched) {
          routeHandlersRef.current.handleOpenVendorDetail(matched, false, returnView, {
            skipHistory: true,
          });
          return;
        }
        if (returnView) setVendorDetailReturnView(returnView);
        setSelectedVendorForDetail(null);
      } else if (parsed.view === 'placement_detail') {
        const matched = stateSnapshot.placements.find((p) => p.id === entityId);
        if (matched) {
          routeHandlersRef.current.handleOpenPlacementDetail(matched, returnView, {
            skipHistory: true,
          });
          return;
        }
        if (returnView) setPlacementDetailReturnView(returnView);
        setSelectedPlacementForDetail(null);
      }

      setResolvingRouteId(entityId);
      setRouteTarget(parsed);
      setCurrentView(parsed.view);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [publicApplyToken, authToken]);

  // Hydrate detail record on direct URL load, Cmd+R refresh, or uncached Back/Forward navigation
  useEffect(() => {
    if (publicApplyToken || (!authToken && !currentUser)) return;
    const targetId = routeTarget.entityId;
    if (!targetId || routeTarget.view === 'application_form_edit') {
      setResolvingRouteId(null);
      return;
    }

    const snapshot = routeStateRef.current;
    if (
      ((routeTarget.view === 'requirement_detail' ||
        routeTarget.view === 'requirement_edit' ||
        routeTarget.view === 'requirement_form_preview') &&
        (snapshot.selectedReqForDetail?.id === targetId ||
          snapshot.requirements.some((r) => r.id === targetId))) ||
      ((routeTarget.view === 'consultant_detail' || routeTarget.view === 'consultant_edit') &&
        (snapshot.selectedCandForDetail?.id === targetId ||
          snapshot.candidates.some((c) => c.id === targetId))) ||
      (routeTarget.view === 'client_detail' &&
        (snapshot.selectedClientForDetail?.id === targetId ||
          snapshot.clients.some((c) => c.id === targetId))) ||
      (routeTarget.view === 'vendor_detail' &&
        (snapshot.selectedVendorForDetail?.id === targetId ||
          snapshot.vendors.some((v) => v.id === targetId))) ||
      (routeTarget.view === 'placement_detail' &&
        (snapshot.selectedPlacementForDetail?.id === targetId ||
          snapshot.placements.some((p) => p.id === targetId)))
    ) {
      if (
        (routeTarget.view === 'requirement_detail' ||
          routeTarget.view === 'requirement_edit' ||
          routeTarget.view === 'requirement_form_preview') &&
        !snapshot.selectedReqForDetail
      ) {
        const cached = snapshot.requirements.find((r) => r.id === targetId);
        if (cached) {
          if (routeTarget.view === 'requirement_edit') {
            routeHandlersRef.current.handleOpenRequirementEdit(cached, undefined, {
              skipHistory: true,
            });
          } else if (routeTarget.view === 'requirement_form_preview') {
            routeHandlersRef.current.handleOpenRequirementFormPreview(
              cached,
              routeTarget.query?.templateId,
              undefined,
              { skipHistory: true }
            );
          } else {
            routeHandlersRef.current.handleOpenRequirementDetail(cached, undefined, {
              skipHistory: true,
            });
          }
          return;
        }
      } else if (
        (routeTarget.view === 'consultant_detail' || routeTarget.view === 'consultant_edit') &&
        !snapshot.selectedCandForDetail
      ) {
        const cached = snapshot.candidates.find((c) => c.id === targetId);
        if (cached) {
          if (routeTarget.view === 'consultant_edit') {
            routeHandlersRef.current.handleOpenConsultantEdit(cached, undefined, {
              skipHistory: true,
            });
          } else {
            routeHandlersRef.current.handleOpenConsultantDetail(cached, false, undefined, {
              skipHistory: true,
            });
          }
          return;
        }
      } else if (routeTarget.view === 'client_detail' && !snapshot.selectedClientForDetail) {
        const cached = snapshot.clients.find((c) => c.id === targetId);
        if (cached) {
          routeHandlersRef.current.handleOpenClientDetail(cached, false, undefined, {
            skipHistory: true,
          });
          return;
        }
      } else if (routeTarget.view === 'vendor_detail' && !snapshot.selectedVendorForDetail) {
        const cached = snapshot.vendors.find((v) => v.id === targetId);
        if (cached) {
          routeHandlersRef.current.handleOpenVendorDetail(cached, false, undefined, {
            skipHistory: true,
          });
          return;
        }
      } else if (routeTarget.view === 'placement_detail' && !snapshot.selectedPlacementForDetail) {
        const cached = snapshot.placements.find((p) => p.id === targetId);
        if (cached) {
          routeHandlersRef.current.handleOpenPlacementDetail(cached, undefined, {
            skipHistory: true,
          });
          return;
        }
      }
      setResolvingRouteId((prev) => (prev === targetId ? null : prev));
      return;
    }

    let cancelled = false;
    setResolvingRouteId(targetId);

    const resolveDetailRoute = async () => {
      try {
        if (
          routeTarget.view === 'requirement_detail' ||
          routeTarget.view === 'requirement_edit' ||
          routeTarget.view === 'requirement_form_preview'
        ) {
          const res = await apiClient.get(`/requirements/${encodeURIComponent(targetId)}`);
          if (!cancelled && res.data?.data) {
            const mapped = mapRequirementFromApi(res.data.data);
            setRequirements((prev) =>
              prev.some((r) => r.id === mapped.id)
                ? prev.map((r) => (r.id === mapped.id ? mapped : r))
                : [mapped, ...prev]
            );
            if (routeTarget.view === 'requirement_edit') {
              routeHandlersRef.current.handleOpenRequirementEdit(mapped, undefined, {
                skipHistory: true,
              });
            } else if (routeTarget.view === 'requirement_form_preview') {
              routeHandlersRef.current.handleOpenRequirementFormPreview(
                mapped,
                routeTarget.query?.templateId,
                undefined,
                { skipHistory: true }
              );
            } else {
              routeHandlersRef.current.handleOpenRequirementDetail(mapped, undefined, {
                skipHistory: true,
              });
            }
          }
        } else if (routeTarget.view === 'consultant_detail' || routeTarget.view === 'consultant_edit') {
          const res = await apiClient.get(`/candidates/${encodeURIComponent(targetId)}`);
          if (!cancelled && res.data?.data) {
            const mapped = mapCandidateFromApi(res.data.data);
            setCandidates((prev) =>
              prev.some((c) => c.id === mapped.id)
                ? prev.map((c) => (c.id === mapped.id ? mapped : c))
                : [mapped, ...prev]
            );
            if (routeTarget.view === 'consultant_edit') {
              routeHandlersRef.current.handleOpenConsultantEdit(mapped, undefined, {
                skipHistory: true,
              });
            } else {
              routeHandlersRef.current.handleOpenConsultantDetail(mapped, false, undefined, {
                skipHistory: true,
              });
            }
          }
        } else if (routeTarget.view === 'client_detail') {
          const loaded = await fetchClients();
          const matched = loaded.find((c) => c.id === targetId);
          if (!cancelled && matched) {
            routeHandlersRef.current.handleOpenClientDetail(matched, false, undefined, {
              skipHistory: true,
            });
          }
        } else if (routeTarget.view === 'vendor_detail') {
          const loaded = await fetchVendors();
          const matched = loaded.find((v) => v.id === targetId);
          if (!cancelled && matched) {
            routeHandlersRef.current.handleOpenVendorDetail(matched, false, undefined, {
              skipHistory: true,
            });
          }
        } else if (routeTarget.view === 'placement_detail') {
          const loaded = await fetchPlacements();
          const matched = loaded.find((p) => p.id === targetId);
          if (!cancelled && matched) {
            routeHandlersRef.current.handleOpenPlacementDetail(matched, undefined, {
              skipHistory: true,
            });
          }
        }
      } catch (e) {
        console.warn('Deep-link route hydration:', e);
      } finally {
        if (!cancelled) {
          setResolvingRouteId((prev) => (prev === targetId ? null : prev));
        }
      }
    };

    resolveDetailRoute();
    return () => {
      cancelled = true;
    };
  }, [routeTarget, authToken, currentUser]);

  // Ensure clients, users, and vendors are available when opening create/edit workflows or Cmd+K
  useEffect(() => {
    if (!authToken && !currentUser) return;
    if (isInlineResumeModalOpen && !loadedEntities.current.has('users')) {
      fetchUsers();
    }
    if (
      currentView === 'requirement_new' ||
      currentView === 'requirement_edit' ||
      currentView === 'consultant_new' ||
      currentView === 'consultant_edit' ||
      showCommandPalette
    ) {
      if (!loadedEntities.current.has('clients')) fetchClients();
      if (!loadedEntities.current.has('users')) fetchUsers();
      if (
        currentView === 'consultant_new' ||
        currentView === 'consultant_edit' ||
        showCommandPalette
      ) {
        if (!loadedEntities.current.has('vendors')) fetchVendors();
      }
      if (showCommandPalette) {
        if (!loadedEntities.current.has('requirements')) fetchRequirements();
        if (!loadedEntities.current.has('candidates')) fetchCandidates();
      }
    }
  }, [currentView, isInlineResumeModalOpen, showCommandPalette, authToken]);

  // Hydrate target requirement/candidate on direct URL load or refresh of /placements/new
  useEffect(() => {
    if (publicApplyToken || (!authToken && !currentUser)) return;
    if (currentView !== 'placement_new') return;

    const targetReqId = routeTarget.query?.requirementId || workflowReturnReqId || undefined;
    const targetCandId = routeTarget.query?.candidateId;
    let cancelled = false;

    const hasHydratedReq = (req?: Requirement | null) =>
      Boolean(req && req.id === targetReqId && Array.isArray(req.submissions));

    const reqFromState = targetReqId
      ? (placementLaunchContext?.requirement?.id === targetReqId
        ? placementLaunchContext.requirement
        : null) ||
      (selectedReqForDetail?.id === targetReqId ? selectedReqForDetail : null) ||
      requirements.find((r) => r.id === targetReqId) ||
      null
      : null;

    if (targetReqId && !hasHydratedReq(reqFromState)) {
      apiClient
        .get(`/requirements/${encodeURIComponent(targetReqId)}`)
        .then((res) => {
          if (cancelled || !res.data?.data) return;
          const mappedReq = mapRequirementFromApi(res.data.data);
          setPlacementLaunchContext((prev) => ({
            requirement: mappedReq,
            candidate: prev?.candidate ?? null,
          }));
          setRequirements((prev) =>
            prev.some((r) => r.id === mappedReq.id)
              ? prev.map((r) => (r.id === mappedReq.id ? mappedReq : r))
              : [mappedReq, ...prev]
          );
        })
        .catch(() => { });
    }

    const candFromSub = targetCandId
      ? (reqFromState?.submissions || []).find(
        (s) =>
          s.candidateId === targetCandId ||
          s.candidate?.id === targetCandId ||
          s.id === targetCandId
      )?.candidate || null
      : null;

    const hasCand = Boolean(
      !targetCandId ||
      placementLaunchContext?.candidate?.id === targetCandId ||
      candidates.some((c) => c.id === targetCandId) ||
      selectedCandForDetail?.id === targetCandId ||
      candFromSub
    );

    if (targetCandId && !hasCand && !targetCandId.startsWith('legacy_')) {
      apiClient
        .get(`/candidates/${encodeURIComponent(targetCandId)}`)
        .then((res) => {
          if (cancelled || !res.data?.data) return;
          const mappedCand = mapCandidateFromApi(res.data.data);
          setPlacementLaunchContext((prev) => ({
            requirement: prev?.requirement ?? reqFromState,
            candidate: mappedCand,
          }));
          setCandidates((prev) =>
            prev.some((c) => c.id === mappedCand.id)
              ? prev.map((c) => (c.id === mappedCand.id ? mappedCand : c))
              : [mappedCand, ...prev]
          );
        })
        .catch(() => { });
    }

    return () => {
      cancelled = true;
    };
  }, [
    currentView,
    routeTarget.query?.requirementId,
    routeTarget.query?.candidateId,
    workflowReturnReqId,
    authToken,
    currentUser,
    publicApplyToken,
  ]);

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
        handleOpenPlacementPage(req, targetCandidate, currentView);
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

  const mergeImportedCandidates = (incoming: Candidate[], markSubmitted = false) => {
    if (!incoming || incoming.length === 0) return;
    const normalized = markSubmitted
      ? incoming.map((c) =>
        c.pipelineStage === 'Available / Bench' ? { ...c, pipelineStage: 'Submitted' } : c
      )
      : incoming;
    setCandidates((prev) => {
      const byId = new Map(normalized.map((c) => [c.id, c]));
      const remaining = prev.filter((c) => !byId.has(c.id));
      return [...normalized, ...remaining];
    });
    fetchSidebarCounts();
  };

  const handleCsvImportCompleted = async ({
    candidates: importedCandidates,
    updatedRequirement,
  }: {
    candidates: Candidate[];
    updatedRequirement: Requirement | null;
  }) => {
    mergeImportedCandidates(importedCandidates, Boolean(updatedRequirement));
    if (updatedRequirement) {
      syncUpdatedRequirement(updatedRequirement);
      await Promise.all([fetchSidebarCounts(), fetchSlaTasks(), fetchAutomations()]);
    } else {
      fetchCandidates();
    }
  };

  const handleResumeCandidateApproved = async (
    savedCand: Candidate,
    opts?: {
      targetRequirement?: Requirement | null;
      stayOnPage?: boolean;
      skipAttach?: boolean;
    }
  ): Promise<Requirement | null> => {
    setCandidates((prev) => [savedCand, ...prev.filter((c) => c.id !== savedCand.id)]);
    fetchSidebarCounts();
    let updatedTargetReq: Requirement | null = opts?.targetRequirement || null;
    if (opts?.targetRequirement && !opts?.skipAttach) {
      try {
        const res = await apiClient.post('/submissions', {
          requirementId: opts.targetRequirement.id,
          candidateIds: [savedCand.id],
        });
        if (res.data?.requirement) {
          updatedTargetReq = mapRequirementFromApi(res.data.requirement);
          syncUpdatedRequirement(updatedTargetReq);
        } else {
          fetchRequirements();
        }
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === savedCand.id && c.pipelineStage === 'Available / Bench'
              ? { ...c, pipelineStage: 'Submitted' }
              : c
          )
        );
        fetchSidebarCounts();
        fetchSlaTasks();
        fetchAutomations();
      } catch {
        // Non-fatal if candidate was already attached
      }
    }
    return updatedTargetReq;
  };

  const navigateToSpecificReqPage = (
    reqOrId: Requirement | string,
    fromViewOverride?: string
  ) => {
    const reqObj =
      typeof reqOrId === 'string'
        ? requirements.find((r) => r.id === reqOrId) ||
        (selectedReqForDetail?.id === reqOrId ? selectedReqForDetail : null) ||
        (inlineImportTargetReq?.id === reqOrId ? inlineImportTargetReq : null)
        : reqOrId;
    const reqId = typeof reqOrId === 'string' ? reqOrId : reqOrId.id;

    setIsInlineResumeModalOpen(false);
    setIsInlineCsvModalOpen(false);
    setInlineImportTargetReq(null);
    setIsMatcherModalOpen(false);
    setBenchPickerCloseToken((k) => k + 1);

    if (currentView === 'requirement_detail' && selectedReqForDetail?.id === reqId) {
      return;
    }

    const backOrigin =
      fromViewOverride &&
        ![
          'requirement_detail',
          'requirement_from_email',
          'import_resume',
          'import_csv',
          'placement_new',
        ].includes(fromViewOverride)
        ? fromViewOverride
        : reqDetailReturnView || 'pipeline';

    if (reqObj) {
      handleOpenRequirementDetail(reqObj, backOrigin);
    } else if (reqId) {
      setReqDetailReturnView(backOrigin);
      setSelectedReqForDetail(null);
      setResolvingRouteId(reqId);
      setRouteTarget({ view: 'requirement_detail', entityId: reqId });
      setCurrentView('requirement_detail');
      pushRouteUrl('requirement_detail', { entityId: reqId, returnView: backOrigin });
    }
  };

  const handleOpenInlineResumePopup = (req?: Requirement | null) => {
    setInlineImportTargetReq(req || null);
    setIsInlineCsvModalOpen(false);
    setIsInlineResumeModalOpen(true);
  };

  const handleOpenInlineCsvPopup = (req?: Requirement | null) => {
    setInlineImportTargetReq(req || null);
    setIsInlineResumeModalOpen(false);
    setIsInlineCsvModalOpen(true);
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
        'success'
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Could not attach applicant(s) to requirement.';
      showToast('Attachment Notice', msg, 'warning');
      throw e;
    }
  };

  const handleAssignCandidate = async (req: Requirement, candidate: Candidate) => {
    await handleAttachCandidates(req, [candidate.id]);
  };

  const bulkResumeQueue = useBulkResumeQueue({
    onCandidateSaved: async (savedCand, targetReq) => {
      await handleResumeCandidateApproved(savedCand, {
        targetRequirement: targetReq,
        stayOnPage: true,
        skipAttach: true,
      });
    },
    onBulkAttachToRequirement: handleAttachCandidates,
    showToast,
  });

  resetBulkResumeRef.current = () => {
    bulkResumeQueue.stopBatch();
    bulkResumeQueue.clearQueue();
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
        'success-brand'
      );
    } catch (e: any) {
      showToast(
        'Update Failed',
        e?.response?.data?.message || 'Could not update applicant stage.',
        'error'
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
        'success-brand'
      );
    } catch (e: any) {
      showToast(
        'Save Failed',
        e?.response?.data?.message || 'Could not save applicant notes.',
        'error'
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
        'delete'
      );
    } catch (e: any) {
      showToast(
        'Detach Failed',
        e?.response?.data?.message || 'Could not remove applicant from requirement.',
        'error'
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
      showToast('Placement Blocked', msg, 'warning');
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
      'invoice'
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
        vendorId: updated.vendorId ?? '',
        vendorName: updated.vendorName ?? '',
        customFields: updated.customFields,
      };
      const requestBody = cvFile
        ? buildCandidateFormData(payload, cvFile)
        : updated;
      const res = await apiClient.put(`/candidates/${updated.id}`, requestBody);
      const saved: Candidate = res.data?.data ? mapCandidateFromApi(res.data.data) : updated;
      setCandidates((prev) => prev.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)));
      setSelectedCandForDetail((prev) => (prev && prev.id === saved.id ? { ...prev, ...saved } : prev));
      showToast(
        cvFile ? 'CV & Consultant Updated' : 'Consultant Updated',
        cvFile ? `${saved.fullName} profile and CV file saved.` : `${saved.fullName} details saved.`,
        'success'
      );
      return saved;
    } catch (e: any) {
      console.warn('API update candidate failed:', e);
      showToast(
        'Update Failed',
        e?.response?.data?.message || e?.response?.data?.error || `Could not update ${updated.fullName}.`,
        'error'
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
      showToast('Requirement Updated', `${saved.opportunityTitle} saved.`, 'success');
      return saved;
    } catch (e: any) {
      console.warn('API update requirement failed:', e);
      showToast('Update Failed', e?.response?.data?.message || e?.response?.data?.error || `Could not update ${updated.opportunityTitle}.`, 'error');
      throw e;
    }
  };

  const handleUpdateVendor = async (updated: Vendor) => {
    try {
      const res = await apiClient.put(`/vendors/${updated.id}`, updated);
      const saved: Vendor = res.data?.data ? mapVendorFromApi(res.data.data) : updated;
      setVendors((prev) => prev.map((v) => (v.id === saved.id ? { ...v, ...saved } : v)));
      setSelectedVendorForDetail((prev) => (prev && prev.id === saved.id ? { ...prev, ...saved } : prev));
      fetchSlaTasks();
      fetchAutomations();
      showToast('Vendor Updated', `${saved.name} details saved.`, 'success');
    } catch (e: any) {
      console.warn('API update vendor failed:', e);
      showToast('Update Failed', e?.response?.data?.error || `Could not update ${updated.name}.`, 'error');
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
      const billNum = parseRateNumber(updated.billing, 0);
      const payNum = parseRateNumber(updated.payRate, 0);
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
          'success'
        );
      } else {
        showToast('Placement Updated', `${saved.resourceName} placement saved.`, 'success');
      }
    } catch (e: any) {
      console.warn('API update placement failed:', e);
      showApiErrorToast(e, 'Update Failed', `Could not update ${updated.resourceName}.`);
      throw e;
    }
  };

  const handleUpdateUser = async (updated: User) => {
    try {
      const res = await apiClient.put(`/users/${updated.id}`, updated);
      const saved: User = res.data?.data
        ? mapUserFromApi(res.data.data, currentUser?.email)
        : updated;
      setUsers((prev) => prev.map((u) => (u.id === saved.id ? { ...u, ...saved } : u)));
      showToast('Member Updated', `${saved.name} profile saved.`, 'success');
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
      showToast('Consultant Removed', `${candidate.fullName} removed from roster.`, 'delete');
    } catch (e: any) {
      console.warn('API delete candidate:', e);
      showToast(
        'Delete Failed',
        e?.response?.data?.message || `Could not delete ${candidate.fullName}.`,
        'error'
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
      showToast('Requisition Removed', `${req.code} (${req.opportunityTitle}) deleted.`, 'delete');
    } catch (e: any) {
      console.warn('API delete requirement:', e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        `Could not delete ${req.code}.`;
      showToast('Delete Blocked', msg, 'error');
      throw e;
    }
  };

  const handleDeleteClient = async (client: Client) => {
    try {
      await apiClient.delete(`/clients/${client.id}`);
      setClients((prev) => prev.filter((cl) => cl.id !== client.id));
      fetchSidebarCounts();
      showToast('Client Removed', `${client.name} deleted.`, 'delete');
    } catch (e: any) {
      console.warn('API delete client:', e);
      showApiErrorToast(e, 'Delete Failed', `Could not delete ${client.name}.`);
      throw e;
    }
  };

  const handleDeleteVendor = async (vendor: Vendor) => {
    try {
      await apiClient.delete(`/vendors/${vendor.id}`);
      setVendors((prev) => prev.filter((v) => v.id !== vendor.id));
      fetchSidebarCounts();
      fetchSlaTasks();
      showToast('Vendor Removed', `${vendor.name} deleted.`, 'delete');
    } catch (e: any) {
      console.warn('API delete vendor:', e);
      showApiErrorToast(e, 'Delete Failed', `Could not delete ${vendor.name}.`);
      throw e;
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
      showToast('Placement Removed', `${placement.resourceName}'s placement removed.`, 'delete');
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
          const billNum = parseRateNumber(billing, 0);
          const payNum = parseRateNumber(payRate, 0);
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
        'success'
      );
    } catch (e: any) {
      console.warn('API placement extension failed:', e);
      showApiErrorToast(e, 'Extension Failed', `Could not extend SOW for ${placement.resourceName}.`);
      throw e;
    }
  };

  const handleTaskAction = async (task: SlaTask) => {
    const action = String(task.actionType || '').toLowerCase();
    const matchedReq =
      task.relatedEntityId
        ? requirements.find((r) => r.id === task.relatedEntityId)
        : undefined;

    setIsSlaOpen(false);

    if (action === 'matcher') {
      setActiveReq(matchedReq || requirements[0] || null);
      setIsMatcherModalOpen(true);
    } else if (action === 'billable') {
      handleNavigateView('billable');
    } else if (action === 'checklist' || task.relatedEntityType === 'vendor') {
      let vendorList = vendors;
      if (vendorList.length === 0 || !loadedEntities.current.has('vendors')) {
        const loaded = await fetchVendors();
        if (loaded.length > 0) vendorList = loaded;
      }
      const titleVendorPrefix = String(task.title || '').split(':')[0].trim().toLowerCase();
      const matchedVendor =
        (task.relatedEntityId
          ? vendorList.find((v) => v.id === task.relatedEntityId)
          : undefined) ||
        (titleVendorPrefix
          ? vendorList.find((v) => v.name.trim().toLowerCase() === titleVendorPrefix)
          : undefined);

      if (matchedVendor) {
        handleOpenVendorDetail(matchedVendor, false, currentView, {
          initialTab: 'terms',
          auditTask: task,
        });
      } else {
        handleNavigateView('vendors');
      }
    } else {
      if (matchedReq) {
        handleOpenRequirementDetail(matchedReq, currentView);
      } else {
        handleNavigateView('pipeline');
      }
    }
  };

  const handleSignOut = () => {
    apiClient.post('/auth/logout').catch(() => { });
    clearAuthSession();
    resetWorkspaceState();
    setCurrentUser(null);
    setAuthToken(null);
    setShowSignOutModal(false);
    showToast(
      'Signed Out',
      `You have been signed out of ${getWorkspaceBrand().agencyName || 'your workspace'}.`,
      'logout'
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
      'refresh'
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

  // Public Requirement CV Intake Route (no authentication required)
  if (publicApplyToken) {
    return (
      <React.Suspense
        fallback={
          <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">
            Loading application form...
          </div>
        }
      >
        <PublicRequirementApplyView token={publicApplyToken} />
      </React.Suspense>
    );
  }

  // If unauthenticated, render the full-screen Mineral Carbon Login View
  if (!currentUser) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-[#141615]">
        {/* Global Toast Banner */}
        <AnimatePresence>
          {toast && (
            <AnimatedToast
              key="login-toast"
              style={{ zIndex: 9999 }}
              className="fixed bottom-5 right-5 z-[9999] max-w-md bg-white border border-slate-200 shadow-2xl rounded-xl p-4 flex items-center gap-3"
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
            </AnimatedToast>
          )}
        </AnimatePresence>

        <LoginView
          onLoginSuccess={(user, token) => {
            resetWorkspaceState();
            lastSessionSyncAtRef.current = Date.now();
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

  const isResolvingCurrentDetail =
    Boolean(resolvingRouteId) &&
    routeTarget.view === currentView &&
    (((currentView === 'requirement_detail' ||
      currentView === 'requirement_edit' ||
      currentView === 'requirement_form_preview') &&
      !requirements.some((r) => r.id === resolvingRouteId) &&
      selectedReqForDetail?.id !== resolvingRouteId) ||
      ((currentView === 'consultant_detail' || currentView === 'consultant_edit') &&
        !candidates.some((c) => c.id === resolvingRouteId) &&
        selectedCandForDetail?.id !== resolvingRouteId) ||
      (currentView === 'client_detail' &&
        !clients.some((c) => c.id === resolvingRouteId) &&
        selectedClientForDetail?.id !== resolvingRouteId) ||
      (currentView === 'vendor_detail' &&
        !vendors.some((v) => v.id === resolvingRouteId) &&
        selectedVendorForDetail?.id !== resolvingRouteId) ||
      (currentView === 'placement_detail' &&
        !placements.some((p) => p.id === resolvingRouteId) &&
        selectedPlacementForDetail?.id !== resolvingRouteId));

  return (
    <div className="h-screen w-full flex overflow-hidden text-slate-800 bg-[#FAFAFA]">
      {/* Toast Banner */}
      <AnimatePresence>
        {toast && (
          <AnimatedToast
            key="app-toast"
            style={{ zIndex: 9999 }}
            className="fixed bottom-5 right-5 z-[9999] max-w-md bg-white border border-slate-200 card-shadow rounded-xl p-4 flex items-center gap-3"
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
          </AnimatedToast>
        )}
      </AnimatePresence>

      {/* Sticky Background Bulk Resume Tracker */}
      {(() => {
        const bulkTotal = bulkResumeQueue.items.length;
        const showStickyBulk =
          (bulkResumeQueue.isRunning || (bulkTotal > 0 && !bulkResumeQueue.dismissedBanner)) &&
          !isInlineResumeModalOpen &&
          currentView !== 'import_resume';
        if (!showStickyBulk) return null;

        const bulkAdded = bulkResumeQueue.items.filter((i) => i.status === 'added').length;
        const bulkDups = bulkResumeQueue.items.filter((i) => i.status === 'duplicate').length;
        const bulkFailed = bulkResumeQueue.items.filter((i) => i.status === 'failed').length;
        const bulkProcessed = bulkAdded + bulkDups + bulkFailed;
        const pct = bulkTotal > 0 ? Math.round((bulkProcessed / bulkTotal) * 100) : 0;
        const batchReq = bulkResumeQueue.targetRequirement;

        return (
          <div
            className={`fixed bottom-5 left-1/2 -translate-x-1/2 ${sidebarCollapsed ? 'md:left-[calc(50%+36px)]' : 'md:left-[calc(50%+128px)]'
              } z-[65] w-[560px] max-w-[calc(100vw-2rem)] bg-[#141615] text-white border border-white/15 rounded-xl shadow-2xl px-4 py-3 space-y-2.5 transition-all`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {bulkResumeQueue.isRunning ? (
                  <Loader2 className="w-4 h-4 text-brand-400 animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                    <span>
                      {bulkResumeQueue.isRunning ? 'Parsing Resumes' : 'Bulk Upload Complete'}
                    </span>PipeAI
                    <AiBadge label="SquadPipe AI" size="xs" variant="dark" />
                    {batchReq && (
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono text-emerald-300">
                        {batchReq.code}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 tabular-nums">
                    {bulkProcessed}/{bulkTotal} processed · {bulkAdded} added
                    {bulkDups > 0 ? ` · ${bulkDups} dup` : ''}
                    {bulkFailed > 0 ? ` · ${bulkFailed} failed` : ''}
                  </div>
                </div>
              </div>
              {!bulkResumeQueue.isRunning && (
                <button
                  type="button"
                  onClick={bulkResumeQueue.dismissBanner}
                  aria-label="Dismiss bulk upload tracker"
                  className="text-slate-400 hover:text-white p-1 rounded cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${bulkResumeQueue.isRunning ? 'bg-brand-500' : 'bg-emerald-500'
                  }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => handleOpenInlineResumePopup(batchReq)}
                className="text-slate-200 hover:text-white font-semibold underline cursor-pointer"
              >
                View Queue
              </button>
              <div className="flex items-center gap-1.5">
                {bulkResumeQueue.isRunning ? (
                  <button
                    type="button"
                    onClick={bulkResumeQueue.stopBatch}
                    className="px-2.5 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 font-semibold cursor-pointer"
                  >
                    Stop
                  </button>
                ) : batchReq && bulkAdded > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      bulkResumeQueue.dismissBanner();
                      navigateToSpecificReqPage(batchReq, currentView);
                    }}
                    className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    Open {batchReq.code}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Obsidian Dark Sidebar with live counts & profile popover */}
      <Sidebar
        currentView={
          currentView === 'requirement_new' ||
            currentView === 'requirement_edit' ||
            currentView === 'requirement_form_preview' ||
            currentView === 'requirement_from_email'
            ? 'pipeline'
            : currentView === 'consultant_new' || currentView === 'consultant_edit'
              ? 'consultants'
              : currentView === 'requirement_detail'
                ? reqDetailReturnView === 'dashboard'
                  ? 'dashboard'
                  : reqDetailReturnView === 'client_detail'
                    ? 'clients'
                    : reqDetailReturnView === 'consultant_detail'
                      ? 'consultants'
                      : 'pipeline'
                : currentView === 'consultant_detail'
                  ? candDetailReturnView === 'dashboard'
                    ? 'dashboard'
                    : candDetailReturnView === 'requirement_detail'
                      ? 'pipeline'
                      : candDetailReturnView === 'vendor_detail'
                        ? 'vendors'
                        : candDetailReturnView === 'placement_detail'
                          ? 'billable'
                          : 'consultants'
                  : currentView === 'client_detail'
                    ? 'clients'
                    : currentView === 'vendor_detail'
                      ? vendorDetailReturnView === 'consultant_detail'
                        ? 'consultants'
                        : vendorDetailReturnView === 'placement_detail'
                          ? 'billable'
                          : 'vendors'
                      : currentView === 'placement_detail'
                        ? placementDetailReturnView === 'client_detail'
                          ? 'clients'
                          : placementDetailReturnView === 'vendor_detail'
                            ? 'vendors'
                            : placementDetailReturnView === 'consultant_detail'
                              ? 'consultants'
                              : placementDetailReturnView === 'requirement_detail'
                                ? 'pipeline'
                                : placementDetailReturnView === 'dashboard'
                                  ? 'dashboard'
                                  : 'billable'
                        : currentView
        }
        onNavigate={handleNavigateView}
        counts={computedSidebarCounts}
        currentUser={currentUser}
        isAdmin={isAdmin}
        canImportData={canManageDataOperations}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenSignOut={() => setShowSignOutModal(true)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Topbar with clean design matching prototype + Global Cmd+K Command Palette trigger */}
        <Topbar
          currentView={currentView}
          canCreatePlacement={!rateMasked}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onOpenCreateModal={(type) => {
            if (type === 'requirement') {
              handleOpenWorkflowPage('requirement_new', { fromView: currentView });
              return;
            }
            if (type === 'consultant') {
              handleOpenWorkflowPage('consultant_new', { fromView: currentView });
              return;
            }
            if (type === 'placement') {
              if (!rateMasked) {
                handleOpenWorkflowPage('placement_new', { fromView: currentView });
              }
              return;
            }
            setActiveCreateModal(type);
          }}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
        />

        {/* Dynamic View Body */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <React.Suspense
            fallback={
              <PageSkeleton
                variant={
                  [
                    'requirement_detail',
                    'consultant_detail',
                    'client_detail',
                    'vendor_detail',
                    'placement_detail',
                  ].includes(currentView)
                    ? 'detail'
                    : 'workspace'
                }
              />
            }
          >
            {isResolvingCurrentDetail && <PageSkeleton variant="detail" />}

            {currentView === 'dashboard' && (
              <DashboardView
                requirements={requirements}
                candidates={candidates}
                placements={placements}
                slaTasks={slaTasks}
                rateMasked={rateMasked}
                onNavigate={handleNavigateView}
                onOpenCreateReq={() =>
                  handleOpenWorkflowPage('requirement_new', { fromView: 'dashboard' })
                }
                onSelectReq={(r) => handleOpenRequirementDetail(r, 'dashboard')}
                onEditReq={(r) => handleOpenRequirementEdit(r, 'dashboard')}
                onUpdateReq={handleUpdateRequirement}
                onDeleteReq={canManageDataOperations ? handleDeleteRequirement : undefined}
                onPreviewResumeByName={(candName) => {
                  const c = candidates.find((cand) => cand.fullName === candName);
                  if (c) handleOpenConsultantDetail(c, false, 'dashboard');
                }}
                onStatusChange={handleStatusChange}
                onOpenMatcher={(req) => {
                  setActiveReq(req);
                  setIsMatcherModalOpen(true);
                }}
                onOpenSlaDrawer={() => setIsSlaOpen(true)}
                onTaskAction={handleTaskAction}
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
                onOpenEmailParser={() =>
                  handleOpenWorkflowPage('requirement_from_email', { fromView: 'pipeline' })
                }
                onOpenMatcher={(req) => {
                  setActiveReq(req);
                  setIsMatcherModalOpen(true);
                }}
                onOpenPlacementWizard={(req) =>
                  handleOpenPlacementPage(req, null, 'pipeline')
                }
                onSelectReq={(r) => handleOpenRequirementDetail(r, 'pipeline')}
                onOpenAddReq={() =>
                  handleOpenWorkflowPage('requirement_new', { fromView: 'pipeline' })
                }
                onEditReq={(r) => handleOpenRequirementEdit(r, 'pipeline')}
                onUpdateReq={handleUpdateRequirement}
                onDeleteReq={canManageDataOperations ? handleDeleteRequirement : undefined}
              />
            )}

            {currentView === 'requirement_new' && (
              <RequirementFormPage
                mode="create"
                clients={clients}
                users={users}
                backLabel={
                  workflowReturnView === 'dashboard' ? 'Back to Dashboard' : 'Back to Pipeline'
                }
                onBack={() => handleReturnFromWorkflowPage('pipeline')}
                onOpenFromEmail={() =>
                  handleOpenWorkflowPage('requirement_from_email', {
                    fromView: workflowReturnView,
                    replaceHistory: true,
                  })
                }
                onSaveCreate={async (r) => {
                  const res = await apiClient.post('/requirements', r);
                  const saved = res.data?.data ? mapRequirementFromApi(res.data.data) : r;
                  fetchClients();
                  fetchSidebarCounts();
                  fetchSlaTasks();
                  fetchAutomations();
                  setRequirements((prev) => [saved, ...prev]);
                  handleOpenRequirementDetail(saved, 'pipeline');
                  return saved;
                }}
                showToast={showToast}
              />
            )}

            {currentView === 'requirement_edit' && !isResolvingCurrentDetail && (() => {
              const editingReq =
                requirements.find((r) => r.id === (selectedReqForDetail?.id || routeTarget.entityId)) ||
                selectedReqForDetail;
              return (
                <RequirementFormPage
                  mode="edit"
                  initialRequirement={editingReq}
                  clients={clients}
                  users={users}
                  backLabel={
                    workflowReturnView === 'pipeline'
                      ? 'Back to Pipeline'
                      : workflowReturnView === 'dashboard'
                        ? 'Back to Dashboard'
                        : editingReq?.code
                          ? `Back to ${editingReq.code}`
                          : 'Back to Requirement'
                  }
                  onBack={() => {
                    if (
                      !editingReq ||
                      workflowReturnView === 'pipeline' ||
                      workflowReturnView === 'dashboard'
                    ) {
                      handleNavigateView(workflowReturnView === 'dashboard' ? 'dashboard' : 'pipeline');
                      return;
                    }
                    handleReturnFromWorkflowPage('requirement_detail');
                  }}
                  onSaveEdit={async (updated) => {
                    const saved = await handleUpdateRequirement(updated);
                    handleOpenRequirementDetail(saved || updated, reqDetailReturnView || 'pipeline');
                  }}
                  showToast={showToast}
                />
              );
            })()}

            {currentView === 'requirement_from_email' && (
              <RequirementFromEmailPage
                clients={clients}
                users={users}
                backLabel={
                  workflowReturnView === 'dashboard' ? 'Back to Dashboard' : 'Back to Pipeline'
                }
                onBack={() => handleReturnFromWorkflowPage('pipeline')}
                onApprove={(req) => {
                  setRequirements((prev) => [req, ...prev]);
                  fetchClients();
                  fetchSidebarCounts();
                  fetchSlaTasks();
                  fetchAutomations();
                  handleOpenRequirementDetail(req, 'pipeline');
                }}
                showToast={showToast}
              />
            )}

            {currentView === 'requirement_detail' && !isResolvingCurrentDetail && (
              <RequirementDetailPage
                requirement={
                  requirements.find((r) => r.id === selectedReqForDetail?.id) ||
                  selectedReqForDetail
                }
                backLabel={
                  reqDetailReturnView === 'dashboard'
                    ? 'Back to Dashboard'
                    : reqDetailReturnView === 'client_detail'
                      ? 'Back to Client'
                      : reqDetailReturnView === 'consultant_detail'
                        ? 'Back to Consultant'
                        : reqDetailReturnView === 'placement_detail'
                          ? 'Back to Placement'
                          : 'Back to Pipeline'
                }
                onBack={() => handleNavigateView(reqDetailReturnView)}
                candidates={candidates}
                placements={placements}
                rateMasked={rateMasked}
                onAssignCandidate={handleAssignCandidate}
                onAttachCandidates={handleAttachCandidates}
                onUpdateSubmissionStage={handleUpdateSubmissionStage}
                onUpdateSubmissionNotes={handleUpdateSubmissionNotes}
                onDetachSubmission={handleDetachSubmission}
                onOpenResumePreview={(cand) =>
                  handleOpenConsultantDetail(cand, false, 'requirement_detail')
                }
                onSelectPlacement={(p) => handleOpenPlacementDetail(p, 'requirement_detail')}
                onOpenPlacementWizard={(req, cand) =>
                  handleOpenPlacementPage(req, cand || null, 'requirement_detail')
                }
                onEditReq={(req) => handleOpenRequirementEdit(req, 'requirement_detail')}
                onUpdateReq={handleUpdateRequirement}
                onRequirementUpdated={syncUpdatedRequirement}
                onOpenCsvImport={
                  canManageDataOperations
                    ? (req) => handleOpenInlineCsvPopup(req)
                    : undefined
                }
                onOpenResumeParser={
                  canManageDataOperations
                    ? (req) => handleOpenInlineResumePopup(req)
                    : undefined
                }
                onPreviewApplicationForm={(req, templateId) =>
                  handleOpenRequirementFormPreview(req, templateId, reqDetailReturnView)
                }
                benchPickerCloseToken={benchPickerCloseToken}
              />
            )}

            {currentView === 'requirement_form_preview' && (
              <RequirementFormPreviewPage
                requirement={
                  requirements.find((r) => r.id === (selectedReqForDetail?.id || routeTarget.entityId)) ||
                  selectedReqForDetail
                }
                initialTemplateId={routeTarget.query?.templateId}
                isLoading={isResolvingCurrentDetail}
                isAdmin={isAdmin}
                agencyName={currentUser?.agencyName}
                onBack={() => {
                  const targetReq =
                    requirements.find((r) => r.id === (selectedReqForDetail?.id || routeTarget.entityId)) ||
                    selectedReqForDetail;
                  if (targetReq) {
                    handleOpenRequirementDetail(targetReq, reqDetailReturnView || 'pipeline');
                    return;
                  }
                  handleNavigateView('pipeline');
                }}
                onEditTemplate={
                  isAdmin
                    ? (formId) => handleOpenApplicationFormPage({ mode: 'edit', formId })
                    : undefined
                }
                showToast={showToast}
              />
            )}

            {currentView === 'consultants' && (
              <ConsultantsView
                candidates={candidates}
                placements={placements}
                vendors={vendors}
                rateMasked={rateMasked}
                onOpenResumeParser={() =>
                  handleOpenWorkflowPage('import_resume', { fromView: 'consultants' })
                }
                onPreviewResume={(c, startEditing) =>
                  handleOpenConsultantDetail(c, Boolean(startEditing), 'consultants')
                }
                onOpenAddConsultant={() =>
                  handleOpenWorkflowPage('consultant_new', { fromView: 'consultants' })
                }
                onOpenCsvImport={
                  canManageDataOperations
                    ? () => handleOpenWorkflowPage('import_csv', { fromView: 'consultants' })
                    : undefined
                }
                onNavigateToBillable={() => handleNavigateView('billable')}
                canEditCandidate={canManageDataOperations}
                onEditCandidate={
                  canManageDataOperations
                    ? (cand) => handleOpenConsultantEdit(cand, 'consultants')
                    : undefined
                }
                onUpdateCandidate={canManageDataOperations ? handleUpdateCandidate : undefined}
                onDeleteCandidate={canManageDataOperations ? handleDeleteCandidate : undefined}
              />
            )}

            {currentView === 'consultant_new' && (
              <ConsultantCreatePage
                users={users}
                vendors={vendors}
                backLabel={
                  workflowReturnView === 'dashboard' ? 'Back to Dashboard' : 'Back to Consultants'
                }
                onBack={() => handleReturnFromWorkflowPage('consultants')}
                onOpenResumeParser={() =>
                  handleOpenWorkflowPage('import_resume', {
                    fromView: 'consultant_new',
                  })
                }
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
                    vendorId: c.vendorId || undefined,
                    vendorName: c.vendorName || undefined,
                    resumeFileName: cvFile ? cvFile.name : c.resumeName,
                    resumeFormat: cvFile ? undefined : c.resumeFormat,
                    customFields: c.customFields,
                  };
                  const requestBody = cvFile ? buildCandidateFormData(payload, cvFile) : payload;
                  const res = await apiClient.post('/candidates', requestBody);
                  const saved = res.data?.data ? mapCandidateFromApi(res.data.data) : c;
                  fetchSidebarCounts();
                  setCandidates((prev) => [saved, ...prev]);
                  handleOpenConsultantDetail(saved, false, 'consultants');
                  return saved;
                }}
                showToast={showToast}
              />
            )}

            {currentView === 'consultant_edit' && !isResolvingCurrentDetail && (() => {
              const editingCand =
                candidates.find((c) => c.id === (selectedCandForDetail?.id || routeTarget.entityId)) ||
                selectedCandForDetail;
              return (
                <ConsultantCreatePage
                  mode="edit"
                  initialCandidate={editingCand}
                  users={users}
                  vendors={vendors}
                  rateMasked={rateMasked}
                  backLabel={
                    workflowReturnView === 'consultants'
                      ? 'Back to Consultants'
                      : editingCand?.fullName
                        ? `Back to ${editingCand.fullName}`
                        : 'Back to Profile'
                  }
                  onBack={() => {
                    if (workflowReturnView === 'consultants' || !editingCand) {
                      handleNavigateView('consultants');
                      return;
                    }
                    handleOpenConsultantDetail(
                      editingCand,
                      false,
                      candDetailReturnView || 'consultants'
                    );
                  }}
                  onSaveEdit={async (updated, cvFile) => {
                    const saved = await handleUpdateCandidate(updated, cvFile);
                    const nextCand = saved || updated;
                    handleOpenConsultantDetail(
                      nextCand,
                      false,
                      candDetailReturnView || 'consultants'
                    );
                  }}
                  showToast={showToast}
                />
              );
            })()}

            {currentView === 'consultant_detail' && !isResolvingCurrentDetail && (
              <ConsultantDetailPage
                candidate={
                  candidates.find((c) => c.id === selectedCandForDetail?.id) ||
                  selectedCandForDetail
                }
                backLabel={
                  candDetailReturnView === 'dashboard'
                    ? 'Back to Dashboard'
                    : candDetailReturnView === 'requirement_detail'
                      ? 'Back to Requirement'
                      : candDetailReturnView === 'vendor_detail'
                        ? 'Back to Vendor'
                        : candDetailReturnView === 'placement_detail'
                          ? 'Back to Placement'
                          : 'Back to Consultants'
                }
                onBack={() => handleNavigateView(candDetailReturnView)}
                requirements={requirements}
                placements={placements}
                vendors={vendors}
                rateMasked={rateMasked}
                initialEditing={candDetailInitialEdit}
                onSubmitToReq={(cand, req) => handleAssignCandidate(req, cand)}
                onOpenRequirement={(req) => handleOpenRequirementDetail(req, 'consultant_detail')}
                onSelectPlacement={(p) => handleOpenPlacementDetail(p, 'consultant_detail')}
                onOpenVendor={(v) => handleOpenVendorDetail(v, false, 'consultant_detail')}
                onEditCandidate={
                  canManageDataOperations
                    ? (cand) => handleOpenConsultantEdit(cand, 'consultant_detail')
                    : undefined
                }
                onUpdateCandidate={canManageDataOperations ? handleUpdateCandidate : undefined}
                onDeleteCandidate={canManageDataOperations ? handleDeleteCandidate : undefined}
                onNavigateToBillable={() => handleNavigateView('billable')}
                showToast={showToast}
              />
            )}

            {currentView === 'clients' && (
              <ClientsView
                clients={clients}
                requirements={requirements}
                placements={placements}
                onOpenAddClient={() => setActiveCreateModal('client')}
                onSelectClient={(client, startEditing) =>
                  handleOpenClientDetail(client, Boolean(startEditing), 'clients')
                }
                onClientUpdated={(updatedClient) => {
                  setClients((prev) =>
                    prev.map((c) => (c.id === updatedClient.id ? updatedClient : c))
                  );
                  setSelectedClientForDetail((prev) =>
                    prev && prev.id === updatedClient.id ? updatedClient : prev
                  );
                }}
                onDeleteClient={isAdmin ? handleDeleteClient : undefined}
                showToast={showToast}
              />
            )}

            {currentView === 'client_detail' && !isResolvingCurrentDetail && (
              <ClientDetailPage
                client={
                  clients.find((c) => c.id === selectedClientForDetail?.id) ||
                  selectedClientForDetail
                }
                backLabel={
                  clientDetailReturnView === 'placement_detail'
                    ? 'Back to Placement'
                    : 'Back to Clients'
                }
                onBack={() => handleNavigateView(clientDetailReturnView)}
                requirements={requirements}
                placements={placements}
                rateMasked={rateMasked}
                initialEditing={clientDetailInitialEdit}
                onClientUpdated={(updatedClient) => {
                  setClients((prev) =>
                    prev.map((c) => (c.id === updatedClient.id ? updatedClient : c))
                  );
                  setSelectedClientForDetail((prev) =>
                    prev && prev.id === updatedClient.id ? updatedClient : prev
                  );
                }}
                onOpenRequirement={(req) => handleOpenRequirementDetail(req, 'client_detail')}
                onSelectPlacement={(p) => handleOpenPlacementDetail(p, 'client_detail')}
                onDeleteClient={isAdmin ? handleDeleteClient : undefined}
                showToast={showToast}
              />
            )}

            {currentView === 'vendors' && (
              <VendorsView
                vendors={vendors}
                onOpenAddVendor={() => setActiveCreateModal('vendor')}
                onSelectVendor={(vendor, startEditing) =>
                  handleOpenVendorDetail(vendor, Boolean(startEditing), 'vendors')
                }
                canEditVendor={canManageDataOperations}
                onUpdateVendor={canManageDataOperations ? handleUpdateVendor : undefined}
                onDeleteVendor={isAdmin ? handleDeleteVendor : undefined}
              />
            )}

            {currentView === 'vendor_detail' && !isResolvingCurrentDetail && (
              <VendorDetailPage
                vendor={
                  vendors.find((v) => v.id === selectedVendorForDetail?.id) ||
                  selectedVendorForDetail
                }
                backLabel={
                  vendorDetailReturnView === 'dashboard'
                    ? 'Back to Dashboard'
                    : vendorDetailReturnView === 'placement_detail'
                      ? 'Back to Placement'
                      : vendorDetailReturnView === 'consultant_detail'
                        ? 'Back to Consultant'
                        : 'Back to Vendors'
                }
                onBack={() => handleNavigateView(vendorDetailReturnView)}
                candidates={candidates}
                placements={placements}
                rateMasked={rateMasked}
                initialEditing={vendorDetailInitialEdit}
                initialTab={vendorDetailInitialTab}
                initialAuditTask={vendorDetailAuditTask}
                onClearAuditTask={() => setVendorDetailAuditTask(null)}
                onSelectCandidate={(c) => handleOpenConsultantDetail(c, false, 'vendor_detail')}
                onSelectPlacement={(p) => handleOpenPlacementDetail(p, 'vendor_detail')}
                onUpdateVendor={canManageDataOperations ? handleUpdateVendor : undefined}
                onDeleteVendor={isAdmin ? handleDeleteVendor : undefined}
              />
            )}

            {currentView === 'billable' && (
              <BillablePlacementsView
                placements={placements}
                vendors={vendors}
                rateMasked={rateMasked}
                onOpenNewPlacement={
                  !rateMasked
                    ? () => handleOpenWorkflowPage('placement_new', { fromView: 'billable' })
                    : undefined
                }
                onSelectPlacement={(p) => handleOpenPlacementDetail(p, 'billable')}
                onExtendContract={!rateMasked ? handleExtendContract : undefined}
                onUpdatePlacement={!rateMasked ? handleUpdatePlacement : undefined}
                onDeletePlacement={isAdmin && !rateMasked ? handleDeletePlacement : undefined}
                showToast={showToast}
              />
            )}

            {currentView === 'placement_new' &&
              (() => {
                const reqId = routeTarget.query?.requirementId || workflowReturnReqId || undefined;
                const reqFromList = reqId ? requirements.find((r) => r.id === reqId) || null : null;
                const reqFromDetail =
                  reqId && selectedReqForDetail?.id === reqId ? selectedReqForDetail : null;
                const reqFromLaunch =
                  reqId && placementLaunchContext?.requirement?.id === reqId
                    ? placementLaunchContext.requirement
                    : null;
                const matchedReq = reqId
                  ? reqFromLaunch ||
                  (reqFromDetail &&
                    ((reqFromDetail.submissions?.length || 0) >=
                      (reqFromList?.submissions?.length || 0) ||
                      !reqFromList)
                    ? reqFromDetail
                    : reqFromList) ||
                  null
                  : null;

                const candId = routeTarget.query?.candidateId;
                const matchedSub = candId
                  ? (matchedReq?.submissions || []).find(
                    (s) =>
                      s.candidateId === candId ||
                      s.candidate?.id === candId ||
                      s.id === candId
                  )
                  : undefined;
                const matchedCandFromSub = matchedSub
                  ? (() => {
                    const base =
                      matchedSub.candidate ||
                      candidates.find(
                        (c) =>
                          (matchedSub.candidateId && c.id === matchedSub.candidateId) ||
                          c.id === candId
                      ) ||
                      (selectedCandForDetail?.id === candId ? selectedCandForDetail : null);
                    if (base) {
                      return {
                        ...base,
                        hourlyRate: matchedSub.submittedRate || base.hourlyRate || matchedSub.hourlyRate || '',
                        vendorName: matchedSub.submittedVendorName || base.vendorName,
                      };
                    }
                    return {
                      id: matchedSub.candidateId || matchedSub.id,
                      fullName: matchedSub.fullName,
                      email: matchedSub.email || '',
                      phone: matchedSub.phone || '',
                      currentTitle: matchedSub.currentTitle || '',
                      workAuth: matchedSub.workAuth || '',
                      education: '',
                      skillset: matchedSub.skillset || '',
                      hourlyRate: matchedSub.submittedRate || matchedSub.hourlyRate || '',
                      relocation: '',
                      assignedRecruiter: matchedSub.recruiterName || '',
                      pipelineStage: matchedSub.stage,
                      vendorName: matchedSub.submittedVendorName || undefined,
                    } as Candidate;
                  })()
                  : null;

                const matchedCand = candId
                  ? (placementLaunchContext?.candidate?.id === candId
                    ? placementLaunchContext.candidate
                    : null) ||
                  matchedCandFromSub ||
                  candidates.find((c) => c.id === candId) ||
                  (selectedCandForDetail?.id === candId ? selectedCandForDetail : null) ||
                  null
                  : null;
                const placementBackLabel =
                  workflowReturnView === 'requirement_detail'
                    ? matchedReq?.code
                      ? `Back to ${matchedReq.code}`
                      : 'Back to Requirement'
                    : workflowReturnView === 'pipeline'
                      ? 'Back to Pipeline'
                      : workflowReturnView === 'dashboard'
                        ? 'Back to Dashboard'
                        : 'Back to Billable Consultants';

                if (rateMasked) {
                  return (
                    <AccessRestrictedView
                      moduleName="Billable Placement Creation"
                      description="Commercial billing rates and SOW activation are masked for your current workspace role."
                      currentRole={normalizedUserRole}
                      requiredRoles={[
                        'Administrator',
                        'Senior Recruiter',
                        'Account Executive',
                        'Bench Sales Lead',
                      ]}
                      onBackToDashboard={() => handleReturnFromWorkflowPage('dashboard')}
                    />
                  );
                }

                return (
                  <PlacementCreatePage
                    key={`${reqId || 'none'}:${candId || 'none'}`}
                    initialRequirement={matchedReq}
                    initialCandidate={matchedCand}
                    requestedCandidateId={candId}
                    candidates={candidates}
                    clients={clients}
                    vendors={vendors}
                    requirements={requirements}
                    users={users}
                    backLabel={placementBackLabel}
                    onBack={() => handleReturnFromWorkflowPage('billable')}
                    onCreatePlacement={async (newPlacement, targetReqId) => {
                      await handleConfirmPlacement(newPlacement, targetReqId);
                      if (targetReqId) {
                        navigateToSpecificReqPage(targetReqId, workflowReturnView);
                      } else {
                        handleNavigateView('billable');
                      }
                    }}
                    showToast={showToast}
                  />
                );
              })()}

            {currentView === 'placement_detail' && !isResolvingCurrentDetail && (
              <PlacementDetailPage
                placement={
                  placements.find((p) => p.id === selectedPlacementForDetail?.id) ||
                  selectedPlacementForDetail
                }
                backLabel={
                  placementDetailReturnView === 'client_detail'
                    ? 'Back to Client'
                    : placementDetailReturnView === 'vendor_detail'
                      ? 'Back to Vendor'
                      : placementDetailReturnView === 'consultant_detail'
                        ? 'Back to Consultant'
                        : placementDetailReturnView === 'requirement_detail'
                          ? 'Back to Requirement'
                          : placementDetailReturnView === 'dashboard'
                            ? 'Back to Dashboard'
                            : 'Back to Billable Consultants'
                }
                onBack={() => handleNavigateView(placementDetailReturnView)}
                candidates={candidates}
                clients={clients}
                vendors={vendors}
                requirements={requirements}
                rateMasked={rateMasked}
                onExtendContract={!rateMasked ? handleExtendContract : undefined}
                onUpdatePlacement={!rateMasked ? handleUpdatePlacement : undefined}
                onDeletePlacement={isAdmin && !rateMasked ? handleDeletePlacement : undefined}
                onOpenConsultant={(cand) =>
                  handleOpenConsultantDetail(cand, false, 'placement_detail')
                }
                onOpenClient={(cl) =>
                  handleOpenClientDetail(cl, false, 'placement_detail')
                }
                onOpenVendor={(v) =>
                  handleOpenVendorDetail(v, false, 'placement_detail')
                }
                onOpenRequirement={(req) =>
                  handleOpenRequirementDetail(req, 'placement_detail')
                }
              />
            )}

            {currentView === 'user_management' &&
              (isAdmin ? (
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
                        `${user.name}'s billing rate visibility is now ${!user.rateMasked ? 'Masked (••••)' : 'Visible'
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
                          isSuperAdmin: Boolean(u.isSuperAdmin),
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
                  onResendInvite={async (user) => {
                    try {
                      const res = await apiClient.post(`/users/${user.id}/resend-invite`);
                      const emailDelivered = res.data?.delivered !== false;
                      const inviteUrl = res.data?.inviteUrl;
                      if (!emailDelivered && inviteUrl && typeof navigator !== 'undefined' && navigator.clipboard) {
                        await navigator.clipboard.writeText(inviteUrl).catch(() => { });
                      }
                      showToast(
                        emailDelivered ? 'Invitation Resent' : 'Fresh Invite Link Copied',
                        emailDelivered
                          ? `Sent a fresh onboarding invite link to ${user.email}.`
                          : `SMTP unavailable — copied fresh invite link for ${user.email} to clipboard.`,
                        emailDelivered ? 'success' : 'warning'
                      );
                    } catch (e: any) {
                      console.warn('API resend invite failed:', e);
                      showApiErrorToast(
                        e,
                        'Resend Failed',
                        `Could not resend invitation link for ${user.email}.`
                      );
                    }
                  }}
                  onToggleUserStatus={async (user) => {
                    try {
                      const res = await apiClient.patch(`/users/${user.id}/status`);
                      const newStatus = res.data?.data?.status === 'SUSPENDED' ? 'Suspended' : 'Active';
                      setUsers((prev) =>
                        prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
                      );
                      showToast('Status Updated', `${user.name} is now ${newStatus}.`, 'shield');
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
                      showToast('Member Removed', `${user.name} has been removed from agency roster.`, 'delete');
                    } catch (e: any) {
                      console.warn('API delete user failed:', e);
                      showApiErrorToast(e, 'Remove Failed', `Could not remove ${user.name}.`);
                      throw e;
                    }
                  }}
                  showToast={showToast}
                />
              ) : (
                <AccessRestrictedView
                  moduleName="User Management & Team Permissions"
                  description="Inviting team members, changing workspace roles, and controlling billing rate visibility are restricted to workspace Administrators."
                  currentRole={normalizedUserRole}
                  requiredRoles={['Administrator']}
                  onBackToDashboard={() => handleNavigateView('dashboard')}
                />
              ))}

            {(currentView === 'application_forms' ||
              currentView === 'application_form_new' ||
              currentView === 'application_form_edit' ||
              currentView === 'custom_fields' ||
              currentView === 'dropdown_lists') &&
              (isAdmin ? (
                <CustomFieldsView
                  pageMode={
                    currentView === 'application_forms'
                      ? 'forms'
                      : currentView === 'application_form_new'
                        ? 'form_create'
                        : currentView === 'application_form_edit'
                          ? 'form_edit'
                          : currentView === 'dropdown_lists'
                            ? 'dropdowns'
                            : 'fields'
                  }
                  editingFormId={
                    currentView === 'application_form_edit' ? routeTarget.entityId : null
                  }
                  onNavigateForms={(target) => handleOpenApplicationFormPage(target)}
                  customFields={customFields}
                  onAddCustomField={(f) => setCustomFields((prev) => [...prev, f])}
                  showToast={showToast}
                />
              ) : (
                <AccessRestrictedView
                  moduleName={
                    currentView === 'application_forms' ||
                      currentView === 'application_form_new' ||
                      currentView === 'application_form_edit'
                      ? 'Application Forms'
                      : currentView === 'dropdown_lists'
                        ? 'Master Dropdown Lists'
                        : 'Custom Form Fields'
                  }
                  description="Creating or editing application forms, custom fields, and master dropdown taxonomies is restricted to workspace Administrators."
                  currentRole={normalizedUserRole}
                  requiredRoles={['Administrator']}
                  onBackToDashboard={() => handleNavigateView('dashboard')}
                />
              ))}

            {currentView === 'automation' && (
              <AutomationsView
                rules={rules}
                auditLogs={auditLogs}
                tenantId={currentUser?.tenantId || 'squadpipe-agency'}
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

            {currentView === 'import_data' &&
              (canManageDataOperations ? (
                <ImportDataView
                  onOpenResumeParser={() =>
                    handleOpenWorkflowPage('import_resume', { fromView: 'import_data' })
                  }
                  onOpenCsvImport={() =>
                    handleOpenWorkflowPage('import_csv', { fromView: 'import_data' })
                  }
                  showToast={showToast}
                />
              ) : (
                <AccessRestrictedView
                  moduleName="Bulk CSV / Excel Import"
                  description="Bulk candidate spreadsheet imports are restricted to leadership and senior recruiting roles to maintain clean workspace data. You can still add candidates or parse individual resumes in Consultants."
                  currentRole={normalizedUserRole}
                  requiredRoles={[
                    'Administrator',
                    'Senior Recruiter',
                    'Account Executive',
                    'Bench Sales Lead',
                  ]}
                  onBackToDashboard={() => handleNavigateView('dashboard')}
                  secondaryAction={{
                    label: 'Go to Consultants',
                    onClick: () => handleNavigateView('consultants'),
                  }}
                />
              ))}

            {currentView === 'import_resume' &&
              (() => {
                const reqId = routeTarget.query?.requirementId || workflowReturnReqId || undefined;
                const lockedReq = reqId
                  ? requirements.find((r) => r.id === reqId) ||
                  (selectedReqForDetail?.id === reqId ? selectedReqForDetail : null) ||
                  null
                  : null;
                const resumeBackLabel =
                  workflowReturnView === 'requirement_detail'
                    ? lockedReq?.code
                      ? `Back to ${lockedReq.code}`
                      : 'Back to Requirement'
                    : workflowReturnView === 'consultant_new'
                      ? 'Back to Add Consultant'
                      : workflowReturnView === 'consultants'
                        ? 'Back to Consultants'
                        : workflowReturnView === 'pipeline'
                          ? 'Back to Pipeline'
                          : workflowReturnView === 'dashboard'
                            ? 'Back to Dashboard'
                            : 'Back to Import Data';

                return (
                  <ResumeImportPage
                    lockedRequirement={lockedReq}
                    users={users}
                    bulkQueue={bulkResumeQueue}
                    backLabel={resumeBackLabel}
                    onBack={() => handleReturnFromWorkflowPage('import_data')}
                    onApprove={async (savedCand, opts) => {
                      const updatedReq = await handleResumeCandidateApproved(savedCand, opts);
                      if (!opts?.stayOnPage) {
                        if (updatedReq || opts?.targetRequirement) {
                          navigateToSpecificReqPage(
                            (updatedReq || opts?.targetRequirement)!,
                            workflowReturnView
                          );
                        } else if (workflowReturnView === 'consultant_new') {
                          handleNavigateView(
                            consultantNewReturnViewRef.current === 'dashboard'
                              ? 'dashboard'
                              : 'consultants'
                          );
                        } else {
                          handleReturnFromWorkflowPage('consultants');
                        }
                      }
                    }}
                    onBulkDone={
                      lockedReq
                        ? () => {
                          bulkResumeQueue.dismissBanner();
                          navigateToSpecificReqPage(lockedReq, workflowReturnView);
                        }
                        : (_, batchReq) => {
                          if (batchReq) {
                            bulkResumeQueue.dismissBanner();
                            navigateToSpecificReqPage(batchReq, workflowReturnView);
                          } else {
                            bulkResumeQueue.dismissBanner();
                            if (workflowReturnView === 'consultant_new') {
                              handleNavigateView(
                                consultantNewReturnViewRef.current === 'dashboard'
                                  ? 'dashboard'
                                  : 'consultants'
                              );
                            } else {
                              handleReturnFromWorkflowPage('consultants');
                            }
                          }
                        }
                    }
                    onSwitchToCsvImport={
                      canManageDataOperations
                        ? () =>
                          handleOpenWorkflowPage('import_csv', {
                            requirementId: reqId,
                            fromView: workflowReturnView,
                            returnReqId: workflowReturnReqId || reqId,
                          })
                        : undefined
                    }
                    showToast={showToast}
                  />
                );
              })()}

            {currentView === 'import_csv' &&
              (canManageDataOperations ? (
                (() => {
                  const reqId = routeTarget.query?.requirementId || workflowReturnReqId || undefined;
                  const lockedReq = reqId
                    ? requirements.find((r) => r.id === reqId) ||
                    (selectedReqForDetail?.id === reqId ? selectedReqForDetail : null) ||
                    null
                    : null;
                  const csvBackLabel =
                    workflowReturnView === 'requirement_detail'
                      ? lockedReq?.code
                        ? `Back to ${lockedReq.code}`
                        : 'Back to Requirement'
                      : workflowReturnView === 'consultants'
                        ? 'Back to Consultants'
                        : workflowReturnView === 'pipeline'
                          ? 'Back to Pipeline'
                          : workflowReturnView === 'dashboard'
                            ? 'Back to Dashboard'
                            : 'Back to Import Data';

                  return (
                    <CsvImportPage
                      lockedRequirement={lockedReq}
                      backLabel={csvBackLabel}
                      onBack={() => handleReturnFromWorkflowPage('import_data')}
                      onImportComplete={async (result) => {
                        await handleCsvImportCompleted(result);
                        const targetReq = result.updatedRequirement || lockedReq;
                        if (targetReq) {
                          navigateToSpecificReqPage(targetReq, workflowReturnView);
                        }
                      }}
                      onSwitchToResumeParser={() =>
                        handleOpenWorkflowPage('import_resume', {
                          requirementId: reqId,
                          fromView: workflowReturnView,
                          returnReqId: workflowReturnReqId || reqId,
                        })
                      }
                      onNavigate={(view) => handleNavigateView(view)}
                      showToast={showToast}
                    />
                  );
                })()
              ) : (
                <AccessRestrictedView
                  moduleName="Bulk CSV / Excel Import"
                  description="Bulk candidate spreadsheet imports are restricted to leadership and senior recruiting roles to maintain clean workspace data. You can still add candidates or parse individual resumes in Consultants."
                  currentRole={normalizedUserRole}
                  requiredRoles={[
                    'Administrator',
                    'Senior Recruiter',
                    'Account Executive',
                    'Bench Sales Lead',
                  ]}
                  onBackToDashboard={() => handleNavigateView('dashboard')}
                  secondaryAction={{
                    label: 'Go to Consultants',
                    onClick: () => handleNavigateView('consultants'),
                  }}
                />
              ))}

            {currentView === 'team_performance' &&
              (isAdmin ? (
                <TeamPerformanceView showToast={showToast} />
              ) : (
                <AccessRestrictedView
                  moduleName="Team Performance"
                  description="Recruiter performance scorecards, activity leaderboards, and conversion rates are restricted to workspace Administrators."
                  currentRole={normalizedUserRole}
                  requiredRoles={['Administrator']}
                  onBackToDashboard={() => handleNavigateView('dashboard')}
                />
              ))}

            {currentView === 'usage' &&
              (isAdmin ? (
                <UsageView showToast={showToast} />
              ) : (
                <AccessRestrictedView
                  moduleName="Workspace Usage & Storage"
                  description="Document storage metrics, record counts, and active AI usage quotas are restricted to workspace Administrators."
                  currentRole={normalizedUserRole}
                  requiredRoles={['Administrator']}
                  onBackToDashboard={() => handleNavigateView('dashboard')}
                />
              ))}

            {currentView === 'settings_general' &&
              (isAdmin ? (
                <SettingsView
                  activeTab="general"
                  onTabChange={() => handleNavigateView('settings_general')}
                  showToast={showToast}
                />
              ) : (
                <AccessRestrictedView
                  moduleName="General Settings"
                  description="Workspace branding, billing policies, and organization-wide defaults are restricted to workspace Administrators."
                  currentRole={normalizedUserRole}
                  requiredRoles={['Administrator']}
                  onBackToDashboard={() => handleNavigateView('dashboard')}
                />
              ))}
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
            showToast('Reminders Checked', `Checked active reminders (${count} new alert${count === 1 ? '' : 's'} found).`);
          } catch {
            showToast('Check Failed', 'Could not check reminders right now.', 'error');
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
            showApiErrorToast(e, 'Update Failed', 'Could not update reminder status.');
          }
        }}
      />

      {/* Specialized Drawers */}
      <SkillMatcherModal
        isOpen={isMatcherModalOpen}
        onClose={() => setIsMatcherModalOpen(false)}
        requirements={requirements}
        candidates={candidates}
        initialRequirement={
          requirements.find((r) => r.id === activeReq?.id) || activeReq
        }
        rateMasked={rateMasked}
        onSubmitCandidate={async (candidate, requirement) => {
          await handleAssignCandidate(requirement, candidate);
          navigateToSpecificReqPage(requirement, currentView);
        }}
        onAttachCandidates={async (requirement, candidateIds) => {
          await handleAttachCandidates(requirement, candidateIds);
          navigateToSpecificReqPage(requirement, currentView);
        }}
        onOpenCsvImport={
          canManageDataOperations
            ? (req) => handleOpenInlineCsvPopup(req)
            : undefined
        }
        onOpenResumeParser={
          canManageDataOperations
            ? (req) => handleOpenInlineResumePopup(req)
            : undefined
        }
        showToast={showToast}
      />

      {/* Contextual Import Popups (e.g. inside Attach Candidates drawer) */}
      <ResumeParserModal
        isOpen={isInlineResumeModalOpen}
        onClose={() => {
          setIsInlineResumeModalOpen(false);
          setInlineImportTargetReq(null);
        }}
        lockedRequirement={
          inlineImportTargetReq
            ? requirements.find((r) => r.id === inlineImportTargetReq.id) || inlineImportTargetReq
            : null
        }
        users={users}
        bulkQueue={bulkResumeQueue}
        onApprove={async (savedCand, opts) => {
          const updatedReq = await handleResumeCandidateApproved(savedCand, opts);
          if (!opts?.stayOnPage) {
            if (updatedReq || opts?.targetRequirement) {
              navigateToSpecificReqPage((updatedReq || opts?.targetRequirement)!, currentView);
            } else {
              setIsInlineResumeModalOpen(false);
              setInlineImportTargetReq(null);
            }
          }
        }}
        onBulkDone={(_, batchReq) => {
          const targetReq = batchReq || inlineImportTargetReq;
          bulkResumeQueue.dismissBanner();
          if (targetReq) {
            navigateToSpecificReqPage(targetReq, currentView);
          } else {
            setIsInlineResumeModalOpen(false);
            setInlineImportTargetReq(null);
          }
        }}
        onSwitchToCsvImport={
          canManageDataOperations
            ? () => {
              setIsInlineResumeModalOpen(false);
              setIsInlineCsvModalOpen(true);
            }
            : undefined
        }
        onOpenFullPage={() => {
          const reqId = inlineImportTargetReq?.id;
          setIsInlineResumeModalOpen(false);
          setIsMatcherModalOpen(false);
          handleOpenWorkflowPage('import_resume', {
            requirementId: reqId,
            fromView: currentView,
            returnReqId: currentView === 'requirement_detail' ? reqId : undefined,
          });
        }}
        showToast={showToast}
      />

      <CsvImportModal
        isOpen={isInlineCsvModalOpen && canManageDataOperations}
        onClose={() => {
          setIsInlineCsvModalOpen(false);
          setInlineImportTargetReq(null);
        }}
        lockedRequirement={
          inlineImportTargetReq
            ? requirements.find((r) => r.id === inlineImportTargetReq.id) || inlineImportTargetReq
            : null
        }
        onImportComplete={async (result) => {
          await handleCsvImportCompleted(result);
          const targetReq = result.updatedRequirement || inlineImportTargetReq;
          if (targetReq) {
            navigateToSpecificReqPage(targetReq, currentView);
          }
        }}
        onSwitchToResumeParser={() => {
          setIsInlineCsvModalOpen(false);
          setIsInlineResumeModalOpen(true);
        }}
        onOpenFullPage={() => {
          const reqId = inlineImportTargetReq?.id;
          setIsInlineCsvModalOpen(false);
          setIsMatcherModalOpen(false);
          handleOpenWorkflowPage('import_csv', {
            requirementId: reqId,
            fromView: currentView,
            returnReqId: currentView === 'requirement_detail' ? reqId : undefined,
          });
        }}
        onNavigate={(view) => {
          setIsInlineCsvModalOpen(false);
          setIsMatcherModalOpen(false);
          setInlineImportTargetReq(null);
          handleNavigateView(view);
        }}
        showToast={showToast}
      />

      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        isAdmin={isAdmin}
        canManageDataOperations={canManageDataOperations}
        canCreatePlacement={!rateMasked}
        requirements={requirements}
        candidates={candidates}
        clients={clients}
        vendors={vendors}
        onNavigate={(view) => handleNavigateView(view)}
        onOpenWorkflowPage={(view) => handleOpenWorkflowPage(view, { fromView: currentView })}
        onOpenCreateModal={(type) => setActiveCreateModal(type)}
        onSelectRequirement={(req) => handleOpenRequirementDetail(req, currentView)}
        onSelectConsultant={(cand) => handleOpenConsultantDetail(cand, false, currentView)}
        onSelectClient={(cl) => handleOpenClientDetail(cl, false, currentView)}
        onSelectVendor={(v) => handleOpenVendorDetail(v, false, currentView)}
      />

      {/* Focused Short Entity Modals (Client & Vendor) */}
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
