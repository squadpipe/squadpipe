import React, { useState, useEffect } from 'react';
import {
  Building2,
  Globe,
  Clock,
  Save,
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

interface SettingsViewProps {
  activeTab?: 'general';
  onTabChange?: (tab: 'general') => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const DEFAULT_GENERAL: GeneralSettings = {
  agencyName: '',
  legalEntityName: '',
  website: '',
  supportEmail: '',
  supportPhone: '',
  headquarters: '',
  timezone: 'America/Chicago (CST/CDT)',
  dateFormat: 'MM/DD/YYYY',
  currency: 'USD ($)',
  defaultPaymentTerms: 'Net 30 Days',
  standardMonthlyHours: 160,
  maskRatesByDefault: true,
  requirePoForPlacement: false,
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  showToast,
}) => {
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL);
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);

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

  return (
    <section className="max-w-6xl mx-auto space-y-5 animate-fade-in select-none">
      {/* Standalone Page Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-4 h-4" />
            </span>
            <span>General Settings</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage agency profile, currency, localization, and billing operational defaults.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
          Loading settings...
        </div>
      ) : (
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
                  placeholder="https://your-agency.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Headquarters Location</label>
                <input
                  type="text"
                  value={general.headquarters}
                  onChange={(e) => setGeneral({ ...general, headquarters: e.target.value })}
                  placeholder="City, State / Country"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Operations Desk Email</label>
                <input
                  type="email"
                  value={general.supportEmail}
                  onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })}
                  placeholder="desk@your-agency.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Operations Phone</label>
                <input
                  type="text"
                  value={general.supportPhone}
                  onChange={(e) => setGeneral({ ...general, supportPhone: e.target.value })}
                  placeholder="+1 (555) 010-9900"
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
      )}
    </section>
  );
};

