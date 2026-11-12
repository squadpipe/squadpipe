import React, { useState } from 'react';
import { BillablePlacement } from '../../types';
import { MaskedValue } from '../../components/shared/MaskedValue';

interface BillablePlacementsViewProps {
  placements: BillablePlacement[];
  rateMasked: boolean;
  onOpenNewPlacement: () => void;
  onExtendContract: (placement: BillablePlacement) => void;
}

export const BillablePlacementsView: React.FC<BillablePlacementsViewProps> = ({
  placements,
  rateMasked,
  onOpenNewPlacement,
  onExtendContract,
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
            placeholder="Search placed consultants, clients..."
            className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-64 text-slate-700"
          />
        </div>

        <button
          onClick={onOpenNewPlacement}
          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all"
        >
          <i className="fa-solid fa-plus text-xs"></i>
          <span>New Placement SOW</span>
        </button>
      </div>

      {/* Billable Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                <th className="py-2.5 px-4">Placed Resource</th>
                <th className="py-2.5 px-4">Client Customer</th>
                <th className="py-2.5 px-4">Role & Deployment</th>
                <th className="py-2.5 px-4">Contract Dates</th>
                <th className="py-2.5 px-4">Billing Rate</th>
                <th className="py-2.5 px-4">Margin Spread</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const expiring = isExpiringSoon(p.endDate);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900">{p.resourceName}</span>
                      <div className="text-[10px] text-slate-400 font-mono">{p.phone}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {p.customer}
                      <div className="text-[10px] text-slate-400 font-normal">Recruiter: {p.recruiter}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">{p.skillRole}</span>
                      <div className="text-[10px] text-slate-400">
                        {p.deployment} {p.placementType ? `• ${p.placementType}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {p.startDate} &rarr; {p.endDate}
                      {expiring && (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                          <i className="fa-solid fa-clock"></i>
                          <span>Expiring &lt;30d</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      <MaskedValue value={p.billing} isMasked={rateMasked} />
                      {p.payRate && (
                        <div className="text-[10px] text-slate-400">
                          Pay: <MaskedValue value={p.payRate} isMasked={rateMasked} />
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-emerald-600 text-xs">
                        <MaskedValue
                          value={p.hourlySpread !== undefined ? `+$${p.hourlySpread.toFixed(2)}/hr` : '-'}
                          isMasked={rateMasked}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400">
                        <MaskedValue value={p.marginPct !== undefined ? `${p.marginPct}% margin` : '-'} isMasked={rateMasked} />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onExtendContract(p)}
                        className="px-2.5 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-semibold transition-colors"
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
    </div>
  );
};
