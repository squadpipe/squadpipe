import { BillablePlacement } from '../../types';
import { StatusTone } from '../../components/shared/StatusBadge';

export interface ExtensionData {
  newEndDate: string;
  billing?: string;
  payRate?: string;
  purchaseOrderNumber?: string;
}

export type EffectivePlacementStatus =
  | 'Active'
  | 'Extended'
  | 'Expiring Soon'
  | 'Completed'
  | 'Terminated';

export const parseRate = (val: unknown, fallback = 0): number => {
  const n = parseFloat(String(val ?? '').replace(/[^0-9.]/g, ''));
  return isNaN(n) ? fallback : n;
};

export const addMonthsToDate = (dateStr: string, months: number): string => {
  const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  if (isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + months);
    return fallback.toISOString().split('T')[0];
  }
  base.setMonth(base.getMonth() + months);
  return base.toISOString().split('T')[0];
};

export const getDaysRemaining = (endDateStr: string): number | null => {
  if (!endDateStr) return null;
  const end = new Date(endDateStr + 'T00:00:00').getTime();
  if (isNaN(end)) return null;
  return Math.ceil((end - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
};

export const isExpiringSoon = (p: BillablePlacement): boolean => {
  if (p.status === 'Completed' || p.status === 'Terminated') return false;
  const diff = getDaysRemaining(p.endDate);
  return diff !== null && diff >= 0 && diff <= 30;
};

export const getEffectiveStatus = (p: BillablePlacement): EffectivePlacementStatus => {
  if (p.status === 'Completed' || p.status === 'Terminated') return p.status;
  if (isExpiringSoon(p)) return 'Expiring Soon';
  if (p.status === 'Extended') return 'Extended';
  return 'Active';
};

export const getPlacementStatusMeta = (
  p: BillablePlacement
): { label: string; tone: StatusTone } => {
  const status = getEffectiveStatus(p);
  if (status === 'Expiring Soon') return { label: 'Expiring <30d', tone: 'amber' };
  if (status === 'Extended') return { label: 'Extended', tone: 'brand' };
  if (status === 'Completed') return { label: 'Completed', tone: 'slate' };
  if (status === 'Terminated') return { label: 'Terminated', tone: 'rose' };
  return { label: 'Active', tone: 'emerald' };
};

export const formatSpread = (val: unknown, currencySymbol: string): string => {
  if (val === undefined || val === null || val === '') return '-';
  const n = Number(val);
  return isNaN(n)
    ? '-'
    : `${n >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(n).toFixed(2)}/hr`;
};

export const formatMargin = (val: unknown): string => {
  if (val === undefined || val === null || val === '') return '-';
  const n = Number(val);
  return isNaN(n) ? '-' : `${n.toFixed(1)}% margin`;
};

export const getContractTimelineMetrics = (
  startDateStr: string,
  endDateStr: string
): { totalDays: number; elapsedDays: number; progressPct: number } | null => {
  if (!startDateStr || !endDateStr) return null;
  const start = new Date(startDateStr + 'T00:00:00').getTime();
  const end = new Date(endDateStr + 'T00:00:00').getTime();
  if (isNaN(start) || isNaN(end) || end < start) return null;
  const dayMs = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.round((end - start) / dayMs));
  const today = new Date().setHours(0, 0, 0, 0);
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((today - start) / dayMs)));
  const progressPct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
  return { totalDays, elapsedDays, progressPct };
};
