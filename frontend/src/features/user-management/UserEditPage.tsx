import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { User } from '../../types';
import { ActionButton } from '../../components/shared/ActionButton';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { FormField } from '../../components/shared/FormField';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { UnsavedChangesModal, useFormShortcuts } from '../../hooks/useFormShortcuts';
import { getInitials } from '../../utils/entityMappers';
import {
  formatMissingFieldsMessage,
  getMissingFieldLabels,
  INVALID_FIELD_CLASSES,
} from '../../utils/formValidation';
import {
  getUserRoleCapabilities,
  getUserStatusTone,
  mergeUserSelectOptions,
  USER_DESK_OPTIONS,
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
} from './userUtils';

interface UserEditPageProps {
  user: User | null;
  backLabel?: string;
  initialFocusSection?: 'profile' | 'access';
  onBack: () => void;
  onUpdateUser: (updated: User) => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
}

/**
 * Dedicated full-page editor (/users/:id/edit) for updating a team member's identity,
 * desk assignment, workspace role, account status, and commercial rate clearance.
 */
export const UserEditPage: React.FC<UserEditPageProps> = ({
  user,
  backLabel = 'Back to Member Details',
  initialFocusSection = 'profile',
  onBack,
  onUpdateUser,
  showToast,
}) => {
  const [form, setForm] = useState<User | null>(() => (user ? { ...user } : null));
  const [baselineSnapshot, setBaselineSnapshot] = useState(() => JSON.stringify(user || null));
  const [isSaving, setIsSaving] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const accessSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    const cloned = { ...user };
    setForm(cloned);
    setBaselineSnapshot(JSON.stringify(cloned));
    setIsSaving(false);
    setValidationAttempted(false);

    if (initialFocusSection === 'access') {
      const timer = window.setTimeout(() => {
        accessSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => window.clearTimeout(timer);
    }
  }, [user?.id, initialFocusSection]);

  const deskOptions = useMemo(
    () => mergeUserSelectOptions(USER_DESK_OPTIONS, form?.desk),
    [form?.desk]
  );

  const roleOptions = useMemo(
    () => mergeUserSelectOptions(USER_ROLE_OPTIONS, form?.role),
    [form?.role]
  );

  const currentSnapshot = useMemo(() => JSON.stringify(form), [form]);
  const isDirty = Boolean(user && form) && currentSnapshot !== baselineSnapshot;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form || isSaving) return;

    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim().toLowerCase();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    const missingFields = getMissingFieldLabels([
      { label: 'Full Name', valid: Boolean(trimmedName) },
      { label: 'Corporate Email', valid: Boolean(trimmedEmail) },
    ]);
    if (missingFields.length > 0) {
      setValidationAttempted(true);
      showToast('Validation Error', formatMissingFieldsMessage(missingFields), 'error');
      return;
    }
    if (!emailValid) {
      setValidationAttempted(true);
      showToast('Invalid Email', 'Please enter a valid corporate email address.', 'error');
      return;
    }

    setValidationAttempted(false);
    setIsSaving(true);
    try {
      await onUpdateUser({
        ...form,
        name: trimmedName,
        email: trimmedEmail,
        desk: form.desk.trim(),
      });
      setBaselineSnapshot(currentSnapshot);
      onBack();
    } catch {
      // Parent handler already surfaces API error toast
    } finally {
      setIsSaving(false);
    }
  };

  const { showLeaveModal, guardNavigation, confirmLeave, cancelLeave } = useFormShortcuts({
    isDirty,
    isSubmitting: isSaving,
    onSubmit: () => {
      void handleSubmit();
    },
  });

  if (!user || !form) {
    return (
      <section className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 py-16 text-center space-y-3 animate-fade-in">
        <p className="text-sm font-semibold text-slate-700">Team member record not found.</p>
        <button
          type="button"
          onClick={onBack}
          className="h-8 px-4 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>
      </section>
    );
  }

  const isNameInvalid = validationAttempted && !form.name.trim();
  const isEmailInvalid =
    validationAttempted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const isStatusLocked = Boolean(user.isSuperAdmin || user.isCurrentUser);
  const willSuspend = form.status === 'Suspended' && user.status !== 'Suspended';
  const inputBaseClass =
    'w-full h-9 px-3 bg-white border rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors';

  const roleCapabilities = getUserRoleCapabilities(form.role, form.rateMasked);

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-8 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={() => guardNavigation(onBack)}
        title={user.name}
        codePill="Edit Member"
        rightSlot={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => guardNavigation(onBack)}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <ActionButton
              type="button"
              onClick={() => void handleSubmit()}
              loading={isSaving}
              loadingText="Saving..."
              className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Save Changes
            </ActionButton>
          </div>
        }
      />

      <PageHeader
        title={`Edit Member · ${user.name}`}
        subtitle="Update team member identity, desk assignment, workspace role, and commercial rate clearance."
        badges={
          <span className="hidden md:inline text-[11px] text-slate-400">
            Press ⌘S to save
          </span>
        }
      />

      <form
        noValidate
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
      >
        {/* Left Main Editor */}
        <div className="lg:col-span-8 space-y-5 text-xs">
          {/* Card 1: Member Identity & Desk */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 card-shadow space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-brand-600 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Member Profile</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Core identity, login email address, and recruiting or billing desk assignment.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Full Name" htmlFor="page-edit-user-name" required>
                <input
                  id="page-edit-user-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Rachel Adams"
                  className={`${inputBaseClass} ${
                    isNameInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </FormField>

              <FormField label="Corporate Email" htmlFor="page-edit-user-email" required>
                <input
                  id="page-edit-user-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. r.adams@agency.com"
                  className={`${inputBaseClass} ${
                    isEmailInvalid
                      ? INVALID_FIELD_CLASSES
                      : 'border-slate-200 focus:border-brand-600'
                  }`}
                />
              </FormField>

              <div className="sm:col-span-2">
                <FormField label="Assigned Desk">
                  <CustomSelect
                    value={form.desk || deskOptions[0]}
                    onChange={(val) => setForm({ ...form, desk: val })}
                    ariaLabel="Assigned Desk"
                    options={deskOptions}
                  />
                </FormField>
              </div>
            </div>
          </div>

          {/* Card 2: Role, Status & Rate Access */}
          <div
            ref={accessSectionRef}
            className="bg-white rounded-xl border border-slate-200/90 p-5 card-shadow space-y-4"
          >
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Role, Status &amp; Rate Clearance
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Control operational privileges, account access state, and margin visibility.
                  </p>
                </div>
              </div>
              {user.isSuperAdmin && (
                <StatusBadge tone="amber" size="xs" label="Protected Super Admin" />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label={`Workspace Role${user.isSuperAdmin ? ' (Protected)' : ''}`}
              >
                <CustomSelect
                  value={form.role}
                  disabled={Boolean(user.isSuperAdmin)}
                  onChange={(val) => setForm({ ...form, role: val })}
                  ariaLabel="Workspace Role"
                  options={roleOptions}
                />
              </FormField>

              <FormField
                label={`Account Status${isStatusLocked ? ' (Protected)' : ''}`}
              >
                <CustomSelect
                  value={form.status}
                  disabled={isStatusLocked}
                  onChange={(val) =>
                    setForm({ ...form, status: val as User['status'] })
                  }
                  ariaLabel="Account Status"
                  options={USER_STATUS_OPTIONS}
                />
              </FormField>
            </div>

            {willSuspend && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-[11px] text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>
                  Saving this change will immediately suspend {user.name}&apos;s account and revoke
                  all active login sessions.
                </span>
              </div>
            )}

            <label className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-lg flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/60 transition-colors">
              <div className="flex items-start gap-2.5">
                {form.rateMasked ? (
                  <EyeOff className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                ) : (
                  <Eye className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold text-slate-900">Mask Billing Rates</div>
                  <div className="text-[11px] text-slate-500">
                    Hide client bill rates, hourly spreads, and margin percentages from this member
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.rateMasked}
                onChange={(e) => setForm({ ...form, rateMasked: e.target.checked })}
                className="w-4 h-4 text-brand-600 rounded border-slate-300 cursor-pointer shrink-0"
              />
            </label>
          </div>
        </div>

        {/* Right Sidebar: Live Summary & Role Preview */}
        <aside className="lg:col-span-4 space-y-5 text-xs">
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 card-shadow space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0">
                {getInitials(form.name || user.name, 'TM')}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">
                  {form.name || user.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{form.email}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-600">Account Status</span>
                <StatusBadge label={form.status} tone={getUserStatusTone(form.status)} size="xs" />
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-600">Rate Access</span>
                <span
                  className={`font-semibold ${
                    form.rateMasked ? 'text-slate-600' : 'text-emerald-700'
                  }`}
                >
                  {form.rateMasked ? 'Masked' : 'Visible'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                <span className="text-slate-600 inline-flex items-center gap-1.5 shrink-0">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>Workload</span>
                </span>
                <span className="font-semibold font-mono text-slate-900 text-right truncate">
                  {user.workload || '0 Reqs • 0 Subs • 0 Placements'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Effective Access Preview
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                {roleCapabilities.map((cap) => (
                  <li key={cap.label} className="flex items-center justify-between gap-2">
                    <span className="truncate">{cap.label}</span>
                    <span
                      className={`font-semibold shrink-0 ${
                        cap.allowed ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {cap.allowed ? 'Allowed' : 'Restricted'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {(user.isSuperAdmin || user.isCurrentUser) && (
              <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-start gap-2 text-[11px] text-amber-900">
                <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  {user.isSuperAdmin
                    ? 'Super Admin role and active status cannot be altered.'
                    : 'Your own active session cannot be suspended from the roster editor.'}
                </span>
              </div>
            )}
          </div>
        </aside>
      </form>

      <UnsavedChangesModal
        isOpen={showLeaveModal}
        onConfirmLeave={confirmLeave}
        onCancelLeave={cancelLeave}
      />
    </div>
  );
};
