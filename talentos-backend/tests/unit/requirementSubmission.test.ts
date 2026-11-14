import assert from 'node:assert/strict';
import { RequirementStatus } from '@prisma/client';
import { parseOpenPositions } from '../../src/services/requirement.service';
import {
  computePromotedRequirementStage,
  normalizePitchTone,
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

  // 3. PitchTone normalization
  assert.equal(normalizePitchTone('High-Impact'), 'HIGH_IMPACT');
  assert.equal(normalizePitchTone('Technical Focus'), 'TECHNICAL_FOCUS');
  assert.equal(normalizePitchTone('Professional'), 'PROFESSIONAL');
  assert.equal(normalizePitchTone(undefined), 'PROFESSIONAL');

  console.log('✅ Requirement Open Positions & Multi-Applicant Submission Tests: PASSED');
};
