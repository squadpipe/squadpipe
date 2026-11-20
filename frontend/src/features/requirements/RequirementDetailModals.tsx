import React, { useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  CapabilitySummary,
  Requirement,
  RequirementSubmission,
  SubmissionNote,
} from '../../types';
import {
  buildRequirementStageOptions,
  getStageDotClass,
  getStageIndex,
} from '../../utils/stageStyles';
import { formatDateTimeBadge } from '../../utils/entityMappers';
import { useMasterTaxonomies } from '../../components/shared/DynamicCustomFieldsSection';
import { SkillTagInput } from '../../components/shared/SkillTagInput';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ActionButton } from '../../components/shared/ActionButton';
import { DateTimePicker } from '../../components/shared/DateTimePicker';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { RoleSummaryField } from '../../components/shared/RichTextEditor';
import { buildClientSafeSummaryHtml } from '../../utils/richText';
import { AnimatedModal } from '../../components/shared/MotionPrimitives';

const QUICK_REJECTION_REASONS = [
  'Rate Mismatch',
  'Skills Gap',
  'Role Filled',
  'Client Selected Other',
  'Candidate Withdrew',
];

export interface CapabilityBadgeStyle {
  label: string;
  badgeClass: string;
  barClass: string;
  scoreTextClass: string;
}

/**
 * Returns whether a submission already has an evaluated fit score (treating non-AI 0%
 * placeholders as unchecked when AI evaluation is enabled).
 */
export function hasEvaluatedFitScore(
  score?: number | null,
  summary?: CapabilitySummary | null,
  aiEnabled = false
): boolean {
  if (typeof score !== 'number') return false;
  if (score === 0 && !summary?.evaluatedWithAi && aiEnabled) return false;
  return true;
}

/**
 * Resolve color tokens and label for a submission's capability fit score.
 */
export function getCapabilityBadgeStyle(
  score: number,
  summary?: CapabilitySummary | null
): CapabilityBadgeStyle {
  const rec = String(summary?.recommendation || '').toUpperCase();
  const explicitLabel = summary?.recommendationLabel;
  if (rec === 'STRONG_FIT' || (!rec && score >= 80)) {
    return {
      label: explicitLabel || 'Strong Fit',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80',
      barClass: 'bg-emerald-500',
      scoreTextClass: 'text-emerald-700',
    };
  }
  if (rec === 'GOOD_FIT' || (!rec && score >= 65)) {
    return {
      label: explicitLabel || 'Good Fit',
      badgeClass: 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100/80',
      barClass: 'bg-brand-600',
      scoreTextClass: 'text-brand-700',
    };
  }
  if (rec === 'PARTIAL_FIT' || (!rec && score >= 45)) {
    return {
      label: explicitLabel || 'Partial Fit',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/80',
      barClass: 'bg-amber-500',
      scoreTextClass: 'text-amber-700',
    };
  }
  return {
    label: explicitLabel || 'Low Fit',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70',
    barClass: 'bg-slate-400',
    scoreTextClass: 'text-slate-700',
  };
}

function formatSubmissionPersonName(rawName?: string | null): {
  displayName: string;
  initials: string;
} {
  const displayName =
    String(rawName || '')
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Applicant';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'A';
  return { displayName, initials };
}

type MasterTaxonomies = ReturnType<typeof useMasterTaxonomies>;

interface RequirementNotesModalProps {
  isOpen?: boolean;
  requirement: Requirement;
  liveEditingSub: RequirementSubmission | null;
  mode: 'notes' | 'interview' | 'closed';
  taxonomies: MasterTaxonomies;
  editingNoteId: string | null;
  confirmDeleteNoteId: string | null;
  busyNoteId: string | null;
  draftInterviewDate: string;
  draftNotesText: string;
  isSavingNotes: boolean;
  notesTextareaRef: React.RefObject<HTMLTextAreaElement>;
  onChangeInterviewDate: (val: string) => void;
  onChangeNotesText: (val: string) => void;
  onSelectEditNote: (note: SubmissionNote) => void;
  onSwitchToNewNote: () => void;
  onConfirmDeleteChange: (noteId: string | null) => void;
  onDeleteNote: (sub: RequirementSubmission, noteId: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

/**
 * Modal for managing recruiter call notes, interview schedules, and rejection feedback
 * on an individual requirement submission.
 */
export const RequirementNotesModal: React.FC<RequirementNotesModalProps> = ({
  isOpen,
  requirement,
  liveEditingSub,
  mode,
  taxonomies,
  editingNoteId,
  confirmDeleteNoteId,
  busyNoteId,
  draftInterviewDate,
  draftNotesText,
  isSavingNotes,
  notesTextareaRef,
  onChangeInterviewDate,
  onChangeNotesText,
  onSelectEditNote,
  onSwitchToNewNote,
  onConfirmDeleteChange,
  onDeleteNote,
  onSubmit,
  onClose,
}) => {
  const modalOpen = isOpen ?? Boolean(liveEditingSub);
  const sub = liveEditingSub;
  const liveNotes = sub?.notes || [];
  const isInterviewMode = mode === 'interview';
  const isClosedMode = mode === 'closed';
  const isNotesMode = mode === 'notes';
  const isClosedModalStage = (sub?.stage || '').trim().toLowerCase() === 'closed';
  const modalStageIdx = sub ? getStageIndex(sub.stage, taxonomies.stages) : 0;
  const { displayName, initials: modalInitials } = formatSubmissionPersonName(sub?.fullName);
  const prevDate = sub?.interviewDateTime || sub?.interviewDate || '';
  const dateChanged = isInterviewMode && draftInterviewDate !== prevDate;
  const hasNoteText = Boolean(draftNotesText.trim());
  const submitDisabled =
    isSavingNotes || (isInterviewMode ? !hasNoteText && !dateChanged : !hasNoteText);
  const submitLabel = isClosedMode
    ? 'Save Feedback'
    : isInterviewMode
      ? hasNoteText && dateChanged
        ? 'Save Schedule & Note'
        : hasNoteText
          ? 'Save Note'
          : 'Save Schedule'
      : editingNoteId
        ? 'Update Note'
        : 'Add Note';

  return (
    <AnimatedModal
      isOpen={Boolean(modalOpen && sub)}
      onBackdropClick={() => !isSavingNotes && onClose()}
      zIndexClass="z-50"
      panelClassName={`w-full ${
        isNotesMode ? 'max-w-xl' : 'max-w-lg'
      } bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-visible flex flex-col`}
      ariaLabel={`Notes and schedule for ${displayName}`}
    >
      {sub && (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex flex-col"
      >
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 rounded-t-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {modalInitials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-900 truncate">{displayName}</h4>
                <StatusBadge
                  stage={sub.stage}
                  dotClass={getStageDotClass(sub.stage, modalStageIdx)}
                  size="xs"
                />
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {requirement.code} &bull; {requirement.opportunityTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSavingNotes}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close notes dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-visible">
          {isInterviewMode && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Interview Date &amp; Time
              </label>
              <DateTimePicker
                value={draftInterviewDate}
                onChange={onChangeInterviewDate}
                placeholder="Select interview date & time..."
                ariaLabel={`Interview date for ${displayName}`}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isClosedMode || isClosedModalStage ? 'bg-rose-500' : 'bg-brand-600'
                  }`}
                />
                <span>
                  {isClosedMode
                    ? 'Add Rejection Feedback'
                    : isInterviewMode
                      ? 'Interview Note (Optional)'
                      : editingNoteId
                        ? 'Edit Note'
                        : 'Add Note'}
                </span>
              </label>
              {isNotesMode && editingNoteId && (
                <button
                  type="button"
                  onClick={onSwitchToNewNote}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                >
                  + New Note Instead
                </button>
              )}
            </div>

            {isClosedMode && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {QUICK_REJECTION_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      const clean = draftNotesText.trim();
                      if (!clean) {
                        onChangeNotesText(reason);
                      } else if (!clean.toLowerCase().includes(reason.toLowerCase())) {
                        onChangeNotesText(`${clean}\n${reason}`);
                      }
                    }}
                    className="px-2 py-0.5 rounded-md bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200/80 text-[10.5px] font-medium text-rose-700 transition-colors cursor-pointer"
                  >
                    + {reason}
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={notesTextareaRef}
              rows={3}
              autoFocus={!isInterviewMode}
              aria-label={`Call notes and feedback for ${displayName}`}
              value={draftNotesText}
              onChange={(e) => onChangeNotesText(e.target.value)}
              placeholder={
                isClosedMode
                  ? 'Why did the client reject or close out this applicant? (e.g. Budget ceiling, needed hands-on GCP)'
                  : isInterviewMode
                    ? 'Optional interview round notes, panel details, or prep instructions...'
                    : 'Log recruiter call summary, Round 1/2 debrief, or client feedback...'
              }
              className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50/40 focus:bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 transition-colors"
            />
          </div>

          {isNotesMode && (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                <span>All Notes ({liveNotes.length})</span>
              </div>
              {liveNotes.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-slate-400 bg-slate-50/60 rounded-lg border border-dashed border-slate-200">
                  No notes added for {displayName} yet.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-2 pr-0.5">
                  {liveNotes.map((note) => {
                    const noteTime = formatDateTimeBadge(note.updatedAt || note.createdAt);
                    const isBeingEdited = editingNoteId === note.id;
                    const isNoteClosed =
                      (note.stage || '').trim().toLowerCase() === 'closed' || isClosedModalStage;
                    return (
                      <div
                        key={note.id}
                        className={`rounded-xl border px-3.5 py-2.5 text-xs transition-colors ${
                          isBeingEdited
                            ? 'border-brand-400 bg-brand-50/40'
                            : 'border-slate-200 bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 flex-wrap min-w-0">
                            <span className="font-semibold text-slate-700 whitespace-nowrap">
                              {note.authorName}
                            </span>
                            {noteTime && <span className="whitespace-nowrap">&middot; {noteTime}</span>}
                            {note.updatedAt && <span className="whitespace-nowrap">(edited)</span>}
                            {isNoteClosed && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-medium whitespace-nowrap">
                                Rejection Feedback
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {confirmDeleteNoteId === note.id ? (
                              <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-md px-1.5 py-0.5 text-[10px]">
                                {busyNoteId === note.id ? (
                                  <span className="inline-flex items-center gap-1 text-rose-700 font-semibold px-1 py-0.5">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Deleting...
                                  </span>
                                ) : (
                                  <>
                                    <span className="text-rose-700 font-semibold">Delete?</span>
                                    <button
                                      type="button"
                                      disabled={isSavingNotes}
                                      onClick={() => onDeleteNote(liveEditingSub, note.id)}
                                      className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isSavingNotes}
                                      onClick={() => onConfirmDeleteChange(null)}
                                      className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-600 font-semibold border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                      No
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={busyNoteId === note.id || isSavingNotes}
                                  onClick={() => onSelectEditNote(note)}
                                  title="Edit note"
                                  aria-label={`Edit note by ${note.authorName}`}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    isBeingEdited
                                      ? 'text-brand-600 bg-white'
                                      : 'text-slate-400 hover:text-brand-600 hover:bg-white'
                                  }`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={Boolean(busyNoteId) || isSavingNotes}
                                  onClick={() => onConfirmDeleteChange(note.id)}
                                  title="Delete note"
                                  aria-label={`Delete note by ${note.authorName}`}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <p className="text-slate-700 whitespace-pre-line break-words leading-relaxed mt-1">
                          {note.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isSavingNotes}
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            {isClosedMode || isInterviewMode ? 'Skip' : 'Close'}
          </button>
          <ActionButton
            type="submit"
            loading={isSavingNotes}
            loadingText="Saving..."
            disabled={submitDisabled}
            spinnerClassName="w-3.5 h-3.5 animate-spin flex-shrink-0"
            className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            {submitLabel}
          </ActionButton>
        </div>
      </form>
      )}
    </AnimatedModal>
  );
};

interface EditRequirementModalProps {
  isOpen?: boolean;
  requirement: Requirement;
  editForm: Requirement | null;
  editOpenPositions: string;
  editOpenPosError: string;
  isSavingEdit: boolean;
  taxonomies: MasterTaxonomies;
  onChangeForm: (next: Requirement) => void;
  onChangeOpenPositions: (val: string) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
}

/**
 * Modal for editing core requisition fields, stage, open positions, and required skills.
 */
export const EditRequirementModal: React.FC<EditRequirementModalProps> = ({
  isOpen,
  requirement,
  editForm,
  editOpenPositions,
  editOpenPosError,
  isSavingEdit,
  taxonomies,
  onChangeForm,
  onChangeOpenPositions,
  onSave,
  onClose,
}) => (
  <AnimatedModal
    isOpen={Boolean((isOpen ?? true) && editForm)}
    onBackdropClick={() => !isSavingEdit && onClose()}
    zIndexClass="z-50"
    panelClassName="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
    ariaLabel="Edit Requisition Details"
  >
    {editForm && (
      <>
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#141615] text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shrink-0">
            <Pencil className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">Edit Requisition Details</h2>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              {requirement.code} &bull; {requirement.opportunityTitle}
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={isSavingEdit}
          onClick={onClose}
          aria-label="Close modal"
          className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave();
        }}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Opportunity Title *
              </label>
              <input
                type="text"
                required
                value={editForm.opportunityTitle}
                onChange={(e) => onChangeForm({ ...editForm, opportunityTitle: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Client Company *
              </label>
              <input
                type="text"
                required
                value={editForm.companyName}
                onChange={(e) => onChangeForm({ ...editForm, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={editForm.location}
                onChange={(e) => onChangeForm({ ...editForm, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                No. of Open Positions *
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                step={1}
                value={editOpenPositions}
                onChange={(e) => onChangeOpenPositions(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-xs bg-white focus:outline-none ${
                  editOpenPosError
                    ? 'border-rose-400 focus:border-rose-500'
                    : 'border-slate-200 focus:border-brand-600'
                }`}
              />
              {editOpenPosError && (
                <p className="text-[10px] font-semibold text-rose-600 mt-1">{editOpenPosError}</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Stage</label>
              <CustomSelect
                value={editForm.status}
                onChange={(val) =>
                  onChangeForm({ ...editForm, status: val as Requirement['status'] })
                }
                ariaLabel="Stage"
                options={buildRequirementStageOptions(taxonomies.stages, editForm.status).map(
                  (s) => ({
                    value: s,
                    label: s,
                    dotClass: getStageDotClass(s, getStageIndex(s, taxonomies.stages)),
                  })
                )}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Assigned Recruiter
              </label>
              <input
                type="text"
                value={editForm.assignedRecruiter || ''}
                onChange={(e) =>
                  onChangeForm({ ...editForm, assignedRecruiter: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Required Competencies
            </label>
            <SkillTagInput
              value={editForm.skillsRequired}
              onChange={(nextCsv) => onChangeForm({ ...editForm, skillsRequired: nextCsv })}
            />
          </div>

          <RoleSummaryField
            label="Role Scope & Public Summary"
            value={editForm.publicDescription || ''}
            onChange={(nextHtml) => onChangeForm({ ...editForm, publicDescription: nextHtml })}
            onAutoFill={() =>
              onChangeForm({
                ...editForm,
                publicDescription: buildClientSafeSummaryHtml({
                  opportunityTitle: editForm.opportunityTitle,
                  openPositions: Number(editOpenPositions) || editForm.openPositions || 1,
                  workModel: editForm.workModel,
                  location: editForm.location,
                  skillsRequired: editForm.skillsRequired,
                  companyName: editForm.companyName,
                  rawEmailText: editForm.rawEmailText,
                }),
              })
            }
            minHeight={105}
            maxHeight={260}
          />
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={isSavingEdit}
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            Cancel
          </button>
          <ActionButton
            type="submit"
            loading={isSavingEdit}
            loadingText="Saving..."
            className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Save Requirement
          </ActionButton>
        </div>
      </form>
      </>
    )}
  </AnimatedModal>
);

interface CapabilityFitModalProps {
  isOpen?: boolean;
  requirement: Requirement;
  submission: RequirementSubmission | null;
  aiEnabled: boolean;
  isEvaluating?: boolean;
  onRunAiCheck?: () => void;
  onClose: () => void;
}

/**
 * Popup dialog showing a candidate's capability fit score breakdown, verdict,
 * matched strengths, and identified skill gaps against the requirement.
 */
export const CapabilityFitModal: React.FC<CapabilityFitModalProps> = ({
  isOpen,
  requirement,
  submission,
  aiEnabled,
  isEvaluating = false,
  onRunAiCheck,
  onClose,
}) => {
  const modalOpen = isOpen ?? Boolean(submission);

  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEvaluating) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, isEvaluating, onClose]);

  const { displayName, initials } = formatSubmissionPersonName(submission?.fullName);
  const hasScore = hasEvaluatedFitScore(
    submission?.capabilityScore,
    submission?.capabilitySummary,
    aiEnabled
  );
  const score = hasScore
    ? Math.max(0, Math.min(100, Math.round(submission!.capabilityScore!)))
    : null;
  const summary = submission?.capabilitySummary;
  const badgeMeta = hasScore
    ? getCapabilityBadgeStyle(score!, summary)
    : {
        label: 'Not Checked',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        barClass: 'bg-slate-300',
        scoreTextClass: 'text-slate-500',
      };
  const usedAi = Boolean(summary?.evaluatedWithAi && aiEnabled);
  const evaluatedAtLabel = summary?.evaluatedAt ? formatDateTimeBadge(summary.evaluatedAt) : '';
  const strengths = summary?.strengths ?? [];
  const gaps = summary?.gaps ?? [];

  return (
    <AnimatedModal
      isOpen={Boolean(modalOpen && submission)}
      onBackdropClick={() => !isEvaluating && onClose()}
      zIndexClass="z-50"
      panelClassName="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      ariaLabel={`Fit breakdown for ${displayName}`}
    >
      {submission && (
        <>
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-900 truncate">{displayName}</h4>
                {submission.workAuth && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200/80 text-slate-600 font-medium whitespace-nowrap">
                    {submission.workAuth}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {submission.currentTitle ? `${submission.currentTitle} • ` : ''}
                {requirement.code} &bull; {requirement.opportunityTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isEvaluating}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close fit assessment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Overall Fit Score & Method */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-baseline gap-2.5">
                <span className={`text-2xl font-bold tabular-nums ${badgeMeta.scoreTextClass}`}>
                  {hasScore ? `${score}%` : '—'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${badgeMeta.badgeClass}`}
                >
                  {usedAi && <Sparkles className="w-3 h-3 shrink-0" />}
                  <span>{badgeMeta.label}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-medium text-slate-600">
                  {!hasScore
                    ? 'Awaiting Evaluation'
                    : usedAi
                      ? 'AI Evaluated'
                      : 'Skill Match Check'}
                </span>
                {evaluatedAtLabel && (
                  <>
                    <span className="text-slate-300">&bull;</span>
                    <span>{evaluatedAtLabel}</span>
                  </>
                )}
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${badgeMeta.barClass}`}
                style={{ width: `${score ?? 0}%` }}
              />
            </div>
          </div>

          {/* Verdict */}
          <div className="space-y-1.5">
            <h5 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
              Assessment Verdict
            </h5>
            {summary?.verdict ? (
              <p className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 text-xs text-slate-700 font-medium leading-relaxed">
                {summary.verdict}
              </p>
            ) : (
              <p className="p-3.5 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 text-xs text-slate-500 leading-relaxed">
                {hasScore
                  ? 'No detailed verdict is available yet for this applicant.'
                  : 'No fit evaluation has been run yet. Click below to compare this applicant against required skills.'}
              </p>
            )}
          </div>

          {/* Strengths */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Matched Strengths</span>
              </h5>
              <span className="text-[11px] font-semibold text-slate-500">
                {strengths.length}
              </span>
            </div>
            {strengths.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {strengths.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] font-medium"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                No matching skills highlighted in this evaluation.
              </p>
            )}
          </div>

          {/* Gaps */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-[10.5px] font-bold uppercase tracking-wider text-amber-800 inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Skill &amp; Experience Gaps</span>
              </h5>
              <span className="text-[11px] font-semibold text-slate-500">{gaps.length}</span>
            </div>
            {gaps.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {gaps.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] font-medium"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                No significant skill gaps identified.
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          {onRunAiCheck ? (
            <button
              type="button"
              disabled={isEvaluating}
              onClick={onRunAiCheck}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
            >
              {isEvaluating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>
                {isEvaluating
                  ? 'Evaluating...'
                  : aiEnabled
                    ? usedAi
                      ? 'Re-run AI Check'
                      : 'Run AI Check'
                    : hasScore
                      ? 'Re-run Fit Check'
                      : 'Run Fit Check'}
              </span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">
              Compared against {requirement.code} required skills
            </span>
          )}
          <button
            type="button"
            disabled={isEvaluating}
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
        </>
      )}
    </AnimatedModal>
  );
};
