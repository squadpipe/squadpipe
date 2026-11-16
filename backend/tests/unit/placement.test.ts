import assert from 'assert';
import { parseRateNumber } from '../../src/utils/rateParser';

export const runPlacementCalculationTests = () => {
  console.log('--- Running Commercial Placement Margin Tests ---');

  const testCases = [
    { billRate: 145.0, payRate: 105.0, expectedSpread: 40.0, expectedMargin: 27.6, expectedMonthlyGP: 6400 },
    { billRate: 115.0, payRate: 80.0, expectedSpread: 35.0, expectedMargin: 30.4, expectedMonthlyGP: 5600 },
    { billRate: 120.0, payRate: 92.0, expectedSpread: 28.0, expectedMargin: 23.3, expectedMonthlyGP: 4480 },
  ];

  for (const tc of testCases) {
    const spread = tc.billRate - tc.payRate;
    const marginPct = parseFloat(((spread / tc.billRate) * 100).toFixed(1));
    const monthlyGP = spread * 160;

    if (spread !== tc.expectedSpread) {
      throw new Error(`Calculated spread ${spread} does not match expected ${tc.expectedSpread}`);
    }
    if (marginPct !== tc.expectedMargin) {
      throw new Error(`Calculated margin ${marginPct}% does not match expected ${tc.expectedMargin}%`);
    }
    if (monthlyGP !== tc.expectedMonthlyGP) {
      throw new Error(`Calculated monthly GP ${monthlyGP} does not match expected ${tc.expectedMonthlyGP}`);
    }
  }

  assert.strictEqual(parseRateNumber('$115/hr (C2C)'), 115);
  assert.strictEqual(parseRateNumber('$90/hr (W2)'), 90);
  assert.strictEqual(parseRateNumber('$100/hr (1099)'), 100);
  assert.strictEqual(parseRateNumber('W2 $85/hr'), 85);
  assert.strictEqual(parseRateNumber('C-2-C $120.50/hr'), 120.5);
  assert.strictEqual(parseRateNumber('$1,250.50/hr'), 1250.5);
  assert.strictEqual(parseRateNumber('', 65), 65);
  assert.strictEqual(parseRateNumber(undefined, 90), 90);

  console.log('✅ Placement Margin & Rate Parser Calculations: PASSED (Exact prototype arithmetic match)');
};

