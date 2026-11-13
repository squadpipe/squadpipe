import React, { useState, useEffect } from 'react';
import { apiClient } from './config/api.config';

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
          hourlyRate: c.hourlyRateDisplay || (c.hourlyRateW2 ? `$${c.hourlyRateW2}/hr (W2)` : ''),
          relocation: c.relocation || 'Yes',
          resumeName: c.resumeFileName || '',
          resumeFormat: c.resumeFormat || 'PDF',
          assignedRecruiter: c.assignedRecruiter?.fullName || c.assignedRecruiter || '',
          pipelineStage: c.pipelineStage || 'Available / Bench',
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
          status: r.status || 'Requirement',
          resourceName: r.resourceName || '',
          assignedRecruiter:
            r.assignedRecruiter?.fullName ||
            r.assignedRecruiter?.name ||
            (typeof r.assignedRecruiter === 'string' ? r.assignedRecruiter : ''),
          targetBillRate: r.targetBillRate,
          targetPayRate: r.targetPayRate,
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
        const raw = res.data.data;
        const mapped = raw.map((p: any) => ({
          id: p.id,
          recruiter:
            p.recruiter?.fullName ||
            p.recruiter?.name ||
            (typeof p.recruiter === 'string' ? p.recruiter : ''),
          deployment: p.deployment || 'Onshore',
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
          startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
          endDate: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : '',
          billing: p.billing || (p.billRate ? `$${p.billRate}/hr` : ''),
          payRate: p.payRate || (p.payRateAmount ? `$${p.payRateAmount}/hr` : ''),
          placementType: p.placementType || '',
          hourlySpread:
            p.hourlySpread !== undefined && p.hourlySpread !== null
              ? Number(p.hourlySpread)
              : undefined,
          marginPct:
            p.marginPct !== undefined && p.marginPct !== null
              ? Number(p.marginPct)
              : undefined,
        }));
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
          role: u.role || 'Associate Recruiter',
          desk: u.desk || '',
          rateMasked: u.rateMasked ?? true,
          workload: u.workload || '',
          status: u.status || 'Active',
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
        const mappedRules = raw.map((rl: any) => ({
          id: rl.id,
          name: rl.name,
          category: rl.category || '',
          icon: rl.icon || 'fa-solid fa-gear',
          color: rl.color || 'blue',
          active: rl.active ?? rl.isActive ?? true,
          whenText: rl.whenText || '',
          threshold: rl.threshold || '',
          thenSummary: rl.thenSummary || '',
          actionPills: rl.actionPills || [],
          executionsToday: rl.executionsToday || 0,
          lastFired: rl.lastFired || 'Active',
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
              ? 'Currency ($)'
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

  // 1. Fetch lightweight navigation counts once on authentication
  useEffect(() => {
    if (!authToken && !currentUser) return;
    fetchSidebarCounts();
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
  const handleStatusChange = (req: Requirement, newStatus: any) => {
    setRequirements((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: newStatus } : r))
    );
    apiClient
      .put(`/requirements/${req.id}`, { status: newStatus })
      .catch((e) => console.warn('API status change:', e));

    showToast(
      'Stage Updated',
      `${req.opportunityTitle} moved to ${newStatus}.`,
      'fa-solid fa-arrows-spin text-brand-600'
    );
  };

  const handleAssignCandidate = (req: Requirement, candidate: Candidate) => {
    setRequirements((prev) =>
      prev.map((r) =>
        r.id === req.id
          ? { ...r, resourceName: candidate.fullName, status: 'Submitted' }
          : r
      )
    );
    apiClient
      .put(`/requirements/${req.id}`, {
        resourceName: candidate.fullName,
        status: 'Submitted',
      })
      .catch((e) => console.warn('API assign candidate:', e));

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
    try {
      await apiClient.post('/placements', newPlacement);
    } catch (e) {
      console.warn('API confirm placement:', e);
    }
    setPlacements((prev) => [newPlacement, ...prev]);
    if (reqId) {
      setRequirements((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: 'Onboarding' } : r))
      );
      apiClient
        .put(`/requirements/${reqId}`, { status: 'Onboarding' })
        .catch((e) => console.warn('API update requirement status:', e));
    }
    setAuditLogs((prev) => [
      {
        id: 'log_' + Date.now(),
        timestamp: 'Just now',
        ruleName: 'Placement Activation & Margin Lock',
        target: `${newPlacement.resourceName} @ ${newPlacement.customer}`,
        conditionsMet: `Bill: ${newPlacement.billing} | Spread: +$${Number(
          newPlacement.hourlySpread || 0
        ).toFixed(2)}/hr`,
        actionDispatched: 'Registered to Billable Ledger & 30d Expiration Radar Scheduled',
        status: 'Executed',
      },
      ...prev,
    ]);
    showToast(
      'Placement Activated',
      `Locked in commercial placement for ${newPlacement.resourceName}!`,
      'fa-solid fa-file-invoice-dollar text-emerald-400'
    );
  };

  const handleExtendContract = async (placement: BillablePlacement) => {
    const currentEnd = placement.endDate ? new Date(placement.endDate) : new Date();
    currentEnd.setFullYear(currentEnd.getFullYear() + 1);
    const newEnd = currentEnd.toISOString().split('T')[0];

    try {
      await apiClient.post(`/placements/${placement.id}/extend`, { newEndDate: newEnd });
    } catch (e) {
      console.warn('API placement extension:', e);
    }

    setPlacements((prev) =>
      prev.map((p) => (p.id === placement.id ? { ...p, endDate: newEnd } : p))
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

  const handleUpdateProfile = (updated: User) => {
    setCurrentUser(updated);
    localStorage.setItem('talentos_current_user', JSON.stringify(updated));
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    showToast(
      'Profile Updated',
      'Your profile details have been updated.',
      'fa-solid fa-circle-check text-emerald-500'
    );
  };

  // If unauthenticated, render the full-screen Obsidian SaaS Login View
  if (!currentUser) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-[#0B0F17]">
        {/* Global Toast Banner */}
        {toast && (
          <div className="fixed top-5 right-5 z-50 bg-white border border-slate-200 shadow-2xl rounded-xl p-4 flex items-center gap-3 animate-fade-in">
            <i className={`${toast.icon} text-base`}></i>
            <div>
              <div className="text-xs font-bold text-slate-900">{toast.title}</div>
              <div className="text-[11px] text-slate-500">{toast.message}</div>
            </div>
          </div>
        )}

        <LoginView
          onLoginSuccess={(user, token) => {
            setCurrentUser(user);
            setAuthToken(token);
            setRateMasked(user.rateMasked ?? false);
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
        <div className="fixed top-5 right-5 z-50 bg-white border border-slate-200 card-shadow rounded-xl p-4 flex items-center gap-3 animate-fade-in">
          <i className={`${toast.icon} text-base`}></i>
          <div>
            <div className="text-xs font-bold text-slate-900">{toast.title}</div>
            <div className="text-[11px] text-slate-500">{toast.message}</div>
          </div>
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
            />
          )}

          {currentView === 'clients' && (
            <ClientsView
              clients={clients}
              requirements={requirements}
              placements={placements}
              onOpenAddClient={() => setActiveCreateModal('client')}
              showToast={showToast}
            />
          )}

          {currentView === 'vendors' && (
            <VendorsView
              vendors={vendors}
              onOpenAddVendor={() => setActiveCreateModal('vendor')}
            />
          )}

          {currentView === 'billable' && (
            <BillablePlacementsView
              placements={placements}
              rateMasked={rateMasked}
              onOpenNewPlacement={() => setActiveCreateModal('placement')}
              onExtendContract={handleExtendContract}
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
                try {
                  await apiClient.post('/users/invite', newUser);
                } catch (e) {
                  console.warn('API invite user failed:', e);
                }
                const invitedUser: User = {
                  id: 'usr_' + Date.now(),
                  name,
                  email,
                  role: newUser.role || '',
                  desk: newUser.desk || '',
                  rateMasked: newUser.rateMasked ?? true,
                  workload: '0 Requisitions • 0 Submissions',
                  status: 'Active',
                  lastActive: 'Active Now',
                };
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
              onTestTrigger={handleTestTriggerRule}
              onToggleRule={(id) => {
                setRules((prev) =>
                  prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
                );
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
      />

      {/* Specialized Modals */}
      <ResumeParserModal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        onApprove={(c) => setCandidates((prev) => [c, ...prev])}
        onSwitchToCsvImport={() => {
          setIsResumeModalOpen(false);
          setCurrentView('import_data');
        }}
        showToast={showToast}
      />

      <EmailParserModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onApprove={(req) => setRequirements((prev) => [req, ...prev])}
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
        requirement={activeReq}
        showToast={showToast}
      />

      <PlacementWizardModal
        isOpen={isPlacementWizardOpen}
        onClose={() => setIsPlacementWizardOpen(false)}
        candidate={activeCandidate}
        requirement={activeReq}
        onConfirmPlacement={handleConfirmPlacement}
        showToast={showToast}
      />

      {/* 5 Distinct Dedicated Add Modals matching Prototype lines 3700-4210 */}
      <AddConsultantModal
        isOpen={activeCreateModal === 'consultant'}
        onClose={() => setActiveCreateModal(null)}
        users={users}
        onSave={(c) => {
          setCandidates((prev) => [c, ...prev]);
          apiClient.post('/candidates', c).catch((e) => console.warn('API save candidate:', e));
        }}
        showToast={showToast}
      />

      <AddRequirementModal
        isOpen={activeCreateModal === 'requirement'}
        onClose={() => setActiveCreateModal(null)}
        clients={clients}
        users={users}
        onSave={(r) => {
          setRequirements((prev) => [r, ...prev]);
          apiClient.post('/requirements', r).catch((e) => console.warn('API save requirement:', e));
        }}
        showToast={showToast}
      />

      <AddClientModal
        isOpen={activeCreateModal === 'client'}
        onClose={() => setActiveCreateModal(null)}
        onSave={(cl) => {
          setClients((prev) => [cl, ...prev]);
          apiClient.post('/clients', cl).catch((e) => console.warn('API save client:', e));
        }}
        showToast={showToast}
      />

      <AddVendorModal
        isOpen={activeCreateModal === 'vendor'}
        onClose={() => setActiveCreateModal(null)}
        onSave={(v) => {
          setVendors((prev) => [v, ...prev]);
          apiClient.post('/vendors', v).catch((e) => console.warn('API save vendor:', e));
        }}
        showToast={showToast}
      />

      <AddPlacementModal
        isOpen={activeCreateModal === 'placement'}
        onClose={() => setActiveCreateModal(null)}
        clients={clients}
        users={users}
        onSave={(p) => {
          setPlacements((prev) => [p, ...prev]);
          apiClient.post('/placements', p).catch((e) => console.warn('API save placement:', e));
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
