import React, { useState } from 'react';
import { Vendor } from '../../types';

interface VendorsViewProps {
  vendors: Vendor[];
  onOpenAddVendor: () => void;
}

export const VendorsView: React.FC<VendorsViewProps> = ({ vendors, onOpenAddVendor }) => {
  const [search, setSearch] = useState('');

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.skillSpecialization.toLowerCase().includes(search.toLowerCase()) ||
      v.contactName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 card-shadow">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staffing vendors, terms..."
            className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-64 text-slate-700"
          />
        </div>

        <button
          onClick={onOpenAddVendor}
          className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-brand-600/20 transition-all"
        >
          <i className="fa-solid fa-handshake text-xs"></i>
          <span>Add Staffing Vendor</span>
        </button>
      </div>

      {/* Vendors Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((vendor) => (
          <div
            key={vendor.id}
            className="bg-white p-5 rounded-xl border border-slate-200 card-shadow hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">{vendor.name}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">{vendor.location}</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {vendor.msa === 'Yes' ? 'Active MSA' : 'MSA Pending'}
                </span>
              </div>

              <div className="mt-3 space-y-1 text-xs text-slate-600">
                <div><strong>Contact:</strong> {vendor.contactName}</div>
                <div className="font-mono text-[11px] text-slate-500">{vendor.email}</div>
                <div className="font-mono text-[11px] text-slate-500">{vendor.phone}</div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Specialization</div>
                <div className="text-slate-800 font-medium">{vendor.skillSpecialization}</div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Payment Terms</div>
                  <div className="font-semibold text-slate-800">{vendor.paymentTerms}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Invoicing</div>
                  <div className="font-semibold text-slate-800">{vendor.invoicingTerms}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Subcontractor Tier-1</span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <i className="fa-solid fa-circle-check text-[10px]"></i>
                Verified
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
