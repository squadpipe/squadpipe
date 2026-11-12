import React, { useState, useEffect } from 'react';
import { BillablePlacement, Requirement, Candidate } from '../../types';

interface PlacementWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate?: Candidate | null;
  requirement?: Requirement | null;
  onConfirmPlacement: (placement: BillablePlacement, reqId?: string) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const PlacementWizardModal: React.FC<PlacementWizardModalProps> = ({
  isOpen,
  onClose,
  candidate,
  requirement,
  onConfirmPlacement,
  showToast,
}) => {
  const getContactStr = (c: any) => (typeof c === 'object' && c !== null ? c.fullName || c.name || '' : String(c || ''));
  const getRecruiterStr = (r: any) => (typeof r === 'object' && r !== null ? r.fullName || r.name || '' : String(r || ''));

  const [formData, setFormData] = useState({
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
    recruiter: getRecruiterStr(requirement?.assignedRecruiter || candidate?.assignedRecruiter),
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
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
        recruiter: getRecruiterStr(requirement?.assignedRecruiter || candidate?.assignedRecruiter),
      });
    }
  }, [isOpen, candidate, requirement]);

  if (!isOpen) return null;

  const bill = Number(formData.billRate) || 0;
  const pay = Number(formData.payRate) || 0;
  const spread = bill - pay;
  const marginPct = bill > 0 ? ((spread / bill) * 100).toFixed(1) : '0.0';
  const monthlyGrossProfit = (spread * 160).toLocaleString();

  const handleConfirm = () => {
    if (!formData.resourceName.trim()) {
      showToast('Validation Error', 'Please enter candidate resource name.', 'fa-solid fa-triangle-exclamation text-amber-500');
      return;
    }

    const newPlacement: BillablePlacement = {
      id: 'bill_' + Date.now(),
      recruiter: formData.recruiter,
      deployment: formData.deployment,
      customer: formData.customer,
      customerContact: formData.customerContact,
      resourceName: formData.resourceName,
      phone: formData.phone,
      email: formData.email,
      skillRole: formData.skillRole,
      startDate: formData.startDate,
      endDate: formData.endDate,
      billing: `$${bill}/hr`,
      payRate: `$${pay}/hr`,
      placementType: formData.placementType,
      hourlySpread: spread,
      marginPct: parseFloat(marginPct),
    };

    onConfirmPlacement(newPlacement, requirement?.id);
    onClose();
    showToast(
      'Placement Activated!',
      `${newPlacement.resourceName} placed at ${newPlacement.customer} (+$${spread.toFixed(2)}/hr spread)!`,
      'fa-solid fa-circle-check text-emerald-400'
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 card-shadow overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <i className="fa-solid fa-file-invoice-dollar text-sm"></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Placement Activation & Margin Lock Wizard</h3>
              <p className="text-[11px] text-slate-400">Formalize commercial billing terms, calculate margin spread, and register SOW</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Live Commercial Spread Banner */}
          <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Gross Profit Margin Spread</div>
              <div className="text-xl font-extrabold text-emerald-700 font-mono mt-0.5">
                +${spread.toFixed(2)}/hr <span className="text-xs font-semibold text-emerald-600">({marginPct}%)</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Est. Monthly Gross Profit</div>
              <div className="text-xl font-extrabold text-emerald-700 font-mono mt-0.5">
                ${monthlyGrossProfit}/mo
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Placed Candidate</label>
              <input
                type="text"
                value={formData.resourceName}
                onChange={(e) => setFormData({ ...formData, resourceName: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Client Customer</label>
              <input
                type="text"
                value={formData.customer}
                onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Client Bill Rate ($/hr)</label>
              <input
                type="number"
                value={formData.billRate}
                onChange={(e) => setFormData({ ...formData, billRate: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Candidate Pay Rate ($/hr)</label>
              <input
                type="number"
                value={formData.payRate}
                onChange={(e) => setFormData({ ...formData, payRate: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono text-slate-800 font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Placement Contract Type</label>
              <select
                value={formData.placementType}
                onChange={(e) => setFormData({ ...formData, placementType: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="W2 Hourly">W2 Hourly</option>
                <option value="C2C Subcontractor">C2C Subcontractor</option>
                <option value="1099 Independent">1099 Independent</option>
                <option value="Full-Time Permanent">Full-Time Permanent</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Deployment Model</label>
              <select
                value={formData.deployment}
                onChange={(e) => setFormData({ ...formData, deployment: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="Onshore">Onshore (US Domestic)</option>
                <option value="Nearshore">Nearshore</option>
                <option value="Offshore">Offshore</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Contract Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Contract End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="text-[11px] text-slate-400">
            Assigned Recruiter: <span className="font-semibold text-slate-700">{formData.recruiter}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
            >
              <i className="fa-solid fa-lock text-xs"></i>
              <span>Confirm & Lock Placement</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
