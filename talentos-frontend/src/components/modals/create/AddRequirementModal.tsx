import React, { useState } from 'react';
import { Requirement, Client, User } from '../../../types';

interface AddRequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (req: Requirement) => void;
  clients: Client[];
  users?: User[];
  showToast: (title: string, message: string, icon?: string) => void;
}

export const AddRequirementModal: React.FC<AddRequirementModalProps> = ({
  isOpen,
  onClose,
  onSave,
  clients,
  users = [],
  showToast,
}) => {
  const [form, setForm] = useState({
    opportunityTitle: '',
    companyName: clients[0]?.name || '',
    clientContact: clients[0]?.contacts[0]?.name || '',
    clientContactTitle: clients[0]?.contacts[0]?.designation || '',
    location: 'Remote',
    targetRate: '$115/hr',
    skillsRequired: '',
    assignedRecruiter: 'Marcus Brody',
    status: 'Requirement' as Requirement['status'],
    remarks: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.opportunityTitle.trim() || !form.companyName.trim()) {
      showToast('Validation Error', 'Role Title and Client Company are required.', 'fa-solid fa-triangle-exclamation text-amber-500');
      return;
    }

    const nextCode = `REQ-${1040 + Math.floor(Math.random() * 50)}`;
    const billRateNum = parseInt(form.targetRate.replace(/\D/g, ''), 10) || 115;

    const newReq: Requirement = {
      id: 'req_' + Date.now(),
      code: nextCode,
      opportunityTitle: form.opportunityTitle.trim(),
      companyName: form.companyName.trim(),
      clientContact: form.clientContact.trim() || 'Primary Hiring Lead',
      clientContactTitle: form.clientContactTitle.trim() || 'Engineering Director',
      location: form.location.trim() || 'Remote',
      targetBillRate: billRateNum,
      targetPayRate: Math.round(billRateNum * 0.75),
      skillsRequired: form.skillsRequired.trim() || 'Java, Cloud, Microservices',
      assignedRecruiter: form.assignedRecruiter,
      status: form.status,
    };

    onSave(newReq);
    showToast('Requirement Created', `${newReq.code} (${newReq.opportunityTitle}) added to pipeline!`, 'fa-solid fa-circle-check text-blue-500');
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col animate-fade-in max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
              <i className="fa-solid fa-briefcase text-sm"></i>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Create New Job Requirement</span>
                <span className="text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded">
                  Client Job Order
                </span>
              </h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Intake new client requisition, bill rate, location, and required technical skills.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center text-sm transition-colors"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Opportunity / Role Title *</label>
                <input
                  value={form.opportunityTitle}
                  onChange={(e) => setForm({ ...form, opportunityTitle: e.target.value })}
                  placeholder="e.g. Lead AWS Cloud Architect"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Company *</label>
                <select
                  value={form.companyName}
                  onChange={(e) => {
                    const selClient = clients.find((c) => c.name === e.target.value);
                    setForm({
                      ...form,
                      companyName: e.target.value,
                      clientContact: selClient?.contacts[0]?.name || '',
                      clientContactTitle: selClient?.contacts[0]?.designation || '',
                    });
                  }}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Contact Person *</label>
                <input
                  value={form.clientContact}
                  onChange={(e) => setForm({ ...form, clientContact: e.target.value })}
                  placeholder="e.g. Robert Vance"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Contact Designation</label>
                <input
                  value={form.clientContactTitle}
                  onChange={(e) => setForm({ ...form, clientContactTitle: e.target.value })}
                  placeholder="e.g. VP Global Infrastructure"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Location & Mode *</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. New York, NY (Hybrid 3 Days)"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Client Bill Rate *</label>
                <input
                  value={form.targetRate}
                  onChange={(e) => setForm({ ...form, targetRate: e.target.value })}
                  placeholder="e.g. $115/hr"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-mono focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Key Required Technical Skills *</label>
              <input
                value={form.skillsRequired}
                onChange={(e) => setForm({ ...form, skillsRequired: e.target.value })}
                placeholder="e.g. AWS, Terraform, Kubernetes, Python, Helm"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-mono text-[11px] focus:border-brand-600 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Recruiter</label>
                <select
                  value={form.assignedRecruiter}
                  onChange={(e) => setForm({ ...form, assignedRecruiter: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600"
                >
                  {users.length > 0 ? (
                    users.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Marcus Brody">Marcus Brody</option>
                      <option value="Sarah Jenkins">Sarah Jenkins</option>
                      <option value="Elena Rostova">Elena Rostova</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Pipeline Stage</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Requirement['status'] })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-brand-600"
                >
                  <option value="Requirement">Requirement (New)</option>
                  <option value="Submitted">Submitted</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Job Spec Notes & Remarks</label>
              <textarea
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                rows={2}
                placeholder="e.g. Direct client requisition via master agreement. Requires immediate interview coordination."
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-xs focus:border-brand-600 focus:outline-none"
              ></textarea>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-plus text-[10px]"></i>
              <span>Create Requirement & Add to Pipeline</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

