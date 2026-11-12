import React, { useState, useEffect } from 'react';
import { Candidate, Requirement, Client, Vendor, BillablePlacement } from '../../types';

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
    hourlyRate: '$90/hr (W2)',
    relocation: 'Yes',
  });

  // Requirement Form
  const [reqForm, setReqForm] = useState({
    companyName: '',
    opportunityTitle: '',
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
    billing: '$115/hr',
    payRate: '$80/hr',
    recruiter: '',
    deployment: 'Onshore',
  });

  if (!isOpen) return null;

  const handleSave = () => {
    if (activeTab === 'consultant') {
      if (!conForm.fullName || !conForm.email) {
        showToast('Required Fields', 'Full Name and Email are required.');
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
      showToast('Candidate Registered', `${conForm.fullName} added to bench!`, 'fa-solid fa-circle-check text-emerald-400');
    } else if (activeTab === 'requirement') {
      if (!reqForm.companyName || !reqForm.opportunityTitle) {
        showToast('Required Fields', 'Company Name and Title are required.');
        return;
      }
      onSaveRequirement({
        id: 'req_' + Date.now(),
        code: 'REQ-' + Math.floor(1005 + Math.random() * 50),
        companyName: reqForm.companyName,
        opportunityTitle: reqForm.opportunityTitle,
        location: reqForm.location,
        clientContact: reqForm.clientContact || '',
        skillsRequired: reqForm.skillsRequired,
        status: 'Requirement',
        assignedRecruiter: '',
        targetBillRate: reqForm.targetBillRate,
        targetPayRate: reqForm.targetPayRate,
      });
      showToast('Job Requisition Open', `${reqForm.opportunityTitle} added to pipeline!`, 'fa-solid fa-circle-check text-emerald-400');
    } else if (activeTab === 'client') {
      if (!cliForm.name) {
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
      showToast('Client Account Added', `${cliForm.name} registered to client directory!`, 'fa-solid fa-circle-check text-emerald-400');
    } else if (activeTab === 'vendor') {
      if (!venForm.name) {
        showToast('Required Fields', 'Vendor Name is required.');
        return;
      }
      onSaveVendor({
        id: 'ven_' + Date.now(),
        ...venForm,
      });
      showToast('Staffing Vendor Added', `${venForm.name} registered!`, 'fa-solid fa-circle-check text-emerald-400');
    } else if (activeTab === 'placement') {
      if (!placeForm.resourceName || !placeForm.customer) {
        showToast('Required Fields', 'Resource Name and Customer are required.');
        return;
      }
      const billNum = parseFloat(placeForm.billing.replace(/[^0-9.]/g, '')) || 0;
      const payNum = parseFloat(placeForm.payRate.replace(/[^0-9.]/g, '')) || 0;
      const spread = billNum > payNum ? billNum - payNum : 0;
      const margin = billNum > 0 ? (spread / billNum) * 100 : 0;

      onSavePlacement({
        id: 'bill_' + Date.now(),
        ...placeForm,
        hourlySpread: spread,
        marginPct: Math.round(margin * 10) / 10,
      });
      showToast('Placement Activated', `${placeForm.resourceName} placed at ${placeForm.customer}!`, 'fa-solid fa-circle-check text-emerald-400');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 card-shadow overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
              <i className="fa-solid fa-plus text-xs"></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Universal Quick Add</h3>
              <p className="text-[11px] text-slate-400">Instantly provision records across CRM modules</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <i className="fa-solid fa-xmark text-sm"></i>
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
                <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name *</label>
                <input
                  type="text"
                  value={conForm.fullName}
                  onChange={(e) => setConForm({ ...conForm, fullName: e.target.value })}
                  placeholder="Full Name"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Email *</label>
                <input
                  type="email"
                  value={conForm.email}
                  onChange={(e) => setConForm({ ...conForm, email: e.target.value })}
                  placeholder="email@example.com"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                <input
                  type="text"
                  value={conForm.phone}
                  onChange={(e) => setConForm({ ...conForm, phone: e.target.value })}
                  placeholder="+1 (XXX) XXX-XXXX"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Current Job Title</label>
                <input
                  type="text"
                  value={conForm.currentTitle}
                  onChange={(e) => setConForm({ ...conForm, currentTitle: e.target.value })}
                  placeholder="Senior AWS / DevOps Engineer"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Work Authorization</label>
                <select
                  value={conForm.workAuth}
                  onChange={(e) => setConForm({ ...conForm, workAuth: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="US Citizen">US Citizen</option>
                  <option value="Green Card">Green Card</option>
                  <option value="H-1B">H-1B</option>
                  <option value="TN Visa">TN Visa</option>
                  <option value="OPT / CPT EAD">OPT / CPT EAD</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Core Skills (Comma-separated)</label>
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
                <label className="text-[10px] font-bold text-slate-500 uppercase">Company Name *</label>
                <input
                  type="text"
                  value={reqForm.companyName}
                  onChange={(e) => setReqForm({ ...reqForm, companyName: e.target.value })}
                  placeholder="Pfizer, Capital One, Delta"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Opportunity Title *</label>
                <input
                  type="text"
                  value={reqForm.opportunityTitle}
                  onChange={(e) => setReqForm({ ...reqForm, opportunityTitle: e.target.value })}
                  placeholder="Principal Data Engineer"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Required Skillset</label>
                <input
                  type="text"
                  value={reqForm.skillsRequired}
                  onChange={(e) => setReqForm({ ...reqForm, skillsRequired: e.target.value })}
                  placeholder="Snowflake, PySpark, Databricks, dbt"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Client Contact</label>
                <input
                  type="text"
                  value={reqForm.clientContact}
                  onChange={(e) => setReqForm({ ...reqForm, clientContact: e.target.value })}
                  placeholder="Hiring Manager Name"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Location</label>
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
                <label className="text-[10px] font-bold text-slate-500 uppercase">Client Name *</label>
                <input
                  type="text"
                  value={cliForm.name}
                  onChange={(e) => setCliForm({ ...cliForm, name: e.target.value })}
                  placeholder="e.g. JPMorgan Chase"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Website</label>
                <input
                  type="text"
                  value={cliForm.website}
                  onChange={(e) => setCliForm({ ...cliForm, website: e.target.value })}
                  placeholder="https://client.com"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Corporate Location</label>
                <input
                  type="text"
                  value={cliForm.location}
                  onChange={(e) => setCliForm({ ...cliForm, location: e.target.value })}
                  placeholder="New York, NY"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Primary Contact</label>
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
                <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor Agency Name *</label>
                <input
                  type="text"
                  value={venForm.name}
                  onChange={(e) => setVenForm({ ...venForm, name: e.target.value })}
                  placeholder="e.g. Apex Talent Solutions"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Contact Person</label>
                <input
                  type="text"
                  value={venForm.contactName}
                  onChange={(e) => setVenForm({ ...venForm, contactName: e.target.value })}
                  placeholder="Contact Name"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Terms</label>
                <select
                  value={venForm.paymentTerms}
                  onChange={(e) => setVenForm({ ...venForm, paymentTerms: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="Net 30">Net 30 Days</option>
                  <option value="Net 45">Net 45 Days</option>
                  <option value="Net 60">Net 60 Days</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'placement' && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Placed Candidate *</label>
                <input
                  type="text"
                  value={placeForm.resourceName}
                  onChange={(e) => setPlaceForm({ ...placeForm, resourceName: e.target.value })}
                  placeholder="Candidate Name"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Customer Client *</label>
                <input
                  type="text"
                  value={placeForm.customer}
                  onChange={(e) => setPlaceForm({ ...placeForm, customer: e.target.value })}
                  placeholder="Client Name"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Role / Job Title</label>
                <input
                  type="text"
                  value={placeForm.skillRole}
                  onChange={(e) => setPlaceForm({ ...placeForm, skillRole: e.target.value })}
                  placeholder="e.g. Senior Data Engineer"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Deployment</label>
                <select
                  value={placeForm.deployment}
                  onChange={(e) => setPlaceForm({ ...placeForm, deployment: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="Onshore">Onshore</option>
                  <option value="Nearshore">Nearshore</option>
                  <option value="Offshore">Offshore</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Contact Phone</label>
                <input
                  type="text"
                  value={placeForm.phone}
                  onChange={(e) => setPlaceForm({ ...placeForm, phone: e.target.value })}
                  placeholder="+1 (XXX) XXX-XXXX"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Contact Email</label>
                <input
                  type="email"
                  value={placeForm.email}
                  onChange={(e) => setPlaceForm({ ...placeForm, email: e.target.value })}
                  placeholder="candidate@company.com"
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Billing Rate</label>
                <input
                  type="text"
                  value={placeForm.billing}
                  onChange={(e) => setPlaceForm({ ...placeForm, billing: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Pay Rate</label>
                <input
                  type="text"
                  value={placeForm.payRate}
                  onChange={(e) => setPlaceForm({ ...placeForm, payRate: e.target.value })}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
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
            className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm shadow-brand-600/20 flex items-center gap-1.5 transition-all"
          >
            <i className="fa-solid fa-check text-xs"></i>
            <span>Save Record</span>
          </button>
        </div>
      </div>
    </div>
  );
};
