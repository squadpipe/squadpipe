import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Zap,
  Trash2,
  FileDown,
  RefreshCw,
  DollarSign,
  LogOut,
  ShieldCheck,
  Bell,
  Briefcase,
  CalendarCheck,
  FileText,
  FileSpreadsheet,
  KeyRound,
  Mail,
  Settings,
  Activity,
} from 'lucide-react';

interface AppIconProps {
  icon?: string;
  className?: string;
}

/**
 * Renders crisp lucide-react SVG icons for dynamic/string icon keys (including legacy fa-* strings).
 */
export const AppIcon: React.FC<AppIconProps> = ({ icon = '', className = 'w-4 h-4' }) => {
  const raw = String(icon || '');
  const colorMatch = raw.match(/\btext-[a-z0-9-]+\b/g);
  const colorClass = colorMatch ? colorMatch.join(' ') : '';
  const mergedClass = `${className} ${colorClass}`.trim();

  if (raw.includes('exclamation') && raw.includes('triangle')) {
    return <AlertTriangle className={mergedClass} />;
  }
  if (raw.includes('exclamation')) {
    return <AlertCircle className={mergedClass} />;
  }
  if (raw.includes('circle-info') || raw.includes('info')) {
    return <Info className={mergedClass} />;
  }
  if (raw.includes('trash')) {
    return <Trash2 className={mergedClass} />;
  }
  if (raw.includes('bolt') || raw.includes('zap')) {
    return <Zap className={mergedClass} />;
  }
  if (raw.includes('file-arrow-down') || raw.includes('download')) {
    return <FileDown className={mergedClass} />;
  }
  if (raw.includes('rotate') || raw.includes('spin')) {
    return <RefreshCw className={mergedClass} />;
  }
  if (raw.includes('excel') || raw.includes('csv')) {
    return <FileSpreadsheet className={mergedClass} />;
  }
  if (raw.includes('key')) {
    return <KeyRound className={mergedClass} />;
  }
  if (raw.includes('gear') || raw.includes('cog')) {
    return <Settings className={mergedClass} />;
  }
  if (raw.includes('dollar') || raw.includes('invoice')) {
    return <DollarSign className={mergedClass} />;
  }
  if (raw.includes('right-from-bracket') || raw.includes('logout')) {
    return <LogOut className={mergedClass} />;
  }
  if (raw.includes('user-shield') || raw.includes('shield')) {
    return <ShieldCheck className={mergedClass} />;
  }
  if (raw.includes('bell')) {
    return <Bell className={mergedClass} />;
  }
  if (raw.includes('briefcase')) {
    return <Briefcase className={mergedClass} />;
  }
  if (raw.includes('calendar')) {
    return <CalendarCheck className={mergedClass} />;
  }
  if (raw.includes('envelope') || raw.includes('mail')) {
    return <Mail className={mergedClass} />;
  }
  if (raw.includes('file')) {
    return <FileText className={mergedClass} />;
  }
  if (raw.includes('activity') || raw.includes('gear')) {
    return <Activity className={mergedClass} />;
  }

  return <CheckCircle2 className={mergedClass} />;
};
