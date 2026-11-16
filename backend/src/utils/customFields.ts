import { Prisma } from '@prisma/client';

/**
 * Normalizes custom field payloads from JSON or stringified JSON into Prisma InputJsonValue.
 */
export function parseCustomFields(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Prisma.InputJsonValue;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.InputJsonValue;
  }
  return undefined;
}
