import React, { useState, useEffect } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Candidate, Requirement, Client, Vendor, BillablePlacement } from '../../types';
import { formatRateDisplay, parseRateNumber, useCurrency } from '../../utils/currency';
import { CustomSelect } from './CustomSelect';
import { AnimatedModal } from './MotionPrimitives';
import { formatMissingFieldsMessage, getMissingFieldLabels } from '../../utils/formValidation';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'consultant' | 'requirement' | 'client' | 'vendor' | 'placement';
  onSaveCandidate: (candidate: Candidate) => void;
  onSaveRequirement: (req: Requirement) => void;
  onSaveClient: (client: Client) => void;
  onSaveVendor: (vendor: Vendor) => void;
  onSavePlacement: (placement: BillablePlacement) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  initialTab,
  onSaveCandidate,
  onSaveRequirement,
  onSaveClient,
  onSaveVendor,
  onSavePlacement,
  showToast,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const [activeTab, setActiveTab] = useState<'consultant' | 'requirement' | 'client' | 'vendor' | 'placement'>('consultant');

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Candidate Form
  const [conForm, setConForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    workAuth: 'US Citizen',
    education: "Master's Degree (MS/MBA)",
    currentTitle: '',
    skillset: '',
    hourlyRate: `${currencySymbol}90/hr (W2)`,
    relocation: 'Yes',
  });

  // Requirement Form
  const [reqForm, setReqForm] = useState({
    companyName: '',
    opportunityTitle: '',
    openPositions: '1',
    location: 'Remote',
    clientContact: '',
    skillsRequired: '',
    targetBillRate: 110,
    targetPayRate: 80,
  });

  // Client Form
  const [cliForm, setCliForm] = useState({
    name: '',
    website: 'https://',
    boardNumber: '',
    location: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactTitle: '',
  });

  // Vendor Form
  const [venForm, setVenForm] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    location: '',
    skillSpecialization: '',
    paymentTerms: 'Net 45',
    invoicingTerms: 'Bi-weekly',
    msa: 'Yes',
  });

  // Placement Form
  const [placeForm, setPlaceForm] = useState({
    resourceName: '',
    customer: '',
    phone: '',
    email: '',
    skillRole: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    billing: `${currencySymbol}115/hr`,
    payRate: `${currencySymbol}80/hr`,
    recruiter: '',
    deployment: 'Onshore',
  });

  useEffect(() => {
    setConForm((prev) => ({
      ...prev,
      hourlyRate: prev.hourlyRate ? formatRateDisplay(prev.hourlyRate, currencySymbol) : `${currencySymbol}90/hr (W2)`,
    }));
    setPlaceForm((prev) => ({
      ...prev,
      billing: prev.billing ? formatRateDisplay(prev.billing, currencySymbol) : `${currencySymbol}115/hr`,
      payRate: prev.payRate ? formatRateDisplay(prev.payRate, currencySymbol) : `${currencySymbol}80/hr`,
    }));
  }, [currencySymbol, isOpen]);

  const handleSave = () => {
    if (activeTab === 'consultant') {
      const missingFields = getMissingFieldLabels([
        { label: 'Full Name', valid: Boolean(conForm.fullName.trim()) },
        { label: 'Email', valid: Boolean(conForm.email.trim()) },
      ]);
      if (missingFields.length > 0) {
        showToast('Required Fields', formatMissingFieldsMessage(missingFields));
        return;
      }
      onSaveCandidate({
        id: 'con_' + Date.now(),
        ...conForm,
        resumeName: conForm.fullName ? conForm.fullName.replace(/\s+/g, '_') + '_Resume.pdf' : '',
        resumeFormat: 'PDF',
        assignedRecruiter: '',
        pipelineStage: 'Available / Bench',
      });
      showToast('Candidate Registered', `${conForm.fullName} added to bench!`, 'success');
    } else if (activeTab === 'requirement') {
      const openPosNum = Number(reqForm.openPositions);
      const missingFields = getMissingFieldLabels([
        { label: 'Company Name', valid: Boolean(reqForm.companyName.trim()) },
        { label: 'Title', valid: Boolean(reqForm.opportunityTitle.trim()) },
        { label: 'Open Positions (at least 1)', valid: Number.isInteger(openPosNum) && openPosNum >= 1 },
      ]);
      if (missingFields.length > 0) {
        showToast('Required Fields', formatMissingFieldsMessage(missingFields));
        return;
      }
      onSaveRequirement({
        id: 'req_' + Date.now(),
        code: 'REQ-' + Math.floor(1005 + Math.random() * 50),
        companyName: reqForm.companyName,
        opportunityTitle: reqForm.opportunityTitle,
        openPositions: openPosNum,
        location: reqForm.location,
        clientContact: reqForm.clientContact || '',
        skillsRequired: reqForm.skillsRequired,
        status: 'Requirement',
        assignedRecruiter: '',
        targetBillRate: reqForm.targetBillRate,
        targetPayRate: reqForm.targetPayRate,
      });
      showToast('Job Requisition Open', `${reqForm.opportunityTitle} added to pipeline!`, 'success');
    } else if (activeTab === 'client') {
      if (!cliForm.name.trim()) {
        showToast('Required Fields', 'Client Name is required.');
        return;
      }
      onSaveClient({
        id: 'cl_' + Date.now(),
        name: cliForm.name,
        website: cliForm.website,
        boardNumber: cliForm.boardNumber,
        location: cliForm.location,
        contacts: [
          {
            name: cliForm.contactName || '',
            designation: cliForm.contactTitle || '',
            email: cliForm.contactEmail,
            phone: cliForm.contactPhone,
            isPrimary: true,
          },
        ],
      });
      showToast('Client Account Added', `${cliForm.name} registered to client directory!`, 'success');
    } else if (activeTab === 'vendor') {
      if (!venForm.name.trim()) {
        showToast('Required Fields', 'Vendor Name is required.');
        return;
      }
      onSaveVendor({
        id: 'ven_' + Date.now(),
        ...venForm,
      });
      showToast('Staffing Vendor Added', `${venForm.name} registered!`, 'success');
    } else if (activeTab === 'placement') {
      const missingFields = getMissingFieldLabels([
        { label: 'Resource Name', valid: Boolean(placeForm.resourceName.trim()) },
        { label: 'Customer', valid: Boolean(placeForm.customer.trim()) },
      ]);
      if (missingFields.length > 0) {
        showToast('Required Fields', formatMissingFieldsMessage(missingFields));
        return;
      }
      const billNum = parseRateNumber(placeForm.billing, 0);
      const payNum = parseRateNumber(placeForm.payRate, 0);
      const spread = billNum > payNum ? billNum - payNum : 0;
      const margin = billNum > 0 ? (spread / billNum) * 100 : 0;

      onSavePlacement({
        id: 'bill_' + Date.now(),
        ...placeForm,
        hourlySpread: spread,
        marginPct: Math.round(margin * 10) / 10,
      });
      showToast('Placement Activated', `${placeForm.resourceName} placed at ${placeForm.customer}!`, 'success');
    }
    onClose();
  };

  return (
    <AnimatedModal
      isOpen={isOpen}
      onBackdropClick={onClose}
      zIndexClass="z-50"
      backdropClassName="bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
      panelClassName="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      ariaLabel="Universal Quick Add"
    >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
              <Plus className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Universal Quick Add</h3>
              <p className="text-[11px] text-slate-400">Instantly provision records across CRM modules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 flex gap-1 border-b border-slate-100 bg-white">
          {(['consultant', 'requirement', 'client', 'vendor', 'placement'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-semibold border-b-2 capitalize transition-all ${
                activeTab === tab
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'consultant' && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Full Name *</label>
                <input
                  type="text"
                  value={conForm.fullName}
                  onChange={(e) => setConForm({ ...conForm, fullName: e.target.value })}
                  placeholder="Full Name"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Email *</label>
                <input
                  type="email"
                  value={conForm.email}
                  onChange={(e) => setConForm({ ...conForm, email: e.target.value })}
                  placeholder="email@example.com"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Phone</label>
                <input
                  type="text"
                  value={conForm.phone}
                  onChange={(e) => setConForm({ ...conForm, phone: e.target.value })}
                  placeholder="+1 (XXX) XXX-XXXX"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Current Job Title</label>
                <input
                  type="text"
                  value={conForm.currentTitle}
                  onChange={(e) => setConForm({ ...conForm, currentTitle: e.target.value })}
                  placeholder="Senior AWS / DevOps Engineer"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Work Authorization</label>
                <CustomSelect
                  value={conForm.workAuth}
                  onChange={(val) => setConForm({ ...conForm, workAuth: val })}
                  ariaLabel="Work Authorization"
                  className="mt-1"
                  options={['US Citizen', 'Green Card', 'H-1B', 'TN Visa', 'OPT / CPT EAD']}
                />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Core Skills (Comma-separated)</label>
                <input
                  type="text"
                  value={conForm.skillset}
                  onChange={(e) => setConForm({ ...conForm, skillset: e.target.value })}
                  placeholder="AWS, Kubernetes, Terraform, Docker, Python"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
            </div>
          )}

          {activeTab === 'requirement' && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Company Name *</label>
                <input
                  type="text"
                  value={reqForm.companyName}
                  onChange={(e) => setReqForm({ ...reqForm, companyName: e.target.value })}
                  placeholder="Pfizer, Capital One, Delta"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Opportunity Title *</label>
                <input
                  type="text"
                  value={reqForm.opportunityTitle}
                  onChange={(e) => setReqForm({ ...reqForm, opportunityTitle: e.target.value })}
                  placeholder="Principal Data Engineer"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">No. of Open Positions *</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={reqForm.openPositions}
                  onChange={(e) => setReqForm({ ...reqForm, openPositions: e.target.value })}
                  placeholder="e.g. 2"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Required Skillset</label>
                <input
                  type="text"
                  value={reqForm.skillsRequired}
                  onChange={(e) => setReqForm({ ...reqForm, skillsRequired: e.target.value })}
                  placeholder="Snowflake, PySpark, Databricks, dbt"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Client Contact</label>
                <input
                  type="text"
                  value={reqForm.clientContact}
                  onChange={(e) => setReqForm({ ...reqForm, clientContact: e.target.value })}
                  placeholder="Hiring Manager Name"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Location</label>
                <input
                  type="text"
                  value={reqForm.location}
                  onChange={(e) => setReqForm({ ...reqForm, location: e.target.value })}
                  placeholder="New York, NY (Hybrid)"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
            </div>
          )}

          {activeTab === 'client' && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Client Name *</label>
                <input
                  type="text"
                  value={cliForm.name}
                  onChange={(e) => setCliForm({ ...cliForm, name: e.target.value })}
                  placeholder="e.g. JPMorgan Chase"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Website</label>
                <input
                  type="text"
                  value={cliForm.website}
                  onChange={(e) => setCliForm({ ...cliForm, website: e.target.value })}
                  placeholder="https://client.com"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Corporate Location</label>
                <input
                  type="text"
                  value={cliForm.location}
                  onChange={(e) => setCliForm({ ...cliForm, location: e.target.value })}
                  placeholder="New York, NY"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Primary Contact</label>
                <input
                  type="text"
                  value={cliForm.contactName}
                  onChange={(e) => setCliForm({ ...cliForm, contactName: e.target.value })}
                  placeholder="Hiring Lead Name"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
            </div>
          )}

          {activeTab === 'vendor' && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Vendor Agency Name *</label>
                <input
                  type="text"
                  value={venForm.name}
                  onChange={(e) => setVenForm({ ...venForm, name: e.target.value })}
                  placeholder="e.g. Apex Talent Solutions"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Contact Person</label>
                <input
                  type="text"
                  value={venForm.contactName}
                  onChange={(e) => setVenForm({ ...venForm, contactName: e.target.value })}
                  placeholder="Contact Name"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Payment Terms</label>
                <CustomSelect
                  value={venForm.paymentTerms}
                  onChange={(val) => setVenForm({ ...venForm, paymentTerms: val })}
                  ariaLabel="Payment Terms"
                  className="mt-1"
                  options={[
                    { value: 'Net 30', label: 'Net 30 Days' },
                    { value: 'Net 45', label: 'Net 45 Days' },
                    { value: 'Net 60', label: 'Net 60 Days' },
                  ]}
                />
              </div>
            </div>
          )}

          {activeTab === 'placement' && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Placed Candidate *</label>
                <input
                  type="text"
                  value={placeForm.resourceName}
                  onChange={(e) => setPlaceForm({ ...placeForm, resourceName: e.target.value })}
                  placeholder="Candidate Name"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Customer Client *</label>
                <input
                  type="text"
                  value={placeForm.customer}
                  onChange={(e) => setPlaceForm({ ...placeForm, customer: e.target.value })}
                  placeholder="Client Name"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Role / Job Title</label>
                <input
                  type="text"
                  value={placeForm.skillRole}
                  onChange={(e) => setPlaceForm({ ...placeForm, skillRole: e.target.value })}
                  placeholder="e.g. Senior Data Engineer"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Deployment</label>
                <CustomSelect
                  value={placeForm.deployment}
                  onChange={(val) => setPlaceForm({ ...placeForm, deployment: val })}
                  ariaLabel="Deployment"
                  className="mt-1"
                  options={['Onshore', 'Nearshore', 'Offshore']}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Contact Phone</label>
                <input
                  type="text"
                  value={placeForm.phone}
                  onChange={(e) => setPlaceForm({ ...placeForm, phone: e.target.value })}
                  placeholder="+1 (XXX) XXX-XXXX"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Contact Email</label>
                <input
                  type="email"
                  value={placeForm.email}
                  onChange={(e) => setPlaceForm({ ...placeForm, email: e.target.value })}
                  placeholder="candidate@company.com"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Billing Rate</label>
                <input
                  type="text"
                  value={placeForm.billing}
                  onChange={(e) => setPlaceForm({ ...placeForm, billing: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Pay Rate</label>
                <input
                  type="text"
                  value={placeForm.payRate}
                  onChange={(e) => setPlaceForm({ ...placeForm, payRate: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Save Record</span>
          </button>
        </div>
    </AnimatedModal>
  );
};
