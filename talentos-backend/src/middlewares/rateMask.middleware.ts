import { Request, Response, NextFunction } from 'express';

export const maskFinancialRecord = (record: any): any => {
  if (!record || typeof record !== 'object') return record;

  if (Array.isArray(record)) {
    return record.map(maskFinancialRecord);
  }

  const masked = { ...record };

  if ('hourlyRateW2' in masked) masked.hourlyRateW2 = null;
  if ('hourlyRateC2c' in masked) masked.hourlyRateC2c = null;
  if ('hourlyRateDisplay' in masked) masked.hourlyRateDisplay = '••••••';
  if ('hourlyRate' in masked) masked.hourlyRate = '••••••';
  if ('billRate' in masked) masked.billRate = 0;
  if ('payRate' in masked) masked.payRate = 0;
  if ('hourlySpread' in masked) masked.hourlySpread = 0;
  if ('marginPct' in masked) masked.marginPct = 0;
  if ('billing' in masked) masked.billing = '••••••';

  // Recursively process nested relations
  for (const key of Object.keys(masked)) {
    if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskFinancialRecord(masked[key]);
    }
  }

  return masked;
};

export const rateMaskMiddleware = (req: Request, res: Response, next: NextFunction) => {
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

