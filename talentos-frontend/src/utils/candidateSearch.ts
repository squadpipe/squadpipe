import { Candidate } from '../types';

/**
 * Splits a boolean/multi-keyword candidate search query into AND-required tokens,
 * preserving quoted phrases and stripping explicit AND / & / + connectors.
 */
export function parseCandidateSearchTokens(search?: string): string[] {
  const raw = String(search || '').trim();
  if (!raw) return [];

  const tokens: string[] = [];
  const regex = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const token = (match[1] ?? match[2] ?? '').replace(/^,+|,+$/g, '').trim();
    if (!token) continue;
    const upper = token.toUpperCase();
    if (upper === 'AND' || token === '&' || token === '+') continue;
    tokens.push(token);
    if (tokens.length >= 8) break;
  }
  return tokens;
}

/**
 * Checks whether a candidate matches EVERY token across profile fields AND full resume text (rawSnippet).
 */
export function matchesCandidateQuery(c: Candidate, search?: string): boolean {
  const tokens = parseCandidateSearchTokens(search);
  if (tokens.length === 0) return true;

  const haystack = [
    c.fullName,
    c.skillset,
    c.currentTitle,
    c.workAuth,
    c.rawSnippet,
    c.email,
    c.phone,
  ]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase();

  return tokens.every((tok) => haystack.includes(tok.toLowerCase()));
}

/**
 * Parses numeric hourly rate from a candidate's formatted rate string (e.g. "$95/hr (W2)").
 */
export function parseCandidateHourlyRate(hourlyRate?: string): number | null {
  if (!hourlyRate || hourlyRate.includes('•')) return null;
  const match = String(hourlyRate).match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Extracts a compact excerpt from rawSnippet highlighting where the search term matched.
 */
export function extractResumeMatchExcerpt(rawSnippet?: string, search?: string): string | null {
  const snippet = String(rawSnippet || '').replace(/\s+/g, ' ').trim();
  if (!snippet) return null;

  const tokens = parseCandidateSearchTokens(search);
  if (tokens.length === 0) return null;

  const lower = snippet.toLowerCase();
  const matched = tokens.find((tok) => lower.includes(tok.toLowerCase()));
  if (!matched) return null;

  const idx = lower.indexOf(matched.toLowerCase());
  const start = Math.max(0, idx - 32);
  const end = Math.min(snippet.length, idx + matched.length + 58);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < snippet.length ? '...' : '';
  return `${prefix}${snippet.slice(start, end).trim()}${suffix}`;
}
