import React from 'react';
import { Requirement, Candidate } from '../../types';
import { AttachBenchDrawer } from '../../components/modals/AttachBenchDrawer';

interface SkillMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirements: Requirement[];
  candidates: Candidate[];
  initialRequirement?: Requirement | null;
  rateMasked?: boolean;
  onSubmitCandidate: (candidate: Candidate, requirement: Requirement) => Promise<void> | void;
  onAttachCandidates?: (requirement: Requirement, candidateIds: string[]) => Promise<void> | void;
  onOpenCsvImport?: (requirement: Requirement) => void;
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
}) => {
  return (
    <AttachBenchDrawer
      isOpen={isOpen}
      onClose={onClose}
      requirement={initialRequirement}
      requirements={requirements}
      allowRequirementSwitch={true}
      candidates={candidates}
      rateMasked={rateMasked}
      onAttachCandidates={onAttachCandidates}
      onAssignCandidate={(req, cand) => onSubmitCandidate(cand, req)}
      onOpenCsvImport={onOpenCsvImport}
    />
  );
};
