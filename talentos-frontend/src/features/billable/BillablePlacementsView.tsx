import React, { useState } from 'react';
import { BillablePlacement } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';

interface BillablePlacementsViewProps {
  placements: BillablePlacement[];
  rateMasked: boolean;
  onOpenNewPlacement: () => void;
  onExtendContract: (placement: BillablePlacement) => void;
  showToast?: (title: string, message: string, icon?: string) => void;
}

export const BillablePlacementsView: React.FC<BillablePlacementsViewProps> = ({
  placements,
  rateMasked,
  onOpenNewPlacement,
  onExtendContract,
  showToast,
}) => {
  const [search, setSearch] = useState('');

  const filtered = placements.filter(
    (p) =>
      p.resourceName.toLowerCase().includes(search.toLowerCase()) ||
      p.customer.toLowerCase().includes(search.toLowerCase()) ||
      p.skillRole.toLowerCase().includes(search.toLowerCase()) ||
      p.recruiter.toLowerCase().includes(search.toLowerCase())
  );

  const isExpiringSoon = (endDateStr: string) => {
    const diff = (new Date(endDateStr).getTime() - new Date('2026-10-29').getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 30;
  };

  // Executive Financial KPI calculations
  const totalHourlySpread = placements.reduce((sum, p) => sum + (Number(p.hourlySpread) || 0), 0);
  const avgHourlySpread = placements.length && !isNaN(totalHourlySpread / placements.length)
    ? (totalHourlySpread / placements.length).toFixed(2)
    : '0.00';
  const totalMarginPct = placements.reduce((sum, p) => sum + (Number(p.marginPct) || 0), 0);
  const avgMarginPercent = placements.length && !isNaN(totalMarginPct / placements.length)
    ? (totalMarginPct / placements.length).toFixed(1)
    : '0.0';
  const totalMonthlyGrossProfit = Math.round(totalHourlySpread * 160);
  const contractsExpiringSoon = placements.filter((p) => isExpiringSoon(p.endDate)).length;

  const formatSpread = (val: any) => {
    if (val === undefined || val === null || val === '') return '-';
    const n = Number(val);
    return isNaN(n) ? '-' : `+$${n.toFixed(2)}/hr`;
  };

  const formatMargin = (val: any) => {
    if (val === undefined || val === null || val === '') return '-';
    const n = Number(val);
    return isNaN(n) ? '-' : `${n.toFixed(1)}% margin`;
  };

  const handleExport = () => {
    if (showToast) {
      showToast('Export Generated', 'Billable ledger exported to Excel workbook.', 'fa-regular fa-file-excel text-emerald-600');
    }
  };

  return (
    <section className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Active Billable Consultants</h2>
            <span className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 px-2 py-0.5 rounded">
              {placements.length} Active Placements
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time consultant client engagements, hourly margin spreads, and contract renewal sentinels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <i className="fa-regular fa-file-excel text-emerald-600"></i>
            <span>Export Ledger</span>
          </button>
          <button
            onClick={onOpenNewPlacement}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-plus text-[10px]"></i>
            <span>Add Placement</span>
          </button>
        </div>
      </div>

      {/* 4 Executive Financial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base flex-shrink-0">
            <i className="fa-solid fa-file-invoice-dollar"></i>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Billing</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{placements.length} Consultants</div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">100% On-site / Remote Active</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-base flex-shrink-0">
            <i className="fa-solid fa-chart-line"></i>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Avg. Hourly Spread</div>
            <div className="text-lg font-bold text-blue-700 font-mono">
              <MaskedValue value={`+$${avgHourlySpread}/hr`} isMasked={rateMasked} />
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              <MaskedValue value={`${avgMarginPercent}% Gross Profit Margin`} isMasked={rateMasked} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-base flex-shrink-0">
            <i className="fa-solid fa-money-bill-trend-up"></i>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Monthly Gross Profit</div>
            <div className="text-lg font-bold text-emerald-800 font-mono">
              <MaskedValue value={`$${totalMonthlyGrossProfit.toLocaleString()}/mo`} isMasked={rateMasked} />
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              <MaskedValue value={`$${Math.round(totalMonthlyGrossProfit * 12).toLocaleString()} Annual Run-Rate`} isMasked={rateMasked} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-base flex-shrink-0">
            <i className="fa-solid fa-calendar-xmark"></i>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contract Expiry Radar</div>
            <div className="text-lg font-bold text-amber-700 font-mono">{contractsExpiringSoon} Pending Renewal</div>
            <div className="text-[10px] text-amber-700 font-medium mt-0.5">Expiring within 30 days</div>
          </div>
        </div>
      </div>

      {/* Billable Ledger Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        {/* Table Filter Bar */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="font-semibold text-xs text-slate-900">
            {filtered.length} Placed Consultants
          </span>
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search placed consultants, clients..."
              className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-md bg-white w-64 text-slate-700 outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
              <tr>
                <th className="px-3.5 py-3">Vendor / Customer</th>
                <th className="px-3.5 py-3">Consultant & Role</th>
                <th className="px-3.5 py-3">Placement Model</th>
                <th className="px-3.5 py-3">Pay Rate</th>
                <th className="px-3.5 py-3">Bill Rate</th>
                <th className="px-3.5 py-3">Hourly Margin Spread</th>
                <th className="px-3.5 py-3">Contract Period</th>
                <th className="px-3.5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filtered.map((p) => {
                const expiring = isExpiringSoon(p.endDate);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Customer & Contact */}
                    <td className="px-3.5 py-3">
                      <div className="font-bold text-slate-900">{p.customer}</div>
                      <div className="text-[11px] text-slate-500 font-sans mt-0.5">{p.customerContact}</div>
                    </td>

                    {/* Consultant & Role */}
                    <td className="px-3.5 py-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{p.resourceName}</span>
                        <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {p.deployment}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans mt-0.5">{p.skillRole}</div>
                    </td>

                    {/* Placement Model */}
                    <td className="px-3.5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                          p.placementType && p.placementType.includes('W2')
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        {p.placementType || 'C2C Subcontractor'}
                      </span>
                    </td>

                    {/* Pay Rate */}
                    <td className="px-3.5 py-3 font-mono font-medium text-slate-600">
                      <MaskedValue value={p.payRate || '-'} isMasked={rateMasked} />
                    </td>

                    {/* Bill Rate */}
                    <td className="px-3.5 py-3 font-mono font-bold text-slate-900">
                      <MaskedValue value={p.billing} isMasked={rateMasked} />
                    </td>

                    {/* Hourly Margin Spread */}
                    <td className="px-3.5 py-3">
                      <div className="font-mono font-bold text-emerald-600 text-xs">
                        <MaskedValue
                          value={formatSpread(p.hourlySpread)}
                          isMasked={rateMasked}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400">
                        <MaskedValue
                          value={formatMargin(p.marginPct)}
                          isMasked={rateMasked}
                        />
                      </div>
                    </td>

                    {/* Contract Period */}
                    <td className="px-3.5 py-3 font-mono text-[11px] text-slate-600">
                      <div>
                        {p.startDate} &rarr; {p.endDate}
                      </div>
                      {expiring && (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                          <i className="fa-solid fa-clock"></i>
                          <span>Expiring &lt;30d</span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-3 text-right">
                      <button
                        onClick={() => onExtendContract(p)}
                        className="px-2.5 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        Extend SOW
                      </button>
                    </td>
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
