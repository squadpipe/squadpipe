import React, { useState } from 'react';
import { Requirement, Candidate } from '../../types';

interface RequirementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirement: Requirement | null;
  candidates: Candidate[];
  onAssignCandidate: (req: Requirement, candidate: Candidate) => void;
  onOpenResumePreview: (candidate: Candidate) => void;
  onOpenPitchWriter: (req: Requirement) => void;
  onOpenPlacementWizard: (req: Requirement) => void;
}

export const RequirementDetailModal: React.FC<RequirementDetailModalProps> = ({
  isOpen,
  onClose,
  requirement,
  candidates,
  onAssignCandidate,
  onOpenResumePreview,
  onOpenPitchWriter,
  onOpenPlacementWizard,
}) => {
  const [showBenchPicker, setShowBenchPicker] = useState(false);

  if (!isOpen || !requirement) return null;

  const assignedCand = candidates.find(
    (c) => c.fullName.toLowerCase() === (requirement.resourceName || '').toLowerCase()
  );

  const getStatusBadge = (status: Requirement['status']) => {
    switch (status) {
      case 'Submitted':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Interview':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Selected':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Onboarding':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const skills = requirement.skillsRequired
    ? requirement.skillsRequired.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col animate-fade-in max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {requirement.code}
              </span>
              <h2 className="text-sm font-bold text-slate-900">{requirement.opportunityTitle}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {requirement.companyName} &bull; {requirement.location}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Client Contact</span>
              <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                {requirement.clientContact || 'Primary Hiring Lead'}{' '}
                {requirement.clientContactTitle ? `(${requirement.clientContactTitle})` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Assigned Recruiter</span>
              <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                {requirement.assignedRecruiter || 'Desk Sourcing Specialist'}
              </span>
            </div>
          </div>

          {/* Skillset Pills */}
          <div>
            <span className="font-bold text-slate-800 text-[11px] block mb-1.5">Required Competencies</span>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s, idx) => (
                <span
                  key={idx}
                  className="text-xs font-mono bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-md font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Lifecycle Stage */}
          <div>
            <span className="font-bold text-slate-800 text-[11px] block mb-1">Current Lifecycle Stage</span>
            <span className={`px-2.5 py-1 rounded text-xs font-bold border inline-block ${getStatusBadge(requirement.status)}`}>
              {requirement.status}
            </span>
          </div>

          {/* Submitted Candidate Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800 text-[11px]">Submitted Candidates</span>
              <button
                onClick={() => setShowBenchPicker(!showBenchPicker)}
                className="text-brand-600 hover:text-brand-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
              >
                <i className={`fa-solid ${showBenchPicker ? 'fa-xmark' : 'fa-user-plus'} text-[10px]`}></i>
                <span>
                  {showBenchPicker
                    ? 'Cancel Selection'
                    : requirement.resourceName
                    ? 'Reassign from Bench'
                    : '+ Match Bench Candidate'}
                </span>
              </button>
            </div>

            {/* Currently Assigned Candidate */}
            {requirement.resourceName && !showBenchPicker && (
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 border border-brand-200 flex items-center justify-center font-bold text-xs">
                    {requirement.resourceName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">{requirement.resourceName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Recruiter: {requirement.assignedRecruiter}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {assignedCand && (
                    <button
                      onClick={() => onOpenResumePreview(assignedCand)}
                      className="text-xs text-brand-600 hover:text-brand-700 hover:underline font-semibold"
                    >
                      View Resume
                    </button>
                  )}
                  <span className="text-[10px] font-mono text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-semibold">
                    Client Review
                  </span>
                </div>
              </div>
            )}

            {/* Inline Bench Consultant Picker */}
            {(showBenchPicker || !requirement.resourceName) && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Select Available Bench Consultant:
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {candidates.map((con) => (
                    <div
                      key={con.id}
                      onClick={() => {
                        onAssignCandidate(requirement, con);
                        setShowBenchPicker(false);
                      }}
                      className="p-2.5 bg-white hover:bg-brand-50/50 rounded-lg border border-slate-200 hover:border-brand-500 cursor-pointer flex items-center justify-between transition-all group"
                    >
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-brand-600 text-xs flex items-center gap-1.5">
                          <span>{con.fullName}</span>
                          <span className="text-[9px] font-mono font-normal text-slate-400">({con.workAuth})</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {con.currentTitle} &bull; {con.hourlyRate}
                        </div>
                      </div>
                      <button className="px-2.5 py-1 rounded bg-brand-600 text-white text-[10px] font-semibold group-hover:bg-brand-700 transition-colors shadow-2xs">
                        Assign & Submit
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                onClose();
                onOpenPitchWriter(requirement);
              }}
              className="text-brand-600 font-semibold hover:text-brand-700 flex items-center gap-1.5"
            >
              <i className="fa-solid fa-pen-nib"></i>
              <span>Compose Pitch</span>
            </button>
            {requirement.resourceName && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPlacementWizard(requirement);
                }}
                className="text-emerald-700 font-semibold hover:text-emerald-800 flex items-center gap-1.5"
              >
                <i className="fa-solid fa-file-invoice-dollar"></i>
                <span>Activate Placement</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

