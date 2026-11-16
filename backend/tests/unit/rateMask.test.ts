import assert from 'assert';
import { maskFinancialRecord, rateMaskMiddleware } from '../../src/middlewares/rateMask.middleware';

export const runRateMaskTests = () => {
  console.log('--- Running Rate Masking Security Tests ---');

  // Test Case 1: Sensitive candidate rates masked
  const candidate = {
    id: 'con_1',
    fullName: 'David Kim',
    hourlyRateW2: 120.0,
    hourlyRateC2c: 140.0,
    hourlyRateDisplay: '$120/hr (W2)',
    hourlyRate: '$120/hr (W2)',
    skillset: 'C++, Python'
  };

  const maskedCandidate = maskFinancialRecord(candidate);

  if (maskedCandidate.hourlyRateW2 !== null) {
    throw new Error('SECURITY VIOLATION: hourlyRateW2 was not scrubbed!');
  }
  if (maskedCandidate.hourlyRateC2c !== null) {
    throw new Error('SECURITY VIOLATION: hourlyRateC2c was not scrubbed!');
  }
  if (maskedCandidate.hourlyRateDisplay !== '••••••') {
    throw new Error('SECURITY VIOLATION: hourlyRateDisplay was not masked!');
  }
  if (maskedCandidate.fullName !== 'David Kim') {
    throw new Error('Non-financial data was corrupted during masking.');
  }

  // Test Case 2: Sensitive placement ledger rates and spreads masked
  const placement = {
    id: 'bill_1',
    customer: 'JPMorgan Chase & Co.',
    resourceName: 'David Kim',
    billRate: 145.0,
    payRate: 105.0,
    hourlySpread: 40.0,
    marginPct: 27.6,
    billing: '$145/hr'
  };

  const maskedPlacement = maskFinancialRecord(placement);

  if (maskedPlacement.billRate !== 0 || maskedPlacement.payRate !== 0) {
    throw new Error('SECURITY VIOLATION: billRate or payRate numeric leaked!');
  }
  if (maskedPlacement.hourlySpread !== 0 || maskedPlacement.marginPct !== 0) {
    throw new Error('SECURITY VIOLATION: hourlySpread or marginPct leaked!');
  }
  if (maskedPlacement.billing !== '••••••') {
    throw new Error('SECURITY VIOLATION: billing display was not masked!');
  }

  // Test Case 3: Nested arrays of records
  const list = [candidate, placement];
  const maskedList = maskFinancialRecord(list);

  if (maskedList[0].hourlyRate !== '••••••' || maskedList[1].billing !== '••••••') {
    throw new Error('SECURITY VIOLATION: Nested array items were not masked recursively!');
  }

  // Test Case 4: Aggregate dashboard financial metrics scrubbed
  const maskedMetrics = maskFinancialRecord({
    activeReqsCount: 12,
    totalMonthlyGrossProfit: 48000,
    avgHourlyMarginSpread: '35.50',
    avgMarginPercent: '28.4',
  });
  if (
    maskedMetrics.totalMonthlyGrossProfit !== 0 ||
    maskedMetrics.avgHourlyMarginSpread !== '0.00' ||
    maskedMetrics.avgMarginPercent !== '0.0' ||
    maskedMetrics.activeReqsCount !== 12
  ) {
    throw new Error('SECURITY VIOLATION: Aggregate dashboard financial metrics leaked!');
  }

  // Test Case 5: rateMaskMiddleware emits live sync headers and masks payload
  const headers: Record<string, string> = {};
  let capturedBody: any = null;
  let nextCalled = false;
  const mockReq: any = {
    user: { id: 'u1', role: 'TECHNICAL_RECRUITER', rateMasked: true },
  };
  const mockRes: any = {
    setHeader: (key: string, val: string) => {
      headers[key] = val;
    },
    json: (body: any) => {
      capturedBody = body;
      return mockRes;
    },
  };
  rateMaskMiddleware(mockReq, mockRes, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(headers['X-User-Role'], 'TECHNICAL_RECRUITER');
  assert.strictEqual(headers['X-Rate-Masked'], 'true');
  mockRes.json({ success: true, data: { billRate: 120, hourlyRate: '$100/hr' } });
  assert.strictEqual(capturedBody.data.billRate, 0);
  assert.strictEqual(capturedBody.data.hourlyRate, '••••••');

  console.log('✅ Rate Masking Security: PASSED (Zero financial figures leaked)');
};

