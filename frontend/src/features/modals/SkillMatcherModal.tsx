import React from 'react';
import { Requirement, Candidate, CapabilitySummary } from '../../types';
import { AttachBenchDrawer } from '../../components/modals/AttachBenchDrawer';

interface SkillMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirements: Requirement[];
  candidates: Candidate[];
  initialRequirement?: Requirement | null;
  rateMasked?: boolean;
  onSubmitCandidate: (candidate: Candidate, requirement: Requirement) => Promise<void> | void;
  onAttachCandidates?: (
    requirement: Requirement,
    candidateIds: string[],
    precomputedCapabilities?: Record<string, CapabilitySummary>
  ) => Promise<void> | void;
  onOpenCsvImport?: (requirement: Requirement) => void;
  onOpenResumeParser?: (requirement: Requirement) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const SkillMatcherModal: React.FC<SkillMatcherModalProps> = ({
  isOpen,
  onClose,
  requirements,
  candidates,
  initialRequirement,
  rateMasked = false,
  onSubmitCandidate,
  onAttachCandidates,
  onOpenCsvImport,
  onOpenResumeParser,
}) => {
  return (
    <AttachBenchDrawer
      isOpen={isOpen}
      onClose={onClose}
      requirement={initialRequirement}
      requirements={requirements}
      allowRequirementSwitch={false}
      autoRankOnOpen={true}
      candidates={candidates}
      rateMasked={rateMasked}
      onAttachCandidates={onAttachCandidates}
      onAssignCandidate={(req, cand) => onSubmitCandidate(cand, req)}
      onOpenCsvImport={onOpenCsvImport}
      onOpenResumeParser={onOpenResumeParser}
    />
  );
};
