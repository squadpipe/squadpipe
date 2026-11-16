import assert from 'node:assert/strict';
import { RequirementStatus, parseOpenPositions } from '../../src/services/requirement.service';
import {
  computeHighestActiveStage,
  computePromotedRequirementStage,
  normalizePitchTone,
  resolveApplicantStage,
} from '../../src/services/submission.service';

export const runRequirementSubmissionTests = () => {
  console.log('--- Running Requirement Open Positions & Multi-Applicant Submission Tests ---');

  // 1. Required validation & parsing for openPositions
  assert.equal(parseOpenPositions(1), 1);
  assert.equal(parseOpenPositions(5), 5);
  assert.equal(parseOpenPositions('3'), 3);
  assert.equal(parseOpenPositions(' 12 '), 12);

  for (const invalid of [undefined, null, '', '   ', 0, -2, '0', '-1', 1.5, '2.5', 'abc', 1001]) {
    assert.throws(
      () => parseOpenPositions(invalid),
      (err: any) => err?.statusCode === 400,
      `Expected HTTP 400 validation error for openPositions=${String(invalid)}`
    );
  }

  // 2. Multi-applicant stage aggregation
  assert.equal(
    computePromotedRequirementStage([RequirementStatus.SUBMITTED], RequirementStatus.REQUIREMENT),
    RequirementStatus.SUBMITTED
  );
  assert.equal(
    computePromotedRequirementStage(
      [RequirementStatus.SUBMITTED, RequirementStatus.INTERVIEW],
      RequirementStatus.SUBMITTED
    ),
    RequirementStatus.INTERVIEW
  );
  assert.equal(
    computePromotedRequirementStage(
      [RequirementStatus.SELECTED, RequirementStatus.CLOSED],
      RequirementStatus.INTERVIEW
    ),
    RequirementStatus.SELECTED
  );
  // Closed/rejected applicant does not advance or downgrade
  assert.equal(
    computePromotedRequirementStage([RequirementStatus.CLOSED], RequirementStatus.SUBMITTED),
    null
  );
  // Onboarding requirement remains in Onboarding
  assert.equal(
    computePromotedRequirementStage([RequirementStatus.SUBMITTED], RequirementStatus.ONBOARDING),
    null
  );

  // 3. Dynamic custom applicant stage validation & ordered promotion
  const customStages = [
    'Requirement',
    'Submitted',
    'Client Screen',
    'Interview',
    'Final Panel',
    'Selected',
    'Onboarding',
    'Billable',
    'Archived',
  ];

  assert.equal(resolveApplicantStage('submitted', customStages), RequirementStatus.SUBMITTED);
  assert.equal(resolveApplicantStage('Closed', customStages), RequirementStatus.CLOSED);
  assert.equal(resolveApplicantStage('client screen', customStages), 'Client Screen');
  assert.equal(resolveApplicantStage('Final Panel', customStages), 'Final Panel');

  for (const invalidStage of ['', '   ', 'Requirement', 'Billable', 'Archived', 'NonExistentStage']) {
    assert.throws(
      () => resolveApplicantStage(invalidStage, customStages),
      (err: any) => err?.statusCode === 400,
      `Expected HTTP 400 validation error for stage=${String(invalidStage)}`
    );
  }

  assert.equal(
    computePromotedRequirementStage(['Client Screen'], RequirementStatus.SUBMITTED, customStages),
    'Client Screen'
  );
  assert.equal(
    computePromotedRequirementStage(
      ['Client Screen', 'Final Panel'],
      RequirementStatus.INTERVIEW,
      customStages
    ),
    'Final Panel'
  );
  assert.equal(
    computePromotedRequirementStage(['Client Screen'], RequirementStatus.SELECTED, customStages),
    null
  );
  assert.equal(
    computeHighestActiveStage([RequirementStatus.SUBMITTED, 'Final Panel', RequirementStatus.CLOSED], customStages),
    'Final Panel'
  );
  assert.equal(
    computeHighestActiveStage([RequirementStatus.CLOSED], customStages),
    RequirementStatus.REQUIREMENT
  );

  // 4. PitchTone normalization
  assert.equal(normalizePitchTone('High-Impact'), 'HIGH_IMPACT');
  assert.equal(normalizePitchTone('Technical Focus'), 'TECHNICAL_FOCUS');
  assert.equal(normalizePitchTone('Professional'), 'PROFESSIONAL');
  assert.equal(normalizePitchTone(undefined), 'PROFESSIONAL');

  console.log('✅ Requirement Open Positions & Multi-Applicant Submission Tests: PASSED');
};
