import { runRateMaskTests } from './unit/rateMask.test';
import { runPlacementCalculationTests } from './unit/placement.test';
import { runSecurityHardeningTests } from './unit/securityHardening.test';
import { runRequirementSubmissionTests } from './unit/requirementSubmission.test';

async function runAllBackendTests() {
  console.log('========================================================');
  console.log('TalentOS Backend Security & Unit Test Suite');
  console.log('========================================================\n');

  try {
    runRateMaskTests();
    runPlacementCalculationTests();
    runSecurityHardeningTests();
    runRequirementSubmissionTests();

    console.log('\n========================================================');
    console.log('🎉 ALL BACKEND TESTS PASSED (100% Success)');
    console.log('========================================================');
  } catch (error: any) {
    console.error('\n❌ TEST FAILURE:', error.message);
    process.exit(1);
  }
}

runAllBackendTests();

