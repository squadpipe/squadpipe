import { runRateMaskTests } from './unit/rateMask.test';
import { runPlacementCalculationTests } from './unit/placement.test';
import { runSecurityHardeningTests } from './unit/securityHardening.test';
import { runRequirementSubmissionTests } from './unit/requirementSubmission.test';
import { runEmailTemplateTests } from './unit/emailTemplate.test';
import { runRecruiterWorkflowTests } from './unit/recruiterWorkflows.test';
import { runAiConfigTests } from './unit/aiConfig.test';
import { runAiServiceTests } from './unit/ai.test';
import { runPublicIntakeTests } from './unit/publicIntake.test';
import { runCapabilityTests } from './unit/capability.test';
import { runPitchDraftTests } from './unit/pitchDraft.test';
import { runAiUsageTests } from './unit/aiUsage.test';
import { runSlaAgentTests } from './unit/slaAgent.test';
import { runTableSortTests } from './unit/tableSort.test';
import { runPgvectorRagTests } from './unit/pgvectorRag.test';
import { runSignupVerificationTests } from './unit/signupVerification.test';
import { runSkillMatchingTests } from './unit/skillMatching.test';

async function runAllBackendTests() {
  console.log('========================================================');
  console.log('SquadPipe Backend Security & Unit Test Suite');
  console.log('========================================================\n');

  try {
    runRateMaskTests();
    runPlacementCalculationTests();
    runSecurityHardeningTests();
    runRequirementSubmissionTests();
    runEmailTemplateTests();
    runRecruiterWorkflowTests();
    runAiConfigTests();
    await runAiServiceTests();
    runPublicIntakeTests();
    await runCapabilityTests();
    await runPitchDraftTests();
    await runAiUsageTests();
    await runSlaAgentTests();
    runTableSortTests();
    await runPgvectorRagTests();
    await runSignupVerificationTests();
    runSkillMatchingTests();

    console.log('\n========================================================');
    console.log('🎉 ALL BACKEND TESTS PASSED (100% Success)');
    console.log('========================================================');
  } catch (error: any) {
    console.error('\n❌ TEST FAILURE:', error.message);
    process.exit(1);
  }
}

runAllBackendTests();

