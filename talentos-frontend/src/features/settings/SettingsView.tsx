import React, { useState, useEffect } from 'react';
import {
  Mail,
  Server,
  ShieldCheck,
  Building2,
  Globe,
  Clock,
  Save,
  Send,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { CURRENCY_OPTIONS, setWorkspaceCurrency } from '../../utils/currency';
import { setWorkspaceBrand } from '../../utils/workspaceBrand';

interface GeneralSettings {
  agencyName: string;
  legalEntityName: string;
  website: string;
  supportEmail: string;
  supportPhone: string;
  headquarters: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  defaultPaymentTerms: string;
  standardMonthlyHours: number;
  maskRatesByDefault: boolean;
  requirePoForPlacement: boolean;
}

interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  encryption: 'STARTTLS' | 'SSL' | 'NONE';
  username: string;
  password: string;
  hasPassword?: boolean;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
}

interface EmailLogItem {
  id: string;
  recipientEmail: string;
  subject: string;
  status: string;
  errorMessage?: string;
  smtpMessageId?: string;
  sentAt?: string;
  createdAt: string;
}

interface SettingsViewProps {
  activeTab: 'general' | 'smtp';
  onTabChange: (tab: 'general' | 'smtp') => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const DEFAULT_GENERAL: GeneralSettings = {
  agencyName: 'TalentOS Staffing',
  legalEntityName: 'TalentOS Staffing Solutions LLC',
  website: 'https://talentos-agency.com',
  supportEmail: 'desk@talentos-agency.com',
  supportPhone: '+1 (800) 555-0199',
  headquarters: 'Austin, TX',
  timezone: 'America/Chicago (CST/CDT)',
  dateFormat: 'MM/DD/YYYY',
  currency: 'USD ($)',
  defaultPaymentTerms: 'Net 30 Days',
  standardMonthlyHours: 160,
  maskRatesByDefault: true,
  requirePoForPlacement: false,
};

const DEFAULT_SMTP: SmtpSettings = {
  enabled: true,
  host: '',
  port: 587,
  encryption: 'STARTTLS',
  username: '',
  password: '',
  fromName: 'TalentOS Recruitment Desk',
  fromEmail: '',
  replyToEmail: '',
};

const SMTP_PRESETS: Array<{
  label: string;
  host: string;
  port: number;
  encryption: 'STARTTLS' | 'SSL' | 'NONE';
}> = [
  { label: 'Google Workspace / Gmail', host: 'smtp.gmail.com', port: 587, encryption: 'STARTTLS' },
  { label: 'Microsoft 365 / Outlook', host: 'smtp.office365.com', port: 587, encryption: 'STARTTLS' },
  { label: 'Amazon SES', host: 'email-smtp.us-east-1.amazonaws.com', port: 587, encryption: 'STARTTLS' },
  { label: 'Custom SMTP Server', host: '', port: 587, encryption: 'STARTTLS' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeTab,
  onTabChange,
  showToast,
}) => {
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL);
  const [smtp, setSmtp] = useState<SmtpSettings>(DEFAULT_SMTP);
  const [emailLogs, setEmailLogs] = useState<EmailLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  useEffect(() => {
    let active = true;
    apiClient
      .get('/settings')
      .then((res) => {
        if (!active) return;
        const data = res.data?.data;
        if (data?.general) {
          setGeneral({ ...DEFAULT_GENERAL, ...data.general });
          setWorkspaceBrand(data.general);
          if (data.general.currency) setWorkspaceCurrency(data.general.currency);
        }
        if (data?.smtp) setSmtp({ ...DEFAULT_SMTP, ...data.smtp });
        if (Array.isArray(data?.emailLogs)) setEmailLogs(data.emailLogs);
      })
      .catch((err) => {
        console.warn('Failed to fetch settings:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const isSmtpConfigured = Boolean(
    smtp.enabled &&
      smtp.host.trim() &&
      smtp.username.trim() &&
      (smtp.password || smtp.hasPassword) &&
      smtp.fromEmail.trim()
  );

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneral(true);
    try {
      const res = await apiClient.put('/settings/general', general);
      if (res.data?.data) {
        setGeneral(res.data.data);
        setWorkspaceBrand(res.data.data);
        setWorkspaceCurrency(res.data.data.currency || general.currency);
      } else {
        setWorkspaceBrand(general);
        setWorkspaceCurrency(general.currency);
      }
      showToast('Settings Saved', 'General organization settings updated.', 'fa-solid fa-circle-check text-emerald-500');
    } catch (err: any) {
      showToast('Save Failed', err.response?.data?.message || err.message || 'Could not update general settings.', 'fa-solid fa-triangle-exclamation text-rose-500');
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !smtp.host.trim() ||
      !smtp.username.trim() ||
      (!smtp.password && !smtp.hasPassword) ||
      !smtp.fromEmail.trim()
    ) {
      showToast(
        'Missing Fields',
        'Please provide SMTP Host, Username, Password, and Sender Email Address.',
        'fa-solid fa-triangle-exclamation text-amber-500'
      );
      return;
    }
    setSavingSmtp(true);
    try {
      const res = await apiClient.put('/settings/smtp', smtp);
      if (res.data?.data) setSmtp(res.data.data);
      showToast('SMTP Saved', 'Custom SMTP configuration saved to workspace.', 'fa-solid fa-circle-check text-emerald-500');
    } catch (err: any) {
      showToast('Save Failed', err.response?.data?.message || err.message || 'Could not save SMTP configuration.', 'fa-solid fa-triangle-exclamation text-rose-500');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!testRecipient.trim()) {
      showToast('Recipient Required', 'Enter a test email address to send a test email.', 'fa-solid fa-triangle-exclamation text-amber-500');
      return;
    }
    setTestingSmtp(true);
    try {
      const res = await apiClient.post('/settings/smtp/test', {
        recipientEmail: testRecipient.trim(),
        smtp,
      });
      if (Array.isArray(res.data?.emailLogs)) {
        setEmailLogs(res.data.emailLogs);
      }
      if (res.data?.delivered) {
        showToast('Test Email Sent', res.data.message || `Test email delivered to ${testRecipient.trim()}.`, 'fa-solid fa-circle-check text-emerald-500');
      } else {
        showToast('SMTP Check Notice', res.data?.message || 'Test logged with delivery error. Verify host, port, and credentials.', 'fa-solid fa-triangle-exclamation text-amber-500');
      }
    } catch (err: any) {
      showToast('Test Failed', err.response?.data?.message || err.message || 'SMTP test failed.', 'fa-solid fa-triangle-exclamation text-rose-500');
    } finally {
      setTestingSmtp(false);
    }
  };

  const applyPreset = (preset: (typeof SMTP_PRESETS)[number]) => {
    setSmtp((prev) => ({
      ...prev,
      host: preset.host || prev.host,
      port: preset.port,
      encryption: preset.encryption,
    }));
  };

  return (
    <section className="max-w-6xl mx-auto space-y-5 animate-fade-in select-none">
      {/* Standalone Page Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
              {activeTab === 'general' ? (
                <SlidersHorizontal className="w-4 h-4" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
            </span>
            <span>{activeTab === 'general' ? 'General Settings' : 'Email Setup (SMTP)'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'general'
              ? 'Manage agency profile, currency, localization, and billing operational defaults.'
              : 'Configure your own outbound SMTP server for client submittals and interview reminders.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
          Loading settings...
        </div>
      ) : activeTab === 'general' ? (
        <form onSubmit={handleSaveGeneral} className="space-y-5">
          {/* Organization Profile */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-slate-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Organization &amp; Agency Profile</h3>
                <p className="text-[11px] text-slate-500">Company details displayed across submittals and outbound communications.</p>
              </div>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Agency Display Name</label>
                <input
                  type="text"
                  value={general.agencyName}
                  onChange={(e) => setGeneral({ ...general, agencyName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Legal Entity Name</label>
                <input
                  type="text"
                  value={general.legalEntityName}
                  onChange={(e) => setGeneral({ ...general, legalEntityName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Company Website</label>
                <input
                  type="text"
                  value={general.website}
                  onChange={(e) => setGeneral({ ...general, website: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Headquarters Location</label>
                <input
                  type="text"
                  value={general.headquarters}
                  onChange={(e) => setGeneral({ ...general, headquarters: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Operations Desk Email</label>
                <input
                  type="email"
                  value={general.supportEmail}
                  onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Operations Phone</label>
                <input
                  type="text"
                  value={general.supportPhone}
                  onChange={(e) => setGeneral({ ...general, supportPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Regional & Staffing Policies */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-slate-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Regional &amp; Formatting</h3>
                  <p className="text-[11px] text-slate-500">Default timezone, date display, and billing currency.</p>
                </div>
              </div>
              <div className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Default Timezone</label>
                  <select
                    value={general.timezone}
                    onChange={(e) => setGeneral({ ...general, timezone: e.target.value })}
                    className="w-full py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                  >
                    <option value="America/New_York (EST/EDT)">America/New_York (EST/EDT)</option>
                    <option value="America/Chicago (CST/CDT)">America/Chicago (CST/CDT)</option>
                    <option value="America/Denver (MST/MDT)">America/Denver (MST/MDT)</option>
                    <option value="America/Los_Angeles (PST/PDT)">America/Los_Angeles (PST/PDT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Date Format</label>
                    <select
                      value={general.dateFormat}
                      onChange={(e) => setGeneral({ ...general, dateFormat: e.target.value })}
                      className="w-full py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Currency</label>
                    <select
                      value={general.currency}
                      onChange={(e) => setGeneral({ ...general, currency: e.target.value })}
                      className="w-full py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                    >
                      {CURRENCY_OPTIONS.map((curr) => (
                        <option key={curr} value={curr}>
                          {curr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-slate-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Staffing &amp; Billing Policies</h3>
                  <p className="text-[11px] text-slate-500">Default contract terms, billing calculation hours, and access rules.</p>
                </div>
              </div>
              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Default Payment Terms</label>
                    <select
                      value={general.defaultPaymentTerms}
                      onChange={(e) => setGeneral({ ...general, defaultPaymentTerms: e.target.value })}
                      className="w-full py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                    >
                      <option value="Net 15 Days">Net 15 Days</option>
                      <option value="Net 30 Days">Net 30 Days</option>
                      <option value="Net 45 Days">Net 45 Days</option>
                      <option value="Net 60 Days">Net 60 Days</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Monthly Hours Basis</label>
                    <select
                      value={general.standardMonthlyHours}
                      onChange={(e) => setGeneral({ ...general, standardMonthlyHours: Number(e.target.value) })}
                      className="w-full py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                    >
                      <option value={160}>160 hrs / month</option>
                      <option value={168}>168 hrs / month</option>
                      <option value={173}>173 hrs / month</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50/70 cursor-pointer">
                    <div>
                      <div className="font-semibold text-slate-800">Mask Client Bill Rates for Recruiters</div>
                      <div className="text-[11px] text-slate-500">Hide billing margin unless explicitly granted</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={general.maskRatesByDefault}
                      onChange={(e) => setGeneral({ ...general, maskRatesByDefault: e.target.checked })}
                      className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50/70 cursor-pointer">
                    <div>
                      <div className="font-semibold text-slate-800">Require PO Number on Placements</div>
                      <div className="text-[11px] text-slate-500">Prompt for SOW / Purchase Order ID on activation</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={general.requirePoForPlacement}
                      onChange={(e) => setGeneral({ ...general, requirePoForPlacement: e.target.checked })}
                      className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingGeneral}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-lg text-xs shadow-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingGeneral ? 'Saving...' : 'Save General Settings'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          {/* Status Banner */}
          <div
            className={`rounded-xl border px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isSmtpConfigured
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {isSmtpConfigured ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold">
                  {isSmtpConfigured
                    ? `Custom SMTP Active (${smtp.host}:${smtp.port})`
                    : 'SMTP Setup Required'}
                </div>
                <div className="text-[11px] opacity-80">
                  {isSmtpConfigured
                    ? 'Outbound candidate submittals, alerts, and test emails use your configured SMTP server.'
                    : 'Enter your own SMTP server host, port, and credentials below. TalentOS never overrides this with server env variables.'}
                </div>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={smtp.enabled}
                onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })}
                className="w-4 h-4 text-brand-600 rounded cursor-pointer"
              />
              <span>Enable Outbound SMTP</span>
            </label>
          </div>

          {/* SMTP Configuration Form */}
          <form onSubmit={handleSaveSmtp} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-slate-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">SMTP Server Configuration</h3>
                  <p className="text-[11px] text-slate-500">Connect any standard SMTP relay using your own mail credentials.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {SMTP_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1.5">SMTP Server Host *</label>
                  <input
                    type="text"
                    required
                    value={smtp.host}
                    onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                    placeholder="e.g. smtp.gmail.com or smtp.office365.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Port *</label>
                    <input
                      type="number"
                      required
                      value={smtp.port}
                      onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                      placeholder="587"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Security</label>
                    <select
                      value={smtp.encryption}
                      onChange={(e) => {
                        const enc = e.target.value as 'STARTTLS' | 'SSL' | 'NONE';
                        setSmtp({
                          ...smtp,
                          encryption: enc,
                          port: enc === 'SSL' ? 465 : enc === 'STARTTLS' ? 587 : 25,
                        });
                      }}
                      className="w-full py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                    >
                      <option value="STARTTLS">STARTTLS</option>
                      <option value="SSL">SSL / TLS</option>
                      <option value="NONE">None</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">SMTP Username *</label>
                  <input
                    type="text"
                    required
                    value={smtp.username}
                    onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                    placeholder="e.g. recruiting@yourdomain.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">SMTP Password / App Password *</label>
                  <div className="relative">
                    <input
                      type={showSmtpPassword ? 'text' : 'password'}
                      required
                      value={smtp.password}
                      onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                      placeholder="Enter SMTP password or app-specific password"
                      className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600 flex items-center cursor-pointer"
                    >
                      {showSmtpPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Sender Display Name *</label>
                  <input
                    type="text"
                    required
                    value={smtp.fromName}
                    onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
                    placeholder="TalentOS Recruitment Desk"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">From Email Address *</label>
                  <input
                    type="email"
                    required
                    value={smtp.fromEmail}
                    onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
                    placeholder="desk@yourdomain.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Reply-To Email</label>
                  <input
                    type="email"
                    value={smtp.replyToEmail}
                    onChange={(e) => setSmtp({ ...smtp, replyToEmail: e.target.value })}
                    placeholder="Optional (defaults to From Email)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  Stored securely in your workspace.
                </span>
                <button
                  type="submit"
                  disabled={savingSmtp}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-lg text-xs shadow-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingSmtp ? 'Saving...' : 'Save SMTP Settings'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Test SMTP & Delivery Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Send Test Email</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Verify your SMTP host and credentials by sending a live test message.
                </p>
              </div>
              <div className="space-y-2.5 text-xs">
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="Enter recipient email (e.g. you@company.com)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp}
                  className="w-full px-4 py-2 bg-slate-900 hover:bg-black disabled:opacity-60 text-white font-semibold rounded-lg text-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{testingSmtp ? 'Sending Test Email...' : 'Test SMTP Connection'}</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Recent SMTP Delivery Logs</h3>
                <span className="text-[11px] text-slate-500">{emailLogs.length} Recent</span>
              </div>
              <div className="overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="py-2 px-4">Recipient</th>
                      <th className="py-2 px-4">Subject</th>
                      <th className="py-2 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {emailLogs.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-xs text-slate-400">
                          No emails sent yet. Send a test email to verify SMTP delivery.
                        </td>
                      </tr>
                    ) : (
                      emailLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-medium text-slate-800">{log.recipientEmail}</td>
                          <td className="py-2.5 px-4 text-slate-500 max-w-[200px] truncate">{log.subject}</td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                log.status === 'SENT'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

