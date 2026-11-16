import { Request, Response, NextFunction } from 'express';

export const maskFinancialRecord = (record: any): any => {
  if (!record || typeof record !== 'object') return record;

  if (record instanceof Date) {
    return isNaN(record.getTime()) ? null : record.toISOString();
  }

  if (Array.isArray(record)) {
    return record.map(maskFinancialRecord);
  }

  // Preserve custom class instances (such as Prisma Decimal) via toJSON()
  if (record.constructor && record.constructor.name !== 'Object' && typeof record.toJSON === 'function') {
    return record.toJSON();
  }

  const masked: Record<string, any> = { ...record };

  if ('hourlyRateW2' in masked) masked.hourlyRateW2 = null;
  if ('hourlyRateC2c' in masked) masked.hourlyRateC2c = null;
  if ('hourlyRateDisplay' in masked) masked.hourlyRateDisplay = '••••••';
  if ('hourlyRate' in masked) masked.hourlyRate = '••••••';
  if ('billRate' in masked) masked.billRate = 0;
  if ('payRate' in masked) masked.payRate = 0;
  if ('targetBillRate' in masked) masked.targetBillRate = 0;
  if ('targetPayRate' in masked) masked.targetPayRate = 0;
  if ('maxBillRate' in masked) masked.maxBillRate = 0;
  if ('hourlySpread' in masked) masked.hourlySpread = 0;
  if ('marginPct' in masked) masked.marginPct = 0;
  if ('billing' in masked) masked.billing = '••••••';
  if ('totalMonthlyGrossProfit' in masked) masked.totalMonthlyGrossProfit = 0;
  if ('avgHourlyMarginSpread' in masked) masked.avgHourlyMarginSpread = '0.00';
  if ('avgMarginPercent' in masked) masked.avgMarginPercent = '0.0';

  // Recursively process nested relations
  for (const key of Object.keys(masked)) {
    const val = masked[key];
    if (val instanceof Date) {
      masked[key] = isNaN(val.getTime()) ? null : val.toISOString();
    } else if (typeof val === 'object' && val !== null) {
      masked[key] = maskFinancialRecord(val);
    }
  }

  return masked;
};

export const rateMaskMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.user) {
    res.setHeader('X-User-Role', req.user.role);
    res.setHeader('X-Rate-Masked', String(Boolean(req.user.rateMasked)));
  }

  const originalJson = res.json;

  res.json = function (body: any) {
    if (req.user && req.user.rateMasked && body) {
      if (body.data) {
        body.data = maskFinancialRecord(body.data);
      } else {
        body = maskFinancialRecord(body);
      }
    }
    return originalJson.call(this, body);
  };

  next();
};

