import React, { useState } from 'react';
import { Vendor } from '../../types';

interface VendorsViewProps {
  vendors: Vendor[];
  onOpenAddVendor: () => void;
  onDeleteVendor?: (vendor: Vendor) => void;
}

export const VendorsView: React.FC<VendorsViewProps> = ({ vendors, onOpenAddVendor, onDeleteVendor }) => {
  const [search, setSearch] = useState('');

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
                {onDeleteVendor && <th className="px-4 py-3 text-right">Actions</th>}
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
                    {onDeleteVendor && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onDeleteVendor(v)}
                          title="Delete vendor"
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
