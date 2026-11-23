import { Candidate } from '../types';
import {
  canonicalizeSkillExact,
  suggestSkillCorrection,
  type SkillTypoCorrection,
} from './skillMatcher';

type BoolAstNode =
  | { type: 'TERM'; value: string; quoted: boolean; expanded: string[]; canonical?: string }
  | { type: 'NOT'; child: BoolAstNode }
  | { type: 'AND'; children: BoolAstNode[] }
  | { type: 'OR'; children: BoolAstNode[] };

interface RawBoolToken {
  kind: 'TERM' | 'AND' | 'OR' | 'NOT' | 'LPAREN' | 'RPAREN';
  value: string;
  quoted?: boolean;
}

function tokenizeBooleanQuery(raw: string): RawBoolToken[] {
  const input = String(raw || '').trim();
  if (!input) return [];
  const tokens: RawBoolToken[] = [];
  let i = 0;

  while (i < input.length && tokens.length < 48) {
    const ch = input[i];
    if (/\s/.test(ch) || ch === ',') {
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'LPAREN', value: '(' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'RPAREN', value: ')' });
      i += 1;
      continue;
    }
    if (ch === '|' || ch === '&' || ch === '+') {
      tokens.push({ kind: ch === '|' ? 'OR' : 'AND', value: ch });
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < input.length && input[j] !== ch) j += 1;
      const phrase = input.slice(i + 1, j).trim();
      if (phrase) tokens.push({ kind: 'TERM', value: phrase, quoted: true });
      i = j < input.length ? j + 1 : j;
      continue;
    }
    if (ch === '-' && i + 1 < input.length && !/\s/.test(input[i + 1])) {
      tokens.push({ kind: 'NOT', value: '-' });
      i += 1;
      continue;
    }
    let j = i;
    while (j < input.length && !/[\s(),|&+]/.test(input[j])) j += 1;
    const word = input.slice(i, j).replace(/^,+|,+$/g, '').trim();
    i = j;
    if (!word) continue;
    const upper = word.toUpperCase();
    if (upper === 'AND') tokens.push({ kind: 'AND', value: 'AND' });
    else if (upper === 'OR') tokens.push({ kind: 'OR', value: 'OR' });
    else if (upper === 'NOT') tokens.push({ kind: 'NOT', value: 'NOT' });
    else tokens.push({ kind: 'TERM', value: word, quoted: false });
  }
  return tokens;
}

/**
 * Splits a boolean/multi-keyword candidate search query into search tokens for excerpt extraction.
 */
export function parseCandidateSearchTokens(search?: string): string[] {
  const tokens = tokenizeBooleanQuery(search || '');
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.kind === 'NOT') {
      i += 1; // skip negated term from highlight tokens
      continue;
    }
    if (tok.kind === 'TERM') {
      out.push(tok.value);
      if (out.length >= 12) break;
    }
  }
  return out;
}

export function parseBooleanSearchAst(
  search?: string,
  options?: { exactOnly?: boolean }
): { ast: BoolAstNode | null; corrections: SkillTypoCorrection[] } {
  const tokens = tokenizeBooleanQuery(search || '');
  if (tokens.length === 0) return { ast: null, corrections: [] };

  const corrections: SkillTypoCorrection[] = [];
  const seen = new Set<string>();
  const exactOnly = Boolean(options?.exactOnly);

  const makeTerm = (tok: RawBoolToken): BoolAstNode => {
    const expanded = new Set<string>([tok.value]);
    let canonical: string | undefined;
    if (!tok.quoted && !exactOnly) {
      canonical = canonicalizeSkillExact(tok.value);
      const corr = suggestSkillCorrection(tok.value);
      if (corr) {
        expanded.add(corr.display);
        canonical = corr.canonical;
        const k = `${tok.value.toLowerCase()}->${corr.canonical}`;
        if (!seen.has(k)) {
          seen.add(k);
          corrections.push(corr);
        }
      }
    }
    return {
      type: 'TERM',
      value: tok.value,
      quoted: Boolean(tok.quoted),
      expanded: Array.from(expanded),
      canonical,
    };
  };

  let cursor = 0;
  const peek = () => tokens[cursor];
  const consume = () => tokens[cursor++];

  const parseOr = (): BoolAstNode | null => {
    const first = parseAnd();
    if (!first) return null;
    const children: BoolAstNode[] = [first];
    while (peek()?.kind === 'OR') {
      consume();
      const right = parseAnd();
      if (right) children.push(right);
    }
    return children.length === 1 ? children[0] : { type: 'OR', children };
  };

  const parseAnd = (): BoolAstNode | null => {
    const first = parseNot();
    if (!first) return null;
    const children: BoolAstNode[] = [first];
    while (cursor < tokens.length) {
      const next = peek();
      if (!next || next.kind === 'OR' || next.kind === 'RPAREN') break;
      if (next.kind === 'AND') {
        consume();
        const right = parseNot();
        if (right) children.push(right);
        continue;
      }
      const right = parseNot();
      if (!right) break;
      children.push(right);
    }
    return children.length === 1 ? children[0] : { type: 'AND', children };
  };

  const parseNot = (): BoolAstNode | null => {
    if (peek()?.kind === 'NOT') {
      consume();
      const child = parseNot();
      return child ? { type: 'NOT', child } : null;
    }
    return parsePrimary();
  };

  const parsePrimary = (): BoolAstNode | null => {
    const tok = peek();
    if (!tok) return null;
    if (tok.kind === 'LPAREN') {
      consume();
      const inner = parseOr();
      if (peek()?.kind === 'RPAREN') consume();
      return inner;
    }
    if (tok.kind === 'TERM') {
      consume();
      return makeTerm(tok);
    }
    consume();
    return parsePrimary();
  };

  return { ast: parseOr(), corrections };
}

/**
 * Checks whether a candidate matches a Boolean query (AND / OR / NOT / quotes / typos)
 * across profile fields, normalizedSkills, and full resume text (rawSnippet).
 */
export function matchesCandidateQuery(
  c: Candidate,
  search?: string,
  options?: { exactOnly?: boolean }
): boolean {
  const { ast } = parseBooleanSearchAst(search, options);
  if (!ast) return true;

  const normalizedSet = new Set(
    Array.isArray(c.normalizedSkills)
      ? c.normalizedSkills.map((s) => canonicalizeSkillExact(s)).filter(Boolean)
      : []
  );

  const haystack = [
    c.fullName,
    c.skillset,
    c.currentTitle,
    c.workAuth,
    c.vendorName,
    c.rawSnippet,
    c.email,
    c.phone,
  ]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase();

  const evalNode = (node: BoolAstNode): boolean => {
    switch (node.type) {
      case 'TERM':
        return (
          node.expanded.some((term) => haystack.includes(term.toLowerCase())) ||
          (!node.quoted && Boolean(node.canonical) && normalizedSet.has(node.canonical!))
        );
      case 'NOT':
        return !evalNode(node.child);
      case 'AND':
        return node.children.every(evalNode);
      case 'OR':
        return node.children.some(evalNode);
    }
  };

  return evalNode(ast);
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

  const { ast } = parseBooleanSearchAst(search);
  const terms: string[] = [];
  const collect = (node: BoolAstNode | null) => {
    if (!node) return;
    if (node.type === 'TERM') terms.push(...node.expanded);
    else if (node.type === 'AND' || node.type === 'OR') node.children.forEach(collect);
  };
  collect(ast);

  const uniqueTerms = Array.from(new Set(terms));
  if (uniqueTerms.length === 0) return null;

  const lower = snippet.toLowerCase();
  const matched = uniqueTerms.find((tok) => lower.includes(tok.toLowerCase()));
  if (!matched) return null;

  const idx = lower.indexOf(matched.toLowerCase());
  const start = Math.max(0, idx - 32);
  const end = Math.min(snippet.length, idx + matched.length + 58);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < snippet.length ? '...' : '';
  return `${prefix}${snippet.slice(start, end).trim()}${suffix}`;
}
