import assert from 'node:assert/strict';
import { UserRole } from '@prisma/client';
import {
  applySubmissionNoteMutation,
  formatClientDuplicateWarnings,
  normalizeOptionalNotes,
  parseOptionalDateInput,
  parseSubmissionNotes,
} from '../../src/services/submission.service';
import {
  buildCandidateWhereClause,
  parseCandidateSearchTokens,
} from '../../src/services/candidate.service';
import {
  buildRecruiterPerformanceRows,
  formatLiveWorkloadText,
} from '../../src/services/analytics.service';
import { parseCsvHourlyRates } from '../../src/services/csvImporter.service';

export const runRecruiterWorkflowTests = () => {
  console.log('--- Running Recruiter Notes, Performance, Search & Duplicate Tests ---');

  // 1. Notes & interview date validation
  assert.equal(parseOptionalDateInput(undefined), undefined);
  assert.equal(parseOptionalDateInput(''), null);
  assert.equal(parseOptionalDateInput(null), null);
  const parsedDt = parseOptionalDateInput('2026-11-18T14:30:00.000Z');
  assert.ok(parsedDt instanceof Date && !isNaN(parsedDt.getTime()));
  assert.throws(
    () => parseOptionalDateInput('not-a-real-date'),
    (err: any) => err?.statusCode === 400
  );

  assert.equal(normalizeOptionalNotes(undefined), undefined);
  assert.equal(normalizeOptionalNotes('   '), null);
  assert.equal(normalizeOptionalNotes('  Round 2 feedback: strong K8s  '), 'Round 2 feedback: strong K8s');
  assert.throws(
    () => normalizeOptionalNotes('a'.repeat(5001)),
    (err: any) => err?.statusCode === 400
  );

  // 2. Client duplicate re-submission warning formatting
  const now = new Date('2026-11-16T12:00:00.000Z');
  const fiveDaysAgo = new Date('2026-11-11T10:00:00.000Z');
  const warnings = formatClientDuplicateWarnings(
    [
      {
        id: 'sub-old',
        candidateId: 'cand-1',
        stage: 'INTERVIEW',
        submissionDate: fiveDaysAgo,
        createdAt: fiveDaysAgo,
        candidate: { fullName: 'Aarav Patel' },
        recruiter: { fullName: 'Priya Sharma' },
        requirement: {
          id: 'req-99',
          code: 'REQ-1099',
          opportunityTitle: 'Platform SRE',
          companyName: 'Acme Corp',
        },
      },
    ],
    now
  );
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].daysAgo, 5);
  assert.equal(warnings[0].clientName, 'Acme Corp');
  assert.equal(warnings[0].requirementCode, 'REQ-1099');
  assert.equal(warnings[0].recruiterName, 'Priya Sharma');

  // 3. Resume full-text boolean search & multi-filter clause construction
  assert.deepEqual(
    parseCandidateSearchTokens('Kubernetes AND Terraform "Google Cloud"'),
    ['Kubernetes', 'Terraform', 'Google Cloud']
  );

  const where = buildCandidateWhereClause({
    tenantId: 't1',
    search: 'Kubernetes AND Terraform',
    workAuth: 'H-1B',
    stage: 'Submitted',
    minRate: 70,
    maxRate: 110,
  });
  assert.equal(where.tenantId, 't1');
  assert.equal(where.pipelineStage, 'SUBMITTED');
  assert.ok(Array.isArray(where.AND) && where.AND.length === 3); // 2 search tokens + 1 rate range filter
  const firstTokenOr = (where.AND[0] as any).OR;
  assert.ok(firstTokenOr.some((cond: any) => 'rawSnippet' in cond));

  // 4. Per-recruiter performance aggregation & live workload text
  const cutoff = new Date('2026-11-09T12:00:00.000Z');
  const perf = buildRecruiterPerformanceRows({
    users: [
      { id: 'u1', fullName: 'Nakul Das', role: UserRole.ADMINISTRATOR, desk: 'US Cloud' },
      { id: 'u2', fullName: 'Rohan Nair', role: UserRole.TECHNICAL_RECRUITER, desk: 'Java / Data' },
    ],
    requirements: [
      { id: 'r1', assignedRecruiterId: 'u1', status: 'INTERVIEW' },
      { id: 'r2', assignedRecruiterId: 'u2', status: 'Archived' },
    ],
    submissions: [
      {
        recruiterId: 'u1',
        requirementId: 'r1',
        stage: 'INTERVIEW',
        submissionDate: new Date('2026-11-15T10:00:00.000Z'),
        interviewDate: new Date('2026-11-17T10:00:00.000Z'),
        lastClientFeedbackDate: null,
        updatedAt: new Date('2026-11-15T11:00:00.000Z'),
      },
      {
        // Falls back to requirement assignedRecruiterId when recruiterId is null; outside weekly window
        recruiterId: null,
        requirementId: 'r1',
        stage: 'SUBMITTED',
        submissionDate: new Date('2026-10-01T10:00:00.000Z'),
        interviewDate: null,
        lastClientFeedbackDate: null,
        updatedAt: new Date('2026-10-01T10:00:00.000Z'),
      },
    ],
    placements: [
      {
        recruiterId: 'u1',
        requirementId: 'r1',
        createdAt: new Date('2026-11-15T15:00:00.000Z'),
      },
    ],
    sinceDate: cutoff,
  });

  const nakul = perf.team.find((t) => t.userId === 'u1')!;
  const rohan = perf.team.find((t) => t.userId === 'u2')!;
  assert.equal(nakul.openReqs, 1);
  assert.equal(nakul.submissions, 1);
  assert.equal(nakul.interviews, 1);
  assert.equal(nakul.placements, 1);
  assert.equal(rohan.openReqs, 0);
  assert.equal(perf.totals.submissions, 1);
  assert.equal(perf.totals.interviews, 1);
  assert.equal(perf.totals.placements, 1);
  assert.equal(formatLiveWorkloadText(1, 2, 1), '1 Req • 2 Subs • 1 Placement');

  // 5. Multiple submission notes parsing, adding, editing & deleting
  const legacyParsed = parseSubmissionNotes('ROund 1 done', 'Nakul', '2026-11-16T08:00:00.000Z');
  assert.equal(legacyParsed.length, 1);
  assert.equal(legacyParsed[0].id, 'legacy_0');
  assert.equal(legacyParsed[0].text, 'ROund 1 done');

  const addedRaw = applySubmissionNoteMutation({
    existingRaw: 'ROund 1 done',
    action: 'add',
    noteText: 'Round 2 scheduled for Thursday',
    authorName: 'Priya',
    fallbackAuthor: 'Nakul',
    now: new Date('2026-11-16T09:00:00.000Z'),
  });
  const afterAdd = parseSubmissionNotes(addedRaw);
  assert.equal(afterAdd.length, 2);
  assert.equal(afterAdd[0].text, 'Round 2 scheduled for Thursday');
  assert.equal(afterAdd[1].text, 'ROund 1 done');

  const editedRaw = applySubmissionNoteMutation({
    existingRaw: addedRaw,
    action: 'edit',
    noteId: 'legacy_0',
    noteText: 'Round 1 passed',
    now: new Date('2026-11-16T09:30:00.000Z'),
  });
  const afterEdit = parseSubmissionNotes(editedRaw);
  assert.equal(afterEdit[1].text, 'Round 1 passed');
  assert.ok(afterEdit[1].updatedAt);

  const deletedRaw = applySubmissionNoteMutation({
    existingRaw: editedRaw,
    action: 'delete',
    noteId: 'legacy_0',
  });
  const afterDelete = parseSubmissionNotes(deletedRaw);
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].text, 'Round 2 scheduled for Thursday');

  // 6. CSV importer W2 / C2C / default hourly rate parsing
  const w2Rate = parseCsvHourlyRates('$95/hr (W2)');
  assert.equal(w2Rate.hourlyRateDisplay, '$95/hr (W2)');
  assert.equal(w2Rate.hourlyRateW2, 95);
  assert.equal(w2Rate.hourlyRateC2c, null);

  const c2cRate = parseCsvHourlyRates('$115/hr (C2C)');
  assert.equal(c2cRate.hourlyRateDisplay, '$115/hr (C2C)');
  assert.equal(c2cRate.hourlyRateW2, null);
  assert.equal(c2cRate.hourlyRateC2c, 115);

  const defaultRate = parseCsvHourlyRates('');
  assert.equal(defaultRate.hourlyRateDisplay, '$90/hr (W2)');
  assert.equal(defaultRate.hourlyRateW2, 90);
  assert.equal(defaultRate.hourlyRateC2c, null);

  console.log('✅ Recruiter Notes, Performance, Search & Duplicate Tests: PASSED');
};
