import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarPlus, CalendarX, X } from 'lucide-react';
import { BillablePlacement } from '../../types';
import { ActionButton } from '../../components/shared/ActionButton';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { DynamicCustomFieldsSection } from '../../components/shared/DynamicCustomFieldsSection';
import { useCurrency } from '../../utils/currency';
import { addMonthsToDate, ExtensionData, parseRate } from './placementUtils';

interface PlacementModalsProps {
  extendingPlacement: BillablePlacement | null;
  onCloseExtend: () => void;
  onExtendContract?: (placement: BillablePlacement, extensionData: ExtensionData) => Promise<void> | void;

  editingPlacement: BillablePlacement | null;
  onCloseEdit: () => void;
  onUpdatePlacement?: (placement: BillablePlacement) => Promise<void> | void;

  endingPlacement: BillablePlacement | null;
  onCloseEnd: () => void;

  deletingPlacement: BillablePlacement | null;
  onCloseDelete: () => void;
  onDeletePlacement?: (placement: BillablePlacement) => Promise<void> | void;
  onAfterDelete?: (placement: BillablePlacement) => void;
}

export const PlacementModals: React.FC<PlacementModalsProps> = ({
  extendingPlacement,
  onCloseExtend,
  onExtendContract,
  editingPlacement,
  onCloseEdit,
  onUpdatePlacement,
  endingPlacement,
  onCloseEnd,
  deletingPlacement,
  onCloseDelete,
  onDeletePlacement,
  onAfterDelete,
}) => {
  const { symbol: currencySymbol } = useCurrency();

  const [extendForm, setExtendForm] = useState<ExtensionData>({
    newEndDate: '',
    billing: '',
    payRate: '',
    purchaseOrderNumber: '',
  });
  const [editDraft, setEditDraft] = useState<BillablePlacement | null>(null);
  const [endForm, setEndForm] = useState<{ status: 'Completed' | 'Terminated'; endDate: string }>({
    status: 'Completed',
    endDate: new Date().toISOString().split('T')[0],
  });

  const [isExtending, setIsExtending] = useState(false);
  const [isSavingPlacement, setIsSavingPlacement] = useState(false);
  const [isEndingPlacement, setIsEndingPlacement] = useState(false);
  const [isDeletingPlacement, setIsDeletingPlacement] = useState(false);

  useEffect(() => {
    if (extendingPlacement) {
      setExtendForm({
        newEndDate: addMonthsToDate(extendingPlacement.endDate, 12),
        billing: extendingPlacement.billing || '',
        payRate: extendingPlacement.payRate || '',
        purchaseOrderNumber: extendingPlacement.purchaseOrderNumber || '',
      });
    }
  }, [extendingPlacement]);

  useEffect(() => {
    setEditDraft(editingPlacement ? { ...editingPlacement } : null);
  }, [editingPlacement]);

  useEffect(() => {
    if (endingPlacement) {
      const alreadyEnded =
        endingPlacement.status === 'Completed' || endingPlacement.status === 'Terminated';
      setEndForm({
        status: endingPlacement.status === 'Terminated' ? 'Terminated' : 'Completed',
        endDate:
          alreadyEnded && endingPlacement.endDate
            ? endingPlacement.endDate
            : new Date().toISOString().split('T')[0],
      });
    }
  }, [endingPlacement]);

  const extBill = parseRate(extendForm.billing, 0);
  const extPay = parseRate(extendForm.payRate, 0);
  const extSpread = extBill - extPay;
  const extMargin = extBill > 0 ? ((extSpread / extBill) * 100).toFixed(1) : '0.0';

  const editBill = editDraft ? parseRate(editDraft.billing, 0) : 0;
  const editPay = editDraft ? parseRate(editDraft.payRate, 0) : 0;
  const editSpread = editBill - editPay;
  const editMargin = editBill > 0 ? ((editSpread / editBill) * 100).toFixed(1) : '0.0';

  const handleConfirmEndPlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endingPlacement || !onUpdatePlacement || isEndingPlacement) return;
    setIsEndingPlacement(true);
    try {
      await onUpdatePlacement({
        ...endingPlacement,
        status: endForm.status,
        endDate: endForm.endDate || endingPlacement.endDate,
      });
      onCloseEnd();
    } catch {
      // Error toast is already displayed by parent handler; keep modal open
    } finally {
      setIsEndingPlacement(false);
    }
  };

  return (
    <>
      {/* Interactive Extend SOW Modal */}
      {extendingPlacement && (
        <div
          onClick={() => !isExtending && onCloseExtend()}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 flex items-center justify-center">
                  <CalendarPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Extend Contract / SOW</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {extendingPlacement.resourceName} @ {extendingPlacement.customer}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isExtending}
                onClick={onCloseExtend}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (isExtending || !onExtendContract) return;
                setIsExtending(true);
                try {
                  await onExtendContract(extendingPlacement, extendForm);
                  onCloseExtend();
                } catch {
                  // Error toast is already displayed by parent handler; keep modal open
                } finally {
                  setIsExtending(false);
                }
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700 text-[11px]">Quick Extension Presets</label>
                  <span className="text-[10px] text-slate-400">Current End: {extendingPlacement.endDate}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '+3 Months', months: 3 },
                    { label: '+6 Months', months: 6 },
                    { label: '+1 Year', months: 12 },
                  ].map((preset) => {
                    const targetDate = addMonthsToDate(extendingPlacement.endDate, preset.months);
                    const active = extendForm.newEndDate === targetDate;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setExtendForm((prev) => ({ ...prev, newEndDate: targetDate }))}
                        className={`py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-brand-50'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">New End Date *</label>
                <input
                  type="date"
                  required
                  value={extendForm.newEndDate}
                  onChange={(e) => setExtendForm({ ...extendForm, newEndDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-800">Revised Spread Preview</span>
                <span className="font-bold text-emerald-700">
                  {extSpread >= 0
                    ? `+${currencySymbol}${extSpread.toFixed(2)}/hr`
                    : `-${currencySymbol}${Math.abs(extSpread).toFixed(2)}/hr`}{' '}
                  ({extMargin}%)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client Bill Rate</label>
                  <input
                    type="text"
                    value={extendForm.billing || ''}
                    onChange={(e) => setExtendForm({ ...extendForm, billing: e.target.value })}
                    placeholder={`${currencySymbol}115/hr`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Consultant Pay Rate</label>
                  <input
                    type="text"
                    value={extendForm.payRate || ''}
                    onChange={(e) => setExtendForm({ ...extendForm, payRate: e.target.value })}
                    placeholder={`${currencySymbol}85/hr`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">PO / SOW Reference</label>
                <input
                  type="text"
                  value={extendForm.purchaseOrderNumber || ''}
                  onChange={(e) => setExtendForm({ ...extendForm, purchaseOrderNumber: e.target.value })}
                  placeholder="e.g. PO-2026-9901"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isExtending}
                  onClick={onCloseExtend}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  loading={isExtending}
                  loadingText="Extending..."
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Confirm SOW Extension
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Placement Modal */}
      {editDraft && (
        <div
          onClick={() => !isSavingPlacement && onCloseEdit()}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up max-h-[92vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Billable Placement</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{editDraft.resourceName}</p>
              </div>
              <button
                type="button"
                disabled={isSavingPlacement}
                onClick={onCloseEdit}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (isSavingPlacement) return;
                setIsSavingPlacement(true);
                try {
                  if (onUpdatePlacement) await onUpdatePlacement(editDraft);
                  onCloseEdit();
                } catch {
                  // Error toast is already displayed by parent handler; keep modal open
                } finally {
                  setIsSavingPlacement(false);
                }
              }}
              className="p-6 space-y-3.5 text-xs overflow-y-auto"
            >
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-800">Hourly Margin Spread</span>
                <span className="font-bold text-emerald-700">
                  {editSpread >= 0
                    ? `+${currencySymbol}${editSpread.toFixed(2)}/hr`
                    : `-${currencySymbol}${Math.abs(editSpread).toFixed(2)}/hr`}{' '}
                  ({editMargin}%)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Consultant Name *</label>
                  <input
                    type="text"
                    required
                    value={editDraft.resourceName}
                    onChange={(e) => setEditDraft({ ...editDraft, resourceName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Skill / Role *</label>
                  <input
                    type="text"
                    required
                    value={editDraft.skillRole}
                    onChange={(e) => setEditDraft({ ...editDraft, skillRole: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client / Customer *</label>
                  <input
                    type="text"
                    required
                    value={editDraft.customer}
                    onChange={(e) => setEditDraft({ ...editDraft, customer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client Contact</label>
                  <input
                    type="text"
                    value={editDraft.customerContact || ''}
                    onChange={(e) => setEditDraft({ ...editDraft, customerContact: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Status</label>
                  <CustomSelect
                    value={editDraft.status || 'Active'}
                    onChange={(val) =>
                      setEditDraft({ ...editDraft, status: val as BillablePlacement['status'] })
                    }
                    ariaLabel="Placement Status"
                    options={['Active', 'Extended', 'Completed', 'Terminated']}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Deployment</label>
                  <CustomSelect
                    value={editDraft.deployment}
                    onChange={(val) => setEditDraft({ ...editDraft, deployment: val })}
                    ariaLabel="Deployment"
                    options={['Onshore', 'Nearshore', 'Offshore']}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Placement Model</label>
                  <CustomSelect
                    value={editDraft.placementType || 'C2C Subcontractor'}
                    onChange={(val) => setEditDraft({ ...editDraft, placementType: val })}
                    ariaLabel="Placement Model"
                    options={['C2C Subcontractor', 'W2 Hourly', '1099', 'Full-Time']}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Pay Rate</label>
                  <input
                    type="text"
                    value={editDraft.payRate || ''}
                    onChange={(e) => setEditDraft({ ...editDraft, payRate: e.target.value })}
                    placeholder={`${currencySymbol}85/hr`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bill Rate</label>
                  <input
                    type="text"
                    value={editDraft.billing}
                    onChange={(e) => setEditDraft({ ...editDraft, billing: e.target.value })}
                    placeholder={`${currencySymbol}115/hr`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">PO / SOW #</label>
                  <input
                    type="text"
                    value={editDraft.purchaseOrderNumber || ''}
                    onChange={(e) => setEditDraft({ ...editDraft, purchaseOrderNumber: e.target.value })}
                    placeholder="PO-2026-01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editDraft.startDate}
                    onChange={(e) => setEditDraft({ ...editDraft, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={editDraft.endDate}
                    onChange={(e) => setEditDraft({ ...editDraft, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editDraft.phone || ''}
                    onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Work Email</label>
                  <input
                    type="email"
                    value={editDraft.email || ''}
                    onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <DynamicCustomFieldsSection
                entity="placement"
                values={(editDraft.customFields as Record<string, string>) || {}}
                onChange={(vals) => setEditDraft({ ...editDraft, customFields: vals })}
                isOpen={Boolean(editDraft)}
              />

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingPlacement}
                  onClick={onCloseEdit}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  loading={isSavingPlacement}
                  loadingText="Saving..."
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Placement Confirmation Modal */}
      {deletingPlacement && (
        <div
          onClick={() => !isDeletingPlacement && onCloseDelete()}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Remove Billable Placement?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  This will remove <span className="font-semibold text-slate-700">{deletingPlacement.resourceName}</span>&apos;s placement at{' '}
                  <span className="font-semibold text-slate-700">{deletingPlacement.customer}</span> from the ledger.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingPlacement}
                onClick={onCloseDelete}
                className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                Cancel
              </button>
              <ActionButton
                type="button"
                loading={isDeletingPlacement}
                loadingText="Removing..."
                onClick={async () => {
                  if (isDeletingPlacement) return;
                  setIsDeletingPlacement(true);
                  const target = deletingPlacement;
                  try {
                    if (onDeletePlacement) await onDeletePlacement(target);
                    onCloseDelete();
                    onAfterDelete?.(target);
                  } catch {
                    onCloseDelete();
                  } finally {
                    setIsDeletingPlacement(false);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Remove Placement
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* End Consultant Placement Modal */}
      {endingPlacement && (
        <div
          onClick={() => !isEndingPlacement && onCloseEnd()}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleConfirmEndPlacement}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center">
                  <CalendarX className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">End Consultant Placement</h3>
                  <p className="text-[11px] text-slate-500">
                    {endingPlacement.resourceName} &bull; {endingPlacement.customer}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isEndingPlacement}
                onClick={onCloseEnd}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Closure Outcome
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['Completed', 'Terminated'] as const).map((outcome) => {
                    const selected = endForm.status === outcome;
                    return (
                      <button
                        key={outcome}
                        type="button"
                        onClick={() => setEndForm((prev) => ({ ...prev, status: outcome }))}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          selected
                            ? outcome === 'Terminated'
                              ? 'border-rose-500 bg-rose-50/40 ring-1 ring-rose-500'
                              : 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900">{outcome}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {outcome === 'Completed' ? 'SOW term fulfilled naturally' : 'Early exit or client offboard'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Effective End Date
                </label>
                <input
                  type="date"
                  required
                  value={endForm.endDate}
                  onChange={(e) => setEndForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-[11px] text-slate-600 space-y-1.5">
                <div className="font-semibold text-slate-800">What happens next</div>
                <ul className="space-y-1 list-disc list-inside text-slate-500">
                  <li>
                    Moves placement to the <span className="font-semibold text-slate-700">Ended</span> tab while preserving billing &amp; margin history.
                  </li>
                  <li>
                    Returns <span className="font-semibold text-slate-700">{endingPlacement.resourceName}</span> to{' '}
                    <span className="font-semibold text-slate-700">Available / Bench</span> if no other active SOW exists.
                  </li>
                  <li>Resolves open contract expiry reminders for this placement.</li>
                </ul>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isEndingPlacement}
                onClick={onCloseEnd}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                Cancel
              </button>
              <ActionButton
                type="submit"
                loading={isEndingPlacement}
                loadingText="Updating..."
                disabled={!endForm.endDate}
                icon={<CalendarX className="w-3.5 h-3.5" />}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Confirm End Placement
              </ActionButton>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
