/**
 * Extracts the numeric hourly rate from strings such as "$115/hr (C2C)",
 * "$90/hr (W2)", or "$100/hr (1099)" without concatenating contract-type digits.
 */
export function parseRateNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : fallback;
  }
  const cleaned = String(val ?? '')
    .replace(/(?:W-?2|C-?2-?C|1099)/gi, ' ')
    .replace(/,/g, '')
    .trim();
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return fallback;
  const parsed = parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}
