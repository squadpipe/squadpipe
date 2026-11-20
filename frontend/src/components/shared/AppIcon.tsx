import React from 'react';
import type { Icon as PhosphorIcon, IconWeight } from '@phosphor-icons/react';
import {
  Bell,
  Briefcase,
  CalendarCheck,
  ArrowsClockwise,
  CheckCircle,
  Copy,
  CurrencyDollar,
  DownloadSimple,
  Envelope,
  FileText,
  FileXls,
  Gear,
  HourglassHigh,
  Info,
  Key,
  Lightning,
  PaperPlaneTilt,
  Pulse,
  ShieldCheck,
  SignOut,
  Star,
  Trash,
  Warning,
  WarningCircle,
} from '@phosphor-icons/react';

export type AppIconKey =
  | 'success'
  | 'success-brand'
  | 'error'
  | 'warning'
  | 'info'
  | 'info-muted'
  | 'delete'
  | 'download'
  | 'refresh'
  | 'csv'
  | 'excel'
  | 'invoice'
  | 'shield'
  | 'shield-warn'
  | 'star'
  | 'send'
  | 'key'
  | 'hourglass'
  | 'copy'
  | 'file-check'
  | 'settings'
  | 'logout'
  | 'bolt'
  | 'bell'
  | 'briefcase'
  | 'calendar'
  | 'mail'
  | 'file'
  | 'activity';

interface AppIconProps {
  icon?: AppIconKey | (string & {});
  className?: string;
}

const SEMANTIC_ICON_MAP: Record<
  AppIconKey,
  {
    Component: PhosphorIcon;
    colorClass: string;
    weight?: IconWeight;
  }
> = {
  success: { Component: CheckCircle, colorClass: 'text-emerald-500', weight: 'duotone' },
  'success-brand': { Component: CheckCircle, colorClass: 'text-brand-600', weight: 'duotone' },
  error: { Component: WarningCircle, colorClass: 'text-rose-500', weight: 'duotone' },
  warning: { Component: Warning, colorClass: 'text-amber-500', weight: 'duotone' },
  info: { Component: Info, colorClass: 'text-brand-600', weight: 'duotone' },
  'info-muted': { Component: Info, colorClass: 'text-slate-500', weight: 'regular' },
  delete: { Component: Trash, colorClass: 'text-slate-500', weight: 'regular' },
  download: { Component: DownloadSimple, colorClass: 'text-emerald-600', weight: 'regular' },
  refresh: { Component: ArrowsClockwise, colorClass: 'text-brand-600', weight: 'regular' },
  csv: { Component: FileXls, colorClass: 'text-emerald-600', weight: 'duotone' },
  excel: { Component: FileXls, colorClass: 'text-emerald-600', weight: 'duotone' },
  invoice: { Component: CurrencyDollar, colorClass: 'text-emerald-500', weight: 'duotone' },
  shield: { Component: ShieldCheck, colorClass: 'text-brand-600', weight: 'duotone' },
  'shield-warn': { Component: ShieldCheck, colorClass: 'text-amber-500', weight: 'duotone' },
  star: { Component: Star, colorClass: 'text-emerald-500', weight: 'duotone' },
  send: { Component: PaperPlaneTilt, colorClass: 'text-brand-600', weight: 'duotone' },
  key: { Component: Key, colorClass: 'text-brand-600', weight: 'regular' },
  hourglass: { Component: HourglassHigh, colorClass: 'text-amber-500', weight: 'duotone' },
  copy: { Component: Copy, colorClass: 'text-brand-600', weight: 'regular' },
  'file-check': { Component: FileText, colorClass: 'text-brand-600', weight: 'duotone' },
  settings: { Component: Gear, colorClass: 'text-slate-600', weight: 'regular' },
  logout: { Component: SignOut, colorClass: 'text-slate-700', weight: 'regular' },
  bolt: { Component: Lightning, colorClass: 'text-amber-500', weight: 'duotone' },
  bell: { Component: Bell, colorClass: 'text-amber-500', weight: 'duotone' },
  briefcase: { Component: Briefcase, colorClass: 'text-brand-600', weight: 'duotone' },
  calendar: { Component: CalendarCheck, colorClass: 'text-brand-600', weight: 'duotone' },
  mail: { Component: Envelope, colorClass: 'text-brand-600', weight: 'duotone' },
  file: { Component: FileText, colorClass: 'text-slate-600', weight: 'regular' },
  activity: { Component: Pulse, colorClass: 'text-brand-600', weight: 'regular' },
};

/**
 * Renders crisp Phosphor SVG icons for typed semantic icon keys (plus safe fallback for stored API icon strings).
 */
export const AppIcon: React.FC<AppIconProps> = ({ icon = 'success', className = 'w-4 h-4' }) => {
  const raw = String(icon || 'success');

  if (raw in SEMANTIC_ICON_MAP) {
    const entry = SEMANTIC_ICON_MAP[raw as AppIconKey];
    const Icon = entry.Component;
    return <Icon className={`${className} ${entry.colorClass}`.trim()} weight={entry.weight} />;
  }

  // Fallback for legacy persisted backend strings (e.g., automation rule icon columns)
  const colorMatch = raw.match(/\btext-[a-z0-9-]+\b/g);
  const colorClass = colorMatch ? colorMatch.join(' ') : '';
  const mergedClass = `${className} ${colorClass}`.trim();

  if (raw.includes('exclamation') && raw.includes('triangle')) {
    return <Warning className={mergedClass} weight="duotone" />;
  }
  if (raw.includes('exclamation')) {
    return <WarningCircle className={mergedClass} weight="duotone" />;
  }
  if (raw.includes('info')) return <Info className={mergedClass} weight="duotone" />;
  if (raw.includes('trash')) return <Trash className={mergedClass} />;
  if (raw.includes('bolt') || raw.includes('zap')) {
    return <Lightning className={mergedClass} weight="duotone" />;
  }
  if (raw.includes('download')) return <DownloadSimple className={mergedClass} />;
  if (raw.includes('rotate') || raw.includes('spin')) return <ArrowsClockwise className={mergedClass} />;
  if (raw.includes('excel') || raw.includes('csv')) {
    return <FileXls className={mergedClass} weight="duotone" />;
  }
  if (raw.includes('key')) return <Key className={mergedClass} />;
  if (raw.includes('gear') || raw.includes('cog')) return <Gear className={mergedClass} />;
  if (raw.includes('dollar') || raw.includes('invoice')) {
    return <CurrencyDollar className={mergedClass} />;
  }
  if (raw.includes('logout')) return <SignOut className={mergedClass} />;
  if (raw.includes('shield')) return <ShieldCheck className={mergedClass} weight="duotone" />;
  if (raw.includes('bell')) return <Bell className={mergedClass} weight="duotone" />;
  if (raw.includes('briefcase')) return <Briefcase className={mergedClass} />;
  if (raw.includes('calendar')) return <CalendarCheck className={mergedClass} />;
  if (raw.includes('envelope') || raw.includes('mail')) return <Envelope className={mergedClass} />;
  if (raw.includes('file')) return <FileText className={mergedClass} />;
  if (raw.includes('activity')) return <Pulse className={mergedClass} />;

  return <CheckCircle className={mergedClass} weight="duotone" />;
};
