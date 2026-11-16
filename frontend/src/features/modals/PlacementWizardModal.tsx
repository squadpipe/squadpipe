import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Check, ChevronDown, DollarSign, Lock, Search, X, UserCheck } from 'lucide-react';
import { BillablePlacement, Requirement, Candidate, Vendor } from '../../types';
import { inferPlacementTypeFromRate, parseRateNumber, useCurrency } from '../../utils/currency';
import { getStageBadgeClass } from '../../utils/stageStyles';
import { SearchableSelectInput } from '../../components/shared/SearchableSelectInput';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { getVendorComplianceWarning } from '../billable/placementUtils';

interface PlacementWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate?: Candidate | null;
  candidates?: Candidate[];
  vendors?: Vendor[];
  requirement?: Requirement | null;
  onConfirmPlacement: (placement: BillablePlacement, reqId?: string) => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const PlacementWizardModal: React.FC<PlacementWizardModalProps> = ({
  isOpen,
  onClose,
  candidate,
  candidates = [],
  vendors = [],
  requirement,
  onConfirmPlacement,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consultantMenuOpen, setConsultantMenuOpen] = useState(false);
  const [consultantSearch, setConsultantSearch] = useState('');
  const consultantMenuRef = useRef<HTMLDivElement | null>(null);
  const openPositions = requirement?.openPositions || 1;
  const filledPositions = requirement
    ? (requirement.filledPositions ?? requirement.activePlacements?.length ?? 0)
    : 0;
  const isPositionsFull = Boolean(requirement && filledPositions >= openPositions);
  const getContactStr = (c: any) => (typeof c === 'object' && c !== null ? c.fullName || c.name || '' : String(c || ''));
  const getRecruiterStr = (r: any) => (typeof r === 'object' && r !== null ? r.fullName || r.name || '' : String(r || ''));

  const [formData, setFormData] = useState({
    candidateId: candidate?.id || '',
    resourceName: candidate?.fullName || '',
    customer: requirement?.companyName || '',
    customerContact: getContactStr(requirement?.clientContact),
    phone: candidate?.phone || '',
    email: candidate?.email || '',
    skillRole: requirement?.opportunityTitle || '',
    deployment: 'Onshore',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    billRate: requirement?.targetBillRate || 0,
    payRate: requirement?.targetPayRate || 0,
    placementType: 'W2 Hourly',
    vendorName: '',
    purchaseOrderNumber: '',
    recruiter: getRecruiterStr(requirement?.assignedRecruiter || candidate?.assignedRecruiter),
  });

  useEffect(() => {
    if (isOpen) {
      const reqSubCandIds = new Set(
        (requirement?.submissions || []).map((s) => s.candidateId).filter(Boolean)
      );
      const preferredSub =
        requirement?.submissions?.find((s) => s.stage === 'Selected') ||
        requirement?.submissions?.find((s) => s.stage !== 'Closed') ||
        requirement?.submissions?.[0];

      const matchedCandidate =
        candidate ||
        (preferredSub?.candidateId
          ? candidates.find((c) => c.id === preferredSub.candidateId)
          : undefined) ||
        preferredSub?.candidate ||
        candidates.find(
          (c) =>
            (preferredSub?.fullName &&
              c.fullName.trim().toLowerCase() === preferredSub.fullName.trim().toLowerCase()) ||
            (requirement?.resourceName &&
              c.fullName.trim().toLowerCase() === requirement.resourceName.trim().toLowerCase())
        ) ||
        null;

      const candPay = matchedCandidate?.hourlyRate
        ? parseRateNumber(matchedCandidate.hourlyRate, 0)
        : 0;
      const resolvedPay = candPay > 0 ? candPay : requirement?.targetPayRate || 0;

      const candVendor =
        (matchedCandidate?.vendorId
          ? vendors.find((v) => v.id === matchedCandidate.vendorId)
          : undefined) ||
        (matchedCandidate?.vendorName ? { name: matchedCandidate.vendorName } : undefined);
      const inferredType = candVendor
        ? 'C2C Subcontractor'
        : inferPlacementTypeFromRate(matchedCandidate?.hourlyRate) || 'W2 Hourly';

      setFormData({
        candidateId: matchedCandidate?.id || (reqSubCandIds.size === 1 ? Array.from(reqSubCandIds)[0] : ''),
        resourceName: matchedCandidate?.fullName || preferredSub?.fullName || requirement?.resourceName || '',
        customer: requirement?.companyName || '',
        customerContact: getContactStr(requirement?.clientContact),
        phone: matchedCandidate?.phone || preferredSub?.phone || '',
        email: matchedCandidate?.email || preferredSub?.email || '',
        skillRole: requirement?.opportunityTitle || matchedCandidate?.currentTitle || '',
        deployment: 'Onshore',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        billRate: requirement?.targetBillRate || 0,
        payRate: resolvedPay,
        placementType: inferredType,
        vendorName: candVendor?.name || '',
        purchaseOrderNumber: '',
        recruiter: getRecruiterStr(requirement?.assignedRecruiter || matchedCandidate?.assignedRecruiter),
      });
    }
  }, [isOpen, candidate, requirement, candidates, vendors]);

  useEffect(() => {
    if (!isOpen) {
      setConsultantMenuOpen(false);
      setConsultantSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!consultantMenuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (consultantMenuRef.current && !consultantMenuRef.current.contains(e.target as Node)) {
        setConsultantMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [consultantMenuOpen]);

  if (!isOpen) return null;

  const bill = Number(formData.billRate) || 0;
  const pay = Number(formData.payRate) || 0;
  const spread = bill - pay;
  const marginPct = bill > 0 ? ((spread / bill) * 100).toFixed(1) : '0.0';
  const monthlyGrossProfit = Math.round(spread * 160).toLocaleString();

  const handleSelectCandidate = (candidateId: string, fallbackCandidate?: Candidate | null) => {
    const sel = candidates.find((c) => c.id === candidateId) || fallbackCandidate || null;
    if (!sel) {
      setFormData((prev) => ({ ...prev, candidateId: '' }));
      return;
    }
    const candPay = sel.hourlyRate ? parseRateNumber(sel.hourlyRate, 0) : 0;
    const candVendor =
      (sel.vendorId ? vendors.find((v) => v.id === sel.vendorId) : undefined) ||
      (sel.vendorName ? { name: sel.vendorName } : undefined);
    const inferredType = candVendor
      ? 'C2C Subcontractor'
      : inferPlacementTypeFromRate(sel.hourlyRate);
    setFormData((prev) => ({
      ...prev,
      candidateId: sel.id,
      resourceName: sel.fullName,
      phone: sel.phone || prev.phone,
      email: sel.email || prev.email,
      skillRole: prev.skillRole || sel.currentTitle || '',
      payRate: candPay > 0 ? candPay : prev.payRate,
      recruiter: prev.recruiter || getRecruiterStr(sel.assignedRecruiter),
      placementType: inferredType || prev.placementType,
      vendorName: candVendor ? candVendor.name : prev.vendorName,
    }));
  };

  const handleConfirm = async () => {
    if (isPositionsFull) {
      showToast(
        'Positions Filled',
        `All ${openPositions} open position(s) for this requirement are already placed (${filledPositions}/${openPositions}).`,
        'fa-solid fa-triangle-exclamation text-amber-500'
      );
      return;
    }
    if (!formData.resourceName.trim()) {
      showToast('Validation Error', 'Please enter or select a candidate resource name.', 'fa-solid fa-triangle-exclamation text-amber-500');
      return;
    }

    const matchedVendor = vendors.find(
      (v) => v.name.trim().toLowerCase() === formData.vendorName.trim().toLowerCase()
    );

    const newPlacement: BillablePlacement = {
      id: 'bill_' + Date.now(),
      candidateId: formData.candidateId || undefined,
      requirementId: requirement?.id,
      vendorId: matchedVendor?.id,
      vendorName: formData.placementType === 'C2C Subcontractor' ? formData.vendorName.trim() || undefined : undefined,
      purchaseOrderNumber: formData.purchaseOrderNumber.trim() || undefined,
      recruiter: formData.recruiter,
      deployment: formData.deployment,
      customer: formData.customer,
      customerContact: formData.customerContact,
      resourceName: formData.resourceName.trim(),
      phone: formData.phone,
      email: formData.email,
      skillRole: formData.skillRole,
      startDate: formData.startDate,
      endDate: formData.endDate,
      billing: `${currencySymbol}${bill}/hr`,
      payRate: `${currencySymbol}${pay}/hr`,
      placementType: formData.placementType,
      hourlySpread: spread,
      marginPct: parseFloat(marginPct),
      status: 'Active',
    };

    setIsSubmitting(true);
    try {
      await onConfirmPlacement(newPlacement, requirement?.id);
      onClose();
    } catch {
      // Error toast already handled by onConfirmPlacement
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 card-shadow overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Placement Activation & Margin Lock Wizard</h3>
              <p className="text-[11px] text-slate-400">Formalize commercial billing terms, calculate margin spread, and register SOW</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Select Consultant Dropdown */}
          {candidates.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                  <span>Select / Switch Placed Consultant</span>
                </label>
                {requirement && (
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                      (requirement.filledPositions ?? requirement.activePlacements?.length ?? 0) >=
                      (requirement.openPositions || 1)
                        ? 'bg-amber-500/[0.1] text-amber-800'
                        : 'bg-slate-200/70 text-slate-700'
                    }`}
                  >
                    Positions: {requirement.filledPositions ?? requirement.activePlacements?.length ?? 0} /{' '}
                    {requirement.openPositions || 1} Filled
                  </span>
                )}
              </div>
              {(() => {
                const placedIds = new Set(
                  (requirement?.activePlacements || []).map((p) => p.candidateId).filter(Boolean)
                );
                const placedNames = new Set(
                  (requirement?.activePlacements || []).map((p) => p.resourceName.trim().toLowerCase())
                );
                const submittedList: Array<{ candidate: Candidate; stage: string }> = requirement
                  ? (requirement.submissions || [])
                      .filter((s) => s.stage !== 'Closed')
                      .map((s) => {
                        const candObj =
                          s.candidate ||
                          candidates.find(
                            (c) =>
                              (s.candidateId && c.id === s.candidateId) ||
                              c.fullName.trim().toLowerCase() === s.fullName.trim().toLowerCase()
                          ) ||
                          ({
                            id: s.candidateId || s.id,
                            fullName: s.fullName,
                            email: s.email || '',
                            phone: s.phone || '',
                            currentTitle: s.currentTitle || '',
                            workAuth: s.workAuth || '',
                            education: '',
                            skillset: s.skillset || '',
                            hourlyRate: s.hourlyRate || '',
                            relocation: '',
                            assignedRecruiter: '',
                            pipelineStage: s.stage,
                          } as Candidate);
                        return { candidate: candObj, stage: s.stage };
                      })
                      .filter(
                        ({ candidate: c }) =>
                          !placedIds.has(c.id) &&
                          !placedNames.has(c.fullName.trim().toLowerCase())
                      )
                  : candidates.map((c) => ({ candidate: c, stage: c.pipelineStage }));

                const q = consultantSearch.trim().toLowerCase();
                const filteredList = submittedList.filter(
                  ({ candidate: c, stage }) =>
                    !q ||
                    c.fullName.toLowerCase().includes(q) ||
                    (c.currentTitle || '').toLowerCase().includes(q) ||
                    stage.toLowerCase().includes(q)
                );

                const selectedEntry = submittedList.find(
                  ({ candidate: c }) => c.id === formData.candidateId
                );

                return (
                  <div ref={consultantMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setConsultantMenuOpen((prev) => !prev)}
                      className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 hover:border-brand-300 rounded-xl text-left flex items-center justify-between gap-2 transition-colors cursor-pointer focus:outline-none focus:border-brand-500"
                    >
                      {selectedEntry ? (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                            {selectedEntry.candidate.fullName.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900">
                              {selectedEntry.candidate.fullName}
                            </span>
                            {selectedEntry.candidate.currentTitle && (
                              <span className="text-slate-400 ml-1.5">
                                — {selectedEntry.candidate.currentTitle}
                              </span>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex-shrink-0 ${getStageBadgeClass(selectedEntry.stage)}`}>
                            {selectedEntry.stage}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          {requirement
                            ? `Select from ${submittedList.length} submitted applicant(s)...`
                            : 'Select consultant from roster...'}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${
                          consultantMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {consultantMenuOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                        <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={consultantSearch}
                              onChange={(e) => setConsultantSearch(e.target.value)}
                              placeholder="Search submitted applicants..."
                              autoFocus
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-brand-500"
                            />
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                          {filteredList.length === 0 ? (
                            <div className="py-5 px-4 text-center text-[11px] text-slate-400">
                              {requirement
                                ? 'No unplaced submitted applicants found for this requirement.'
                                : 'No matching consultants found.'}
                            </div>
                          ) : (
                            filteredList.map(({ candidate: c, stage }) => {
                              const isSelected = c.id === formData.candidateId;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    handleSelectCandidate(c.id, c);
                                    setConsultantMenuOpen(false);
                                    setConsultantSearch('');
                                  }}
                                  className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                    isSelected ? 'bg-brand-50/70' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                      {c.fullName.charAt(0).toUpperCase()}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-slate-900 truncate">
                                        {c.fullName}
                                      </div>
                                      {c.currentTitle && (
                                        <div className="text-[10px] text-slate-500 truncate">
                                          {c.currentTitle}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                      {stage}
                                    </span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-brand-600" />}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Live Commercial Spread Banner */}
          <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Gross Profit Margin Spread</div>
              <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
                {spread >= 0 ? `+${currencySymbol}${spread.toFixed(2)}/hr` : `-${currencySymbol}${Math.abs(spread).toFixed(2)}/hr`}{' '}
                <span className="text-xs font-semibold text-emerald-600">({marginPct}%)</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Est. Monthly Gross Profit</div>
              <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
                {currencySymbol}{monthlyGrossProfit}/mo
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Placed Candidate *</label>
              <input
                type="text"
                value={formData.resourceName}
                onChange={(e) => setFormData({ ...formData, resourceName: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Client Customer *</label>
              <input
                type="text"
                value={formData.customer}
                onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Skill / Role Title</label>
              <input
                type="text"
                value={formData.skillRole}
                onChange={(e) => setFormData({ ...formData, skillRole: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Customer Contact / Approver</label>
              <input
                type="text"
                value={formData.customerContact}
                onChange={(e) => setFormData({ ...formData, customerContact: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Client Bill Rate ({currencySymbol}/hr)</label>
              <input
                type="number"
                value={formData.billRate}
                onChange={(e) => setFormData({ ...formData, billRate: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Candidate Pay Rate ({currencySymbol}/hr)</label>
              <input
                type="number"
                value={formData.payRate}
                onChange={(e) => setFormData({ ...formData, payRate: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Placement Contract Type</label>
              <CustomSelect
                value={formData.placementType}
                onChange={(val) => setFormData({ ...formData, placementType: val })}
                ariaLabel="Placement Contract Type"
                className="mt-1"
                options={['W2 Hourly', 'C2C Subcontractor', '1099', 'Full-Time']}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Deployment Model</label>
              <CustomSelect
                value={formData.deployment}
                onChange={(val) => setFormData({ ...formData, deployment: val })}
                ariaLabel="Deployment Model"
                className="mt-1"
                options={[
                  { value: 'Onshore', label: 'Onshore (US Domestic)' },
                  { value: 'Nearshore', label: 'Nearshore' },
                  { value: 'Offshore', label: 'Offshore' },
                ]}
              />
            </div>

            {formData.placementType === 'C2C Subcontractor' && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Sub-Vendor Partner</label>
                <SearchableSelectInput
                  value={formData.vendorName}
                  onChange={(val) => setFormData({ ...formData, vendorName: val })}
                  options={vendors.map((v) => ({
                    id: v.id,
                    label: v.name,
                    sublabel: v.location,
                  }))}
                  placeholder="Select or type sub-vendor..."
                  wrapperClassName="mt-1"
                  inputClassName="w-full pl-3 pr-7 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-brand-600 focus:outline-none"
                />
                {(() => {
                  const selectedVen = vendors.find(
                    (v) => v.name.trim().toLowerCase() === formData.vendorName.trim().toLowerCase()
                  );
                  const warning = getVendorComplianceWarning(selectedVen);
                  return warning ? (
                    <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{warning}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
            <div className={formData.placementType === 'C2C Subcontractor' ? '' : 'md:col-span-2'}>
              <label className="text-[10px] font-bold text-slate-500 uppercase">PO / SOW Number</label>
              <input
                type="text"
                value={formData.purchaseOrderNumber}
                onChange={(e) => setFormData({ ...formData, purchaseOrderNumber: e.target.value })}
                placeholder="e.g. PO-2026-8841"
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Contract Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Contract End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="text-[11px] text-slate-400">
            Assigned Recruiter: <span className="font-semibold text-slate-700">{formData.recruiter || 'Recruitment Desk'}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPositionsFull || isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {isPositionsFull
                  ? `All ${openPositions} Positions Filled`
                  : isSubmitting
                  ? 'Activating...'
                  : 'Confirm & Lock Placement'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
