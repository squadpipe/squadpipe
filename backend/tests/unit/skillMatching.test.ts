import assert from 'node:assert/strict';
import {
  canonicalizeSkillExact,
  evaluateNormalizedSkillOverlap,
  extractNormalizedSkills,
  normalizeSkillWithTypoFallback,
  suggestSkillCorrection,
  textContainsCanonicalSkill,
} from '../../src/utils/skillMatcher';
import {
  compileBooleanAstToPrismaWhere,
  compileBooleanAstToSql,
  parseBooleanSearchQuery,
} from '../../src/utils/booleanSearch';
import { buildCandidateWhereClause } from '../../src/services/candidate.service';

export const runSkillMatchingTests = () => {
  console.log('--- Running Skill Normalization, Typo & Boolean Search Tests ---');

  // 1. Canonical skill alias normalization across variants & punctuation
  assert.equal(canonicalizeSkillExact('React.js'), 'react');
  assert.equal(canonicalizeSkillExact('ReactJS'), 'react');
  assert.equal(canonicalizeSkillExact('React 18'), 'react');
  assert.equal(canonicalizeSkillExact('K8s'), 'kubernetes');
  assert.equal(canonicalizeSkillExact('C++'), 'cpp');
  assert.equal(canonicalizeSkillExact('C#'), 'csharp');
  assert.equal(canonicalizeSkillExact('.NET Core'), 'dotnet');
  assert.equal(canonicalizeSkillExact('Golang'), 'go');
  assert.equal(canonicalizeSkillExact('Postgres'), 'postgresql');
  assert.equal(canonicalizeSkillExact('React Native'), 'react native');

  // 2. Boundary safety in unstructured resume text (Java != JavaScript, Go != MongoDB)
  assert.equal(textContainsCanonicalSkill('built javascript and mongodb apps', 'java'), false);
  assert.equal(textContainsCanonicalSkill('built javascript and mongodb apps', 'go'), false);
  assert.equal(textContainsCanonicalSkill('backend services in c++ and .net core', 'cpp'), true);
  assert.equal(textContainsCanonicalSkill('backend services in c++ and .net core', 'dotnet'), true);

  // 3. Extract normalizedSkills array cleanly from mixed profile + resume + typo skill tags
  const extracted = extractNormalizedSkills({
    currentTitle: 'Senior Fullstack Developer',
    skillset: 'Rect, ReactJS, C++, K8s',
    rawSnippet: 'Built production TypeScript and PostgreSQL microservices on AWS.',
  });
  assert.ok(extracted.includes('react'));
  assert.ok(extracted.includes('cpp'));
  assert.ok(extracted.includes('kubernetes'));
  assert.ok(extracted.includes('typescript'));
  assert.ok(extracted.includes('postgresql'));
  assert.ok(extracted.includes('aws'));
  assert.equal(extracted.includes('java'), false);

  // 4. Typo auto-correction ("Rect" -> "React", "Raect" -> "React", "Kuberntes" -> "Kubernetes")
  const rectFix = suggestSkillCorrection('Rect');
  assert.ok(rectFix);
  assert.equal(rectFix.canonical, 'react');
  assert.equal(rectFix.display, 'React');
  assert.equal(rectFix.distance, 1);

  const raectFix = suggestSkillCorrection('Raect');
  assert.ok(raectFix);
  assert.equal(raectFix.canonical, 'react');

  const k8sFix = suggestSkillCorrection('Kuberntes');
  assert.ok(k8sFix);
  assert.equal(k8sFix.canonical, 'kubernetes');

  const tsFix = suggestSkillCorrection('Typescrpt');
  assert.ok(tsFix);
  assert.equal(tsFix.canonical, 'typescript');

  // Short-token & common-word/name safety guards
  assert.equal(suggestSkillCorrection('Ax'), null);
  assert.equal(suggestSkillCorrection('John'), null);
  assert.equal(suggestSkillCorrection('Rest'), null);
  assert.equal(normalizeSkillWithTypoFallback('React.js').canonical, 'react');

  // 5. True Boolean query parsing (AND / OR / NOT / -term / quotes / typo expansion)
  const orQuery = parseBooleanSearchQuery('React OR Angular OR Vue');
  assert.equal(orQuery.ast?.type, 'OR');
  assert.equal(orQuery.ast?.type === 'OR' ? orQuery.ast.children.length : 0, 3);

  const complexQuery = parseBooleanSearchQuery('(React OR Vue) AND TypeScript -Intern');
  assert.equal(complexQuery.ast?.type, 'AND');
  const complexPrisma = compileBooleanAstToPrismaWhere(complexQuery.ast);
  assert.ok(complexPrisma && Array.isArray((complexPrisma as any).AND));
  const complexSql = compileBooleanAstToSql(complexQuery.ast);
  assert.ok(complexSql);

  const typoQuery = parseBooleanSearchQuery('Rect AND TypeScript');
  assert.equal(typoQuery.corrections.length, 1);
  assert.equal(typoQuery.corrections[0].from, 'Rect');
  assert.equal(typoQuery.corrections[0].display, 'React');
  const typoNode = typoQuery.ast?.type === 'AND' ? typoQuery.ast.children[0] : null;
  assert.ok(typoNode?.type === 'TERM' && typoNode.expandedTerms.includes('React'));
  assert.ok(typoNode?.type === 'TERM' && typoNode.expandedTerms.includes('Rect'));

  const exactOnlyQuery = parseBooleanSearchQuery('Rect', { exactOnly: true });
  assert.equal(exactOnlyQuery.corrections.length, 0);

  const orPrecedenceWhere = buildCandidateWhereClause({
    tenantId: 't1',
    search: 'Java OR Kotlin NOT Junior',
  });
  assert.ok(Array.isArray(orPrecedenceWhere.AND) && orPrecedenceWhere.AND.length === 1);
  assert.ok(Array.isArray((orPrecedenceWhere.AND[0] as any).OR));

  const orGroupedWhere = buildCandidateWhereClause({
    tenantId: 't1',
    search: '(Java OR Kotlin) NOT Junior',
  });
  assert.ok(Array.isArray(orGroupedWhere.AND) && orGroupedWhere.AND.length === 2);

  // Ensure NOT branches guard nullable columns (rawSnippet, phone) against SQL NULL poisoning
  const notNode = (orGroupedWhere.AND[1] as any).NOT;
  assert.ok(notNode && Array.isArray(notNode.OR));
  assert.ok(notNode.OR.some((cond: any) => Array.isArray(cond.AND) && cond.AND.some((sub: any) => sub.rawSnippet?.not === null)));

  // 6. End-to-end normalized skill overlap handles typos + aliases seamlessly
  const overlap = evaluateNormalizedSkillOverlap({
    requiredSkillsCsv: 'Rect, K8s, C++, .NET',
    candidateSkillset: 'React.js, Kubernetes, C++, ASP.NET',
    candidateNormalizedSkills: ['react', 'kubernetes', 'cpp', 'dotnet'],
  });
  assert.equal(overlap.score, 100);
  assert.equal(overlap.matched.length, 4);
  assert.equal(overlap.missing.length, 0);
  assert.equal(overlap.corrections[0]?.from, 'Rect');
  assert.equal(overlap.corrections[0]?.display, 'React');

  console.log('✅ Skill Normalization, Typo & Boolean Search Tests: PASSED');
};
