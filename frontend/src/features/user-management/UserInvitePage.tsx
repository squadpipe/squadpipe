import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  Minus,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { User } from '../../types';
import { ActionButton } from '../../components/shared/ActionButton';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { DetailBreadcrumb } from '../../components/shared/DetailPageShell';
import { FormField } from '../../components/shared/FormField';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { UnsavedChangesModal, useFormShortcuts } from '../../hooks/useFormShortcuts';
import { mapUserFromApi } from '../../utils/entityMappers';
import { INVALID_FIELD_CLASSES } from '../../utils/formValidation';
import {
  getDefaultRateMaskForRole,
  getRolePermissionGuide,
  getUserRoleCapabilities,
  USER_DESK_OPTIONS,
  USER_ROLE_SELECT_OPTIONS,
} from './userUtils';

interface InviteDraftRow {
  localId: string;
  name: string;
  email: string;
  role: string;
  desk: string;
  rateMasked: boolean;
  rateManuallySet: boolean;
}

interface UserInvitePageProps {
  existingUsers?: User[];
  backLabel?: string;
  onBack: () => void;
  onMembersInvited: (createdUsers: User[]) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SHORT_CAPABILITY_LABELS: Record<string, string> = {
  'Pipeline, Submissions & Pitching': 'Jobs, candidates & pitches',
  'Bulk Imports & Record Management': 'Bulk imports & delete records',
  'Commercial Bill & Pay Rates': 'View client bill & pay rates',
  'Workspace Admin & Team Permissions': 'Team & workspace settings',
};

function createInviteRow(defaults?: Partial<{
  role: string;
  desk: string;
  rateMasked: boolean;
  name: string;
  email: string;
}>): InviteDraftRow {
  const role = defaults?.role || 'Technical Recruiter';
  return {
    localId: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: defaults?.name || '',
    email: defaults?.email || '',
    role,
    desk: defaults?.desk || 'US IT Contract (C2C & W2)',
    rateMasked: defaults?.rateMasked ?? getDefaultRateMaskForRole(role),
    rateManuallySet: false,
  };
}

function inferNameFromEmail(email: string): string {
  const local = email.split('@')[0] || '';
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Effortless multi-user invitation workflow (/users/invite):
 * Progressive-disclosure single-card invite builder paired with a clean live permission preview.
 */
export const UserInvitePage: React.FC<UserInvitePageProps> = ({
  existingUsers = [],
  backLabel = 'Team Members',
  onBack,
  onMembersInvited,
  showToast,
}) => {
  const [rows, setRows] = useState<InviteDraftRow[]>(() => [createInviteRow()]);
  const [activeRowId, setActiveRowId] = useState<string>(() => rows[0]?.localId || '');

  // Collapsible bulk-paste panel state
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [pasteRole, setPasteRole] = useState<string>('Technical Recruiter');
  const [pasteDesk, setPasteDesk] = useState<string>('US IT Contract (C2C & W2)');

  const [validationAttempted, setValidationAttempted] = useState(false);
  const [rowServerErrors, setRowServerErrors] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);

  const existingEmailSet = useMemo(
    () => new Set(existingUsers.map((u) => u.email.trim().toLowerCase())),
    [existingUsers]
  );

  const duplicateBatchEmailSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const em = r.email.trim().toLowerCase();
      if (em) counts.set(em, (counts.get(em) || 0) + 1);
    }
    const dups = new Set<string>();
    counts.forEach((count, email) => {
      if (count > 1) dups.add(email);
    });
    return dups;
  }, [rows]);

  const activeRowIndex = Math.max(
    0,
    rows.findIndex((r) => r.localId === activeRowId)
  );
  const activeRow = rows[activeRowIndex] || rows[0];
  const roleGuide = getRolePermissionGuide(activeRow?.role);
  const roleCapabilities = getUserRoleCapabilities(
    activeRow?.role || 'Technical Recruiter',
    activeRow?.rateMasked ?? true
  );

  const readyCount = useMemo(
    () =>
      rows.filter((r) => {
        const em = r.email.trim().toLowerCase();
        return (
          Boolean(r.name.trim()) &&
          EMAIL_PATTERN.test(em) &&
          !existingEmailSet.has(em) &&
          !duplicateBatchEmailSet.has(em)
        );
      }).length,
    [rows, existingEmailSet, duplicateBatchEmailSet]
  );

  const isDirty = rows.some((r) => Boolean(r.name.trim() || r.email.trim()));

  const updateRow = (localId: string, updater: (prev: InviteDraftRow) => InviteDraftRow) => {
    setRows((prev) => prev.map((r) => (r.localId === localId ? updater(r) : r)));
    setRowServerErrors((prev) => {
      if (!prev[localId]) return prev;
      const next = { ...prev };
      delete next[localId];
      return next;
    });
  };

  const handleRoleChange = (rowId: string, nextRole: string) => {
    setActiveRowId(rowId);
    updateRow(rowId, (prev) => ({
      ...prev,
      role: nextRole,
      rateMasked: prev.rateManuallySet ? prev.rateMasked : getDefaultRateMaskForRole(nextRole),
    }));
  };

  const handleAddRow = () => {
    // Inherit the last row's role & desk so multi-invites feel effortless without extra configuration cards.
    const last = rows[rows.length - 1];
    const nextRow = createInviteRow({
      role: last?.role || 'Technical Recruiter',
      desk: last?.desk || 'US IT Contract (C2C & W2)',
      rateMasked: last?.rateMasked ?? getDefaultRateMaskForRole(last?.role),
    });
    setRows((prev) => [...prev, nextRow]);
    setActiveRowId(nextRow.localId);
  };

  const handleDuplicateRow = (source: InviteDraftRow) => {
    const cloned = createInviteRow({
      role: source.role,
      desk: source.desk,
      rateMasked: source.rateMasked,
    });
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.localId === source.localId);
      if (idx === -1) return [...prev, cloned];
      const copy = [...prev];
      copy.splice(idx + 1, 0, cloned);
      return copy;
    });
    setActiveRowId(cloned.localId);
  };

  const handleApplyFirstToAll = () => {
    const first = rows[0];
    if (!first || rows.length <= 1) return;
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        role: first.role,
        desk: first.desk,
        rateMasked: first.rateMasked,
      }))
    );
    showToast(
      'Applied to All',
      `Updated all ${rows.length} invites to ${first.role} · ${first.desk}.`,
      'success'
    );
  };

  const handleRemoveRow = (localId: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => {
      const remaining = prev.filter((r) => r.localId !== localId);
      if (activeRowId === localId && remaining[0]) {
        setActiveRowId(remaining[0].localId);
      }
      return remaining;
    });
  };

  const handleBulkPasteEmails = () => {
    const tokens = pasteInput
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length === 0) return;

    const extracted: InviteDraftRow[] = [];
    const seen = new Set(rows.map((r) => r.email.trim().toLowerCase()).filter(Boolean));

    for (const token of tokens) {
      const angleMatch = token.match(/^([^<]+)<([^>]+)>$/);
      const rawEmail = (angleMatch ? angleMatch[2] : token).trim().toLowerCase();
      if (!EMAIL_PATTERN.test(rawEmail) || seen.has(rawEmail)) continue;
      seen.add(rawEmail);
      const rawName = angleMatch ? angleMatch[1].trim() : inferNameFromEmail(rawEmail);
      extracted.push(
        createInviteRow({
          name: rawName,
          email: rawEmail,
          role: pasteRole,
          desk: pasteDesk,
          rateMasked: getDefaultRateMaskForRole(pasteRole),
        })
      );
    }

    if (extracted.length === 0) {
      showToast(
        'No Valid Emails Found',
        'Paste unique email addresses separated by commas or new lines.',
        'warning'
      );
      return;
    }

    setRows((prev) => {
      const nonEmpty = prev.filter((r) => r.name.trim() || r.email.trim());
      return [...nonEmpty, ...extracted];
    });
    setActiveRowId(extracted[0].localId);
    setPasteInput('');
    setShowBulkPaste(false);
    showToast(
      'Added to Invite List',
      `${extracted.length} ${extracted.length === 1 ? 'person' : 'people'} added below.`,
      'success'
    );
  };

  const validateRows = (): string | null => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      const emailNorm = r.email.trim().toLowerCase();
      if (!r.name.trim()) return `Person #${rowNum}: Full name is required.`;
      if (!emailNorm) return `Person #${rowNum}: Email address is required.`;
      if (!EMAIL_PATTERN.test(emailNorm)) {
        return `Person #${rowNum}: "${r.email}" is not a valid email address.`;
      }
      if (existingEmailSet.has(emailNorm)) {
        return `Person #${rowNum}: "${emailNorm}" is already in this workspace.`;
      }
      if (duplicateBatchEmailSet.has(emailNorm)) {
        return `Person #${rowNum}: "${emailNorm}" is listed more than once.`;
      }
    }
    return null;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSending) return;

    const validationError = validateRows();
    if (validationError) {
      setValidationAttempted(true);
      showToast('Check Details', validationError, 'error');
      return;
    }

    setValidationAttempted(false);
    setRowServerErrors({});
    setIsSending(true);

    try {
      const payloadMembers = rows.map((r) => ({
        name: r.name.trim(),
        email: r.email.trim().toLowerCase(),
        role: r.role,
        desk: r.desk,
        rateMasked: r.rateMasked,
      }));

      const res = await apiClient.post('/users/invite/batch', {
        members: payloadMembers,
      });

      const batchData = res.data?.data;
      const results: Array<{
        index: number;
        email: string;
        ok: boolean;
        user?: any;
        error?: string;
      }> = Array.isArray(batchData?.results) ? batchData.results : [];

      const currentUserEmail = existingUsers.find((u) => u.isCurrentUser)?.email;
      const createdUsers: User[] = results
        .filter((item) => item.ok && item.user)
        .map((item) => mapUserFromApi(item.user, currentUserEmail));

      if (createdUsers.length > 0) {
        onMembersInvited(createdUsers);
      }

      const failedEntries = results.filter((item) => !item.ok);
      if (failedEntries.length > 0) {
        const failedRows: InviteDraftRow[] = [];
        const errMap: Record<string, string> = {};
        for (const failed of failedEntries) {
          const origRow = rows[failed.index];
          if (origRow) {
            failedRows.push(origRow);
            errMap[origRow.localId] = failed.error || 'Could not invite member';
          }
        }
        if (failedRows.length > 0) {
          setRows(failedRows);
          setRowServerErrors(errMap);
        }
        showToast(
          createdUsers.length > 0 ? 'Some Invites Need Review' : 'Invitation Failed',
          createdUsers.length > 0
            ? `Sent ${createdUsers.length} invite(s); ${failedEntries.length} row(s) need attention.`
            : failedEntries[0]?.error || 'No invitations could be sent.',
          createdUsers.length > 0 ? 'warning' : 'error'
        );
        return;
      }

      showToast(
        createdUsers.length === 1 ? 'Invitation Sent' : 'Invitations Sent',
        createdUsers.length === 1
          ? `Invitation sent to ${createdUsers[0].email}.`
          : `Sent workspace invitations to ${createdUsers.length} teammates.`,
        'success'
      );
      onBack();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Could not send workspace invitations. Please review the form.';
      showToast('Invitation Failed', msg, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const { showLeaveModal, guardNavigation, confirmLeave, cancelLeave } = useFormShortcuts({
    isDirty,
    isSubmitting: isSending,
    onSubmit: () => {
      void handleSubmit();
    },
  });

  const inputBaseClass =
    'w-full h-9 px-3 bg-white border rounded-lg text-xs text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:outline-none transition-colors';

  const sendButtonLabel =
    rows.length > 1 ? `Send ${rows.length} Invitations` : 'Send Invitation';

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 space-y-5 pb-10 animate-fade-in">
      <DetailBreadcrumb
        backLabel={backLabel}
        onBack={() => guardNavigation(onBack)}
        title="Invite Team Members"
        codePill={`${rows.length} ${rows.length === 1 ? 'Person' : 'People'}`}
      />

      <PageHeader
        title="Invite Team Members"
        subtitle="Add teammates below, pick their role and desk, and send workspace invites in one click."
        badges={
          <span className="hidden md:inline text-[11px] text-slate-400">
            ⌘S to send
          </span>
        }
        actions={
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSending}
              onClick={() => guardNavigation(onBack)}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center justify-center whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <ActionButton
              type="button"
              onClick={() => void handleSubmit()}
              loading={isSending}
              loadingText="Sending..."
              icon={<Send className="w-3.5 h-3.5" />}
              className="h-8 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              {sendButtonLabel}
            </ActionButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Main Workspace: Unified Single Invite Builder Card */}
        <form
          noValidate
          onSubmit={handleSubmit}
          className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 card-shadow overflow-hidden text-xs"
        >
          {/* Card Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-50/80 border border-brand-200/70 text-brand-700 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Who would you like to invite?
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Permissions adjust automatically per role. Select any row to preview exact access.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBulkPaste((prev) => !prev)}
              className={`h-8 px-3 rounded-lg border text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                showBulkPaste
                  ? 'border-brand-600 bg-brand-50/70 text-brand-700'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>{showBulkPaste ? 'Close Bulk Paste' : 'Bulk Paste Emails'}</span>
            </button>
          </div>

          {/* Optional Collapsible Bulk Paste Drawer */}
          {showBulkPaste && (
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Quickly add multiple teammates
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Paste email addresses or &quot;Full Name &lt;email@company.com&gt;&quot; separated by commas or new lines.
                  </div>
                </div>
              </div>

              <textarea
                rows={3}
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder={'Rachel Adams <rachel@company.com>, john.lee@company.com\npriya.nair@company.com'}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Assign Role to Pasted Emails">
                  <CustomSelect
                    value={pasteRole}
                    size="sm"
                    onChange={setPasteRole}
                    ariaLabel="Role for pasted emails"
                    options={USER_ROLE_SELECT_OPTIONS}
                  />
                </FormField>
                <FormField label="Assign Desk to Pasted Emails">
                  <CustomSelect
                    value={pasteDesk}
                    size="sm"
                    onChange={setPasteDesk}
                    ariaLabel="Desk for pasted emails"
                    options={[...USER_DESK_OPTIONS]}
                  />
                </FormField>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPasteInput('');
                    setShowBulkPaste(false);
                  }}
                  className="h-7 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkPasteEmails}
                  className="h-7 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Invite List</span>
                </button>
              </div>
            </div>
          )}

          {/* Clean Member Rows */}
          <div className="divide-y divide-slate-100">
            {rows.map((row, index) => {
              const emailNorm = row.email.trim().toLowerCase();
              const isNameInvalid = validationAttempted && !row.name.trim();
              const isEmailFormatInvalid =
                validationAttempted && (!emailNorm || !EMAIL_PATTERN.test(emailNorm));
              const isAlreadyRegistered = Boolean(emailNorm && existingEmailSet.has(emailNorm));
              const isDuplicateInBatch = Boolean(
                emailNorm && duplicateBatchEmailSet.has(emailNorm)
              );
              const serverErr = rowServerErrors[row.localId];
              const isEmailInvalid =
                isEmailFormatInvalid || isAlreadyRegistered || isDuplicateInBatch || Boolean(serverErr);
              const isFocused = activeRow?.localId === row.localId;

              return (
                <div
                  key={row.localId}
                  onFocus={() => setActiveRowId(row.localId)}
                  onClick={() => setActiveRowId(row.localId)}
                  className={`p-5 sm:px-6 transition-colors space-y-3.5 ${
                    isFocused && rows.length > 1
                      ? 'bg-brand-50/20 border-l-2 border-l-brand-600'
                      : 'hover:bg-slate-50/40'
                  }`}
                >
                  {/* Row Header Strip */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold font-mono shrink-0 ${
                          isFocused
                            ? 'bg-brand-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="font-semibold text-slate-800 truncate">
                        {row.name.trim() || `New Member #${index + 1}`}
                      </span>
                      {row.email.trim() && (
                        <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                          {row.email.trim()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateRow(row);
                        }}
                        title="Add another person with the same role & desk"
                        className="p-1.5 rounded-md text-slate-400 hover:text-brand-700 hover:bg-brand-50/60 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRow(row.localId);
                          }}
                          title="Remove from invite list"
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row 1: Identity */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <FormField
                      label="Full Name"
                      htmlFor={`invite-name-${row.localId}`}
                      required
                      error={isNameInvalid ? 'Required' : undefined}
                    >
                      <input
                        id={`invite-name-${row.localId}`}
                        type="text"
                        required
                        placeholder="e.g. Rachel Adams"
                        value={row.name}
                        onChange={(e) =>
                          updateRow(row.localId, (prev) => ({ ...prev, name: e.target.value }))
                        }
                        className={`${inputBaseClass} ${
                          isNameInvalid
                            ? INVALID_FIELD_CLASSES
                            : 'border-slate-200 focus:border-brand-600'
                        }`}
                      />
                    </FormField>

                    <FormField
                      label="Work Email"
                      htmlFor={`invite-email-${row.localId}`}
                      required
                      error={
                        serverErr ||
                        (isAlreadyRegistered
                          ? 'Already a member'
                          : isDuplicateInBatch
                            ? 'Duplicate email'
                            : isEmailFormatInvalid
                              ? 'Enter valid email'
                              : undefined)
                      }
                    >
                      <input
                        id={`invite-email-${row.localId}`}
                        type="email"
                        required
                        placeholder="e.g. r.adams@company.com"
                        value={row.email}
                        onChange={(e) =>
                          updateRow(row.localId, (prev) => ({ ...prev, email: e.target.value }))
                        }
                        className={`${inputBaseClass} ${
                          isEmailInvalid
                            ? INVALID_FIELD_CLASSES
                            : 'border-slate-200 focus:border-brand-600'
                        }`}
                      />
                    </FormField>
                  </div>

                  {/* Row 2: Role, Desk, Rate Visibility */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                    <div className="sm:col-span-5">
                      <FormField label="Role">
                        <CustomSelect
                          value={row.role}
                          onChange={(val) => handleRoleChange(row.localId, val)}
                          ariaLabel={`Role for person ${index + 1}`}
                          options={USER_ROLE_SELECT_OPTIONS}
                          minMenuWidth={250}
                        />
                      </FormField>
                    </div>

                    <div className="sm:col-span-4">
                      <FormField label="Team / Desk">
                        <CustomSelect
                          value={row.desk}
                          onChange={(val) =>
                            updateRow(row.localId, (prev) => ({ ...prev, desk: val }))
                          }
                          ariaLabel={`Desk for person ${index + 1}`}
                          options={[...USER_DESK_OPTIONS]}
                        />
                      </FormField>
                    </div>

                    <div className="sm:col-span-3">
                      <span className="block text-xs font-medium text-slate-700 mb-1">
                        Client Bill Rates
                      </span>
                      <div className="h-9 p-0.5 bg-slate-100 border border-slate-200/80 rounded-lg grid grid-cols-2 gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveRowId(row.localId);
                            updateRow(row.localId, (prev) => ({
                              ...prev,
                              rateMasked: false,
                              rateManuallySet: true,
                            }));
                          }}
                          className={`rounded-md text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                            !row.rateMasked
                              ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>Visible</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveRowId(row.localId);
                            updateRow(row.localId, (prev) => ({
                              ...prev,
                              rateMasked: true,
                              rateManuallySet: true,
                            }));
                          }}
                          className={`rounded-md text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                            row.rateMasked
                              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <EyeOff className="w-3 h-3" />
                          <span>Hidden</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {row.role === 'Administrator' && row.rateMasked && (
                    <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Administrators normally have client bill rates set to Visible.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Card Footer: Add Another & Send */}
          <div className="px-6 py-4 bg-slate-50/75 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleAddRow}
                className="h-8 px-3.5 rounded-lg border border-dashed border-slate-300 bg-white hover:bg-slate-50 hover:border-brand-500 text-slate-700 hover:text-brand-700 text-[11px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add another person</span>
              </button>

              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={handleApplyFirstToAll}
                  className="text-[11px] font-medium text-brand-700 hover:text-brand-800 hover:underline cursor-pointer"
                >
                  Apply #1&apos;s role &amp; desk to all
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                {readyCount} of {rows.length} ready
              </span>
              <ActionButton
                type="submit"
                loading={isSending}
                loadingText="Sending..."
                icon={<Send className="w-3.5 h-3.5" />}
                className="h-8 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {sendButtonLabel}
              </ActionButton>
            </div>
          </div>
        </form>

        {/* Right Calm Sidebar: Live Access Preview & 3-Step Overview */}
        <aside className="lg:col-span-4 space-y-4 text-xs lg:sticky lg:top-6">
          {/* Calm Read-Only Role Permission Preview */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 card-shadow space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {rows.length > 1
                      ? `Previewing #${activeRowIndex + 1}${activeRow?.name.trim() ? ` · ${activeRow.name.trim()}` : ''}`
                      : 'Access Preview'}
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                    {roleGuide.role}
                  </h2>
                </div>
              </div>
              <StatusBadge label={roleGuide.tierLabel} tone={roleGuide.tierTone} size="xs" />
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">{roleGuide.summary}</p>

            <div className="space-y-2.5 pt-1">
              {roleCapabilities.map((cap) => (
                <div key={cap.label} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {cap.allowed ? (
                      <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                        <Minus className="w-3 h-3" />
                      </span>
                    )}
                    <span
                      className={`truncate ${
                        cap.allowed ? 'text-slate-800 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {SHORT_CAPABILITY_LABELS[cap.label] || cap.label}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-semibold shrink-0 ${
                      cap.allowed ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {cap.allowed ? 'Included' : 'Off'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Simple 3-step How Invites Work Guide */}
          <div className="bg-slate-50/90 rounded-xl border border-slate-200/80 p-5 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              What happens next
            </div>
            <ol className="space-y-2.5 text-[11px] text-slate-600">
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>Each teammate receives a secure invitation email valid for 7 days.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>They set their password and land directly inside their assigned desk.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>You can change roles, desks, or rate visibility anytime from Team Members.</span>
              </li>
            </ol>
          </div>
        </aside>
      </div>

      <UnsavedChangesModal
        isOpen={showLeaveModal}
        onConfirmLeave={confirmLeave}
        onCancelLeave={cancelLeave}
      />
    </div>
  );
};
