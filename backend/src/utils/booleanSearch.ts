import { Prisma } from '@prisma/client';
import {
  canonicalizeSkillExact,
  suggestSkillCorrection,
  type SkillTypoCorrection,
} from './skillMatcher';

export type BooleanQueryNode =
  | {
      type: 'TERM';
      value: string;
      quoted: boolean;
      expandedTerms: string[];
      canonicalSlug?: string;
    }
  | { type: 'NOT'; child: BooleanQueryNode }
  | { type: 'AND'; children: BooleanQueryNode[] }
  | { type: 'OR'; children: BooleanQueryNode[] };

export interface ParsedBooleanSearch {
  ast: BooleanQueryNode | null;
  flatTokens: string[];
  corrections: SkillTypoCorrection[];
}

interface RawToken {
  kind: 'TERM' | 'AND' | 'OR' | 'NOT' | 'LPAREN' | 'RPAREN';
  value: string;
  quoted?: boolean;
}

/**
 * Tokenizes boolean search strings supporting quotes, parentheses, AND, OR, NOT, and -term.
 */
function tokenizeBooleanQuery(raw: string): RawToken[] {
  const input = String(raw || '').trim();
  if (!input) return [];

  const tokens: RawToken[] = [];
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
      const quoteChar = ch;
      let j = i + 1;
      while (j < input.length && input[j] !== quoteChar) j += 1;
      const phrase = input.slice(i + 1, j).trim();
      if (phrase) {
        tokens.push({ kind: 'TERM', value: phrase, quoted: true });
      }
      i = j < input.length ? j + 1 : j;
      continue;
    }

    // Check unary NOT prefix like -Intern or -"Part Time"
    if (ch === '-' && i + 1 < input.length && !/\s/.test(input[i + 1])) {
      tokens.push({ kind: 'NOT', value: '-' });
      i += 1;
      continue;
    }

    let j = i;
    while (j < input.length && !/[\s(),|&+]/.test(input[j])) {
      j += 1;
    }
    const word = input.slice(i, j).replace(/^,+|,+$/g, '').trim();
    i = j;
    if (!word) continue;

    const upper = word.toUpperCase();
    if (upper === 'AND') {
      tokens.push({ kind: 'AND', value: 'AND' });
    } else if (upper === 'OR') {
      tokens.push({ kind: 'OR', value: 'OR' });
    } else if (upper === 'NOT') {
      tokens.push({ kind: 'NOT', value: 'NOT' });
    } else {
      tokens.push({ kind: 'TERM', value: word, quoted: false });
    }
  }

  return tokens;
}

/**
 * Parses a recruiter Boolean search string into an AST and optionally applies safe skill typo expansion
 * (expanding `Rect` -> `Rect OR React` so literal names/emails never break while typos still match).
 */
export function parseBooleanSearchQuery(
  rawSearch?: string,
  options?: { exactOnly?: boolean }
): ParsedBooleanSearch {
  const rawTokens = tokenizeBooleanQuery(rawSearch || '');
  if (rawTokens.length === 0) {
    return { ast: null, flatTokens: [], corrections: [] };
  }

  const flatTokens: string[] = [];
  const corrections: SkillTypoCorrection[] = [];
  const seenCorrections = new Set<string>();
  const exactOnly = Boolean(options?.exactOnly);

  const makeTermNode = (tok: RawToken): BooleanQueryNode => {
    const cleanVal = tok.value.trim();
    if (flatTokens.length < 16) flatTokens.push(cleanVal);

    const expanded = new Set<string>([cleanVal]);
    let canonicalSlug: string | undefined;

    if (!tok.quoted && !exactOnly) {
      const exactCanonical = canonicalizeSkillExact(cleanVal);
      if (exactCanonical !== cleanVal.toLowerCase()) {
        canonicalSlug = exactCanonical;
      }
      const correction = suggestSkillCorrection(cleanVal);
      if (correction) {
        expanded.add(correction.display);
        canonicalSlug = correction.canonical;
        const corrKey = `${cleanVal.toLowerCase()}->${correction.canonical}`;
        if (!seenCorrections.has(corrKey)) {
          seenCorrections.add(corrKey);
          corrections.push(correction);
        }
      } else if (exactCanonical) {
        canonicalSlug = exactCanonical;
      }
    } else if (!tok.quoted) {
      canonicalSlug = canonicalizeSkillExact(cleanVal);
    }

    return {
      type: 'TERM',
      value: cleanVal,
      quoted: Boolean(tok.quoted),
      expandedTerms: Array.from(expanded),
      canonicalSlug,
    };
  };

  let cursor = 0;
  const peek = () => rawTokens[cursor];
  const consume = () => rawTokens[cursor++];

  const parseOr = (): BooleanQueryNode | null => {
    const first = parseAnd();
    if (!first) return null;
    const children: BooleanQueryNode[] = [first];
    while (peek()?.kind === 'OR') {
      consume();
      const right = parseAnd();
      if (right) children.push(right);
    }
    return children.length === 1 ? children[0] : { type: 'OR', children };
  };

  const parseAnd = (): BooleanQueryNode | null => {
    const first = parseNot();
    if (!first) return null;
    const children: BooleanQueryNode[] = [first];
    while (cursor < rawTokens.length) {
      const next = peek();
      if (!next || next.kind === 'OR' || next.kind === 'RPAREN') break;
      if (next.kind === 'AND') {
        consume();
        const right = parseNot();
        if (right) children.push(right);
        continue;
      }
      const implicitRight = parseNot();
      if (!implicitRight) break;
      children.push(implicitRight);
    }
    return children.length === 1 ? children[0] : { type: 'AND', children };
  };

  const parseNot = (): BooleanQueryNode | null => {
    if (peek()?.kind === 'NOT') {
      consume();
      const child = parseNot();
      return child ? { type: 'NOT', child } : null;
    }
    return parsePrimary();
  };

  const parsePrimary = (): BooleanQueryNode | null => {
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
      return makeTermNode(tok);
    }
    // Skip stray operators gracefully
    consume();
    return parsePrimary();
  };

  const ast = parseOr();
  return { ast, flatTokens, corrections };
}

/**
 * Compiles a Boolean AST into a Prisma `CandidateWhereInput` tree across profile fields,
 * normalized skill tags, vendor name, and full resume snippet.
 */
export function compileBooleanAstToPrismaWhere(
  node: BooleanQueryNode | null,
  options?: { includeNormalizedSkills?: boolean; insideNot?: boolean }
): Prisma.CandidateWhereInput | null {
  if (!node) return null;
  const includeNorm = options?.includeNormalizedSkills !== false;
  const insideNot = Boolean(options?.insideNot);

  const compileTerm = (
    term: string,
    canonicalSlug?: string,
    quoted?: boolean
  ): Prisma.CandidateWhereInput => {
    const phoneCond: Prisma.CandidateWhereInput = insideNot
      ? { AND: [{ phone: { not: null } }, { phone: { contains: term, mode: 'insensitive' } }] }
      : { phone: { contains: term, mode: 'insensitive' } };
    const snippetCond: Prisma.CandidateWhereInput = insideNot
      ? { AND: [{ rawSnippet: { not: null } }, { rawSnippet: { contains: term, mode: 'insensitive' } }] }
      : { rawSnippet: { contains: term, mode: 'insensitive' } };

    const orList: Prisma.CandidateWhereInput[] = [
      { fullName: { contains: term, mode: 'insensitive' } },
      { skillset: { contains: term, mode: 'insensitive' } },
      { currentTitle: { contains: term, mode: 'insensitive' } },
      { workAuth: { contains: term, mode: 'insensitive' } },
      snippetCond,
      { email: { contains: term, mode: 'insensitive' } },
      phoneCond,
      { vendor: { name: { contains: term, mode: 'insensitive' } } },
    ];
    if (includeNorm && !quoted && canonicalSlug) {
      orList.push({ normalizedSkills: { hasEvery: [canonicalSlug] } });
    }
    return { OR: orList };
  };

  switch (node.type) {
    case 'TERM': {
      if (node.expandedTerms.length <= 1) {
        return compileTerm(node.value, node.canonicalSlug, node.quoted);
      }
      const variants = node.expandedTerms.map((variant) =>
        compileTerm(variant, node.canonicalSlug, node.quoted)
      );
      return { OR: variants };
    }
    case 'NOT': {
      const childWhere = compileBooleanAstToPrismaWhere(node.child, {
        ...options,
        insideNot: !insideNot,
      });
      return childWhere ? { NOT: childWhere } : null;
    }
    case 'AND': {
      const compiled = node.children
        .map((c) => compileBooleanAstToPrismaWhere(c, options))
        .filter((w): w is Prisma.CandidateWhereInput => Boolean(w));
      if (compiled.length === 0) return null;
      return compiled.length === 1 ? compiled[0] : { AND: compiled };
    }
    case 'OR': {
      const compiled = node.children
        .map((c) => compileBooleanAstToPrismaWhere(c, options))
        .filter((w): w is Prisma.CandidateWhereInput => Boolean(w));
      if (compiled.length === 0) return null;
      return compiled.length === 1 ? compiled[0] : { OR: compiled };
    }
  }
}

/**
 * Compiles a Boolean AST into a parameterized PostgreSQL `Prisma.Sql` expression on `Candidate` alias `c`.
 */
export function compileBooleanAstToSql(
  node: BooleanQueryNode | null,
  options?: { includeNormalizedSkills?: boolean }
): Prisma.Sql | null {
  if (!node) return null;
  const includeNorm = options?.includeNormalizedSkills !== false;

  const compileSingleTermSql = (
    term: string,
    canonicalSlug?: string,
    quoted?: boolean
  ): Prisma.Sql => {
    const pattern = `%${term}%`;
    const baseOr: Prisma.Sql[] = [
      Prisma.sql`COALESCE(c."fullName", '') ILIKE ${pattern}`,
      Prisma.sql`COALESCE(c."skillset", '') ILIKE ${pattern}`,
      Prisma.sql`COALESCE(c."currentTitle", '') ILIKE ${pattern}`,
      Prisma.sql`COALESCE(c."workAuth", '') ILIKE ${pattern}`,
      Prisma.sql`COALESCE(c."rawSnippet", '') ILIKE ${pattern}`,
      Prisma.sql`COALESCE(c."email", '') ILIKE ${pattern}`,
      Prisma.sql`COALESCE(c."phone", '') ILIKE ${pattern}`,
    ];
    if (includeNorm && !quoted && canonicalSlug) {
      baseOr.push(Prisma.sql`c."normalizedSkills" @> ARRAY[${canonicalSlug}]::text[]`);
    }
    return Prisma.sql`(${Prisma.join(baseOr, ' OR ')})`;
  };

  switch (node.type) {
    case 'TERM': {
      if (node.expandedTerms.length <= 1) {
        return compileSingleTermSql(node.value, node.canonicalSlug, node.quoted);
      }
      const variants = node.expandedTerms.map((variant) =>
        compileSingleTermSql(variant, node.canonicalSlug, node.quoted)
      );
      return Prisma.sql`(${Prisma.join(variants, ' OR ')})`;
    }
    case 'NOT': {
      const childSql = compileBooleanAstToSql(node.child, options);
      return childSql ? Prisma.sql`NOT COALESCE((${childSql}), FALSE)` : null;
    }
    case 'AND': {
      const parts = node.children
        .map((c) => compileBooleanAstToSql(c, options))
        .filter((s): s is Prisma.Sql => Boolean(s));
      if (parts.length === 0) return null;
      return parts.length === 1 ? parts[0] : Prisma.sql`(${Prisma.join(parts, ' AND ')})`;
    }
    case 'OR': {
      const parts = node.children
        .map((c) => compileBooleanAstToSql(c, options))
        .filter((s): s is Prisma.Sql => Boolean(s));
      if (parts.length === 0) return null;
      return parts.length === 1 ? parts[0] : Prisma.sql`(${Prisma.join(parts, ' OR ')})`;
    }
  }
}
