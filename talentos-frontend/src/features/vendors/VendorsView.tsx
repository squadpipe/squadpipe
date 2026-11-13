import React, { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { Vendor } from '../../types';

interface VendorsViewProps {
  vendors: Vendor[];
  onOpenAddVendor: () => void;
  onUpdateVendor?: (vendor: Vendor) => void;
  onDeleteVendor?: (vendor: Vendor) => void;
}

export const VendorsView: React.FC<VendorsViewProps> = ({
  vendors,
  onOpenAddVendor,
  onUpdateVendor,
  onDeleteVendor,
}) => {
  const [search, setSearch] = useState('');
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.skillSpecialization.toLowerCase().includes(search.toLowerCase()) ||
      v.contactName.toLowerCase().includes(search.toLowerCase()) ||
      v.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Staffing Vendors & Partners</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sub-tier staffing agencies, C2C vendors, payment terms, and MSA contract tracking.
          </p>
        </div>
        <button
          onClick={onOpenAddVendor}
          className="px-3.5 py-1.5 rounded-md bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-plus text-[10px]"></i>
          <span>Add Vendor</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="font-semibold text-xs text-slate-900">
            {filtered.length} Registered Vendors
          </span>
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staffing vendors, terms..."
              className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-md bg-white w-64 text-slate-700 outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Vendor Company</th>
                <th className="px-4 py-3">Primary Contact</th>
                <th className="px-4 py-3">Phone & Email</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Specialization</th>
                <th className="px-4 py-3">Payment Terms</th>
                <th className="px-4 py-3">Invoicing</th>
                <th className="px-4 py-3">MSA Status</th>
                {(onUpdateVendor || onDeleteVendor) && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((v) => {
                const isMsaExecuted = v.msa === 'Yes' || v.msa === 'Active';
                return (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{v.name}</td>
                    <td className="px-4 py-3 text-slate-800">{v.contactName}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {v.phone} <br />
                      {v.email}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.location}</td>
                    <td className="px-4 py-3 font-mono text-[10px]">{v.skillSpecialization}</td>
                    <td className="px-4 py-3 font-mono font-medium">{v.paymentTerms}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{v.invoicingTerms}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                          isMsaExecuted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isMsaExecuted ? 'MSA Executed' : 'Pending Review'}
                      </span>
                    </td>
                    {(onUpdateVendor || onDeleteVendor) && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {onUpdateVendor && (
                            <button
                              onClick={() => setEditingVendor({ ...v })}
                              title="Edit vendor"
                              className="p-1.5 text-slate-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteVendor && (
                            <button
                              onClick={() => onDeleteVendor(v)}
                              title="Delete vendor"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <i className="fa-solid fa-trash-can text-xs"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Vendor Modal */}
      {editingVendor && (
        <div
          onClick={() => setEditingVendor(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Vendor</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{editingVendor.name}</p>
              </div>
              <button
                onClick={() => setEditingVendor(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdateVendor) onUpdateVendor(editingVendor);
                setEditingVendor(null);
              }}
              className="p-6 space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Vendor Company *</label>
                  <input
                    type="text"
                    required
                    value={editingVendor.name}
                    onChange={(e) => setEditingVendor({ ...editingVendor, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Primary Contact *</label>
                  <input
                    type="text"
                    required
                    value={editingVendor.contactName}
                    onChange={(e) => setEditingVendor({ ...editingVendor, contactName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={editingVendor.email}
                    onChange={(e) => setEditingVendor({ ...editingVendor, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingVendor.phone}
                    onChange={(e) => setEditingVendor({ ...editingVendor, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={editingVendor.location}
                    onChange={(e) => setEditingVendor({ ...editingVendor, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Specialization</label>
                  <input
                    type="text"
                    value={editingVendor.skillSpecialization}
                    onChange={(e) => setEditingVendor({ ...editingVendor, skillSpecialization: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Payment Terms</label>
                  <select
                    value={editingVendor.paymentTerms}
                    onChange={(e) => setEditingVendor({ ...editingVendor, paymentTerms: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Invoicing</label>
                  <input
                    type="text"
                    value={editingVendor.invoicingTerms}
                    onChange={(e) => setEditingVendor({ ...editingVendor, invoicingTerms: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">MSA Status</label>
                  <select
                    value={editingVendor.msa === 'Yes' || editingVendor.msa === 'Active' ? 'Yes' : 'Pending'}
                    onChange={(e) => setEditingVendor({ ...editingVendor, msa: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Yes">MSA Executed</option>
                    <option value="Pending">Pending Review</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingVendor(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
