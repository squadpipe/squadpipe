import { MULTI_INDUSTRY_SKILLS_TAXONOMY } from './skillsTaxonomy';

export interface SkillTypoCorrection {
  from: string;
  canonical: string;
  display: string;
  distance: number;
}

const CANONICAL_ALIASES: Array<{ canonical: string; display: string; aliases: string[] }> = [
  { canonical: 'aws', display: 'AWS', aliases: ['aws', 'amazon web services', 'amazon aws'] },
  { canonical: 'azure', display: 'Azure', aliases: ['azure', 'microsoft azure', 'ms azure'] },
  { canonical: 'gcp', display: 'GCP', aliases: ['gcp', 'google cloud', 'google cloud platform'] },
  { canonical: 'kubernetes', display: 'Kubernetes', aliases: ['kubernetes', 'k8s', 'kube'] },
  { canonical: 'docker', display: 'Docker', aliases: ['docker', 'docker containers'] },
  { canonical: 'terraform', display: 'Terraform', aliases: ['terraform', 'tf'] },
  { canonical: 'helm', display: 'Helm', aliases: ['helm', 'helm charts'] },
  { canonical: 'ci/cd', display: 'CI/CD', aliases: ['ci/cd', 'cicd', 'ci cd', 'ci-cd'] },
  { canonical: 'github actions', display: 'GitHub Actions', aliases: ['github actions', 'gh actions'] },
  { canonical: 'snowflake', display: 'Snowflake', aliases: ['snowflake', 'snowflake db'] },
  { canonical: 'pyspark', display: 'PySpark', aliases: ['pyspark', 'py spark'] },
  { canonical: 'apache spark', display: 'Apache Spark', aliases: ['apache spark', 'spark'] },
  { canonical: 'apache airflow', display: 'Apache Airflow', aliases: ['apache airflow', 'airflow'] },
  { canonical: 'kafka', display: 'Kafka', aliases: ['kafka', 'apache kafka', 'confluent kafka'] },
  { canonical: 'sql', display: 'SQL', aliases: ['sql', 't-sql', 'tsql', 'ansi sql'] },
  { canonical: 'pl/sql', display: 'PL/SQL', aliases: ['pl/sql', 'plsql'] },
  { canonical: 'postgresql', display: 'PostgreSQL', aliases: ['postgresql', 'postgres', 'pgsql'] },
  { canonical: 'mongodb', display: 'MongoDB', aliases: ['mongodb', 'mongo'] },
  { canonical: 'power bi', display: 'Power BI', aliases: ['power bi', 'powerbi'] },
  { canonical: 'machine learning', display: 'Machine Learning', aliases: ['machine learning', 'ml'] },
  { canonical: 'llm', display: 'LLM', aliases: ['llm', 'llms', 'large language models'] },
  { canonical: 'genai', display: 'Generative AI', aliases: ['genai', 'gen ai', 'generative ai'] },
  { canonical: 'scikit-learn', display: 'Scikit-learn', aliases: ['scikit-learn', 'scikit learn', 'sklearn'] },
  { canonical: 'python', display: 'Python', aliases: ['python', 'python3'] },
  { canonical: 'java', display: 'Java', aliases: ['java', 'java 8', 'java 11', 'java 17', 'java 21', 'j2ee'] },
  { canonical: 'spring boot', display: 'Spring Boot', aliases: ['spring boot', 'springboot', 'spring framework'] },
  { canonical: 'node.js', display: 'Node.js', aliases: ['node.js', 'nodejs', 'node js', 'node'] },
  { canonical: 'express.js', display: 'Express.js', aliases: ['express.js', 'expressjs', 'express'] },
  { canonical: 'typescript', display: 'TypeScript', aliases: ['typescript', 'ts'] },
  { canonical: 'javascript', display: 'JavaScript', aliases: ['javascript', 'js', 'ecmascript', 'es6'] },
  { canonical: 'react', display: 'React', aliases: ['react', 'react.js', 'reactjs', 'react js', 'react 18', 'react 19'] },
  { canonical: 'react native', display: 'React Native', aliases: ['react native', 'react-native'] },
  { canonical: 'next.js', display: 'Next.js', aliases: ['next.js', 'nextjs', 'next js'] },
  { canonical: 'vue', display: 'Vue', aliases: ['vue', 'vue.js', 'vuejs', 'vue 3'] },
  { canonical: 'angular', display: 'Angular', aliases: ['angular', 'angularjs', 'angular.js'] },
  { canonical: 'tailwind css', display: 'Tailwind CSS', aliases: ['tailwind css', 'tailwindcss', 'tailwind'] },
  { canonical: 'go', display: 'Go', aliases: ['go', 'golang', 'go lang'] },
  { canonical: 'cpp', display: 'C++', aliases: ['c++', 'cpp'] },
  { canonical: 'csharp', display: 'C#', aliases: ['c#', 'csharp', 'c-sharp'] },
  { canonical: 'dotnet', display: '.NET', aliases: ['.net', 'dotnet', 'asp.net', '.net core', 'dotnet core', '.net 8'] },
  { canonical: 'ruby on rails', display: 'Ruby on Rails', aliases: ['ruby on rails', 'rails', 'ror'] },
  { canonical: 'rest api', display: 'REST API', aliases: ['rest api', 'rest apis', 'restful', 'restful api', 'restful apis'] },
  { canonical: 'microservices', display: 'Microservices', aliases: ['microservices', 'microservice'] },
  { canonical: 's/4hana', display: 'S/4HANA', aliases: ['s/4hana', 's4hana', 's/4 hana'] },
  { canonical: 'salesforce', display: 'Salesforce', aliases: ['salesforce', 'sfdc', 'salesforce crm'] },
  { canonical: 'servicenow', display: 'ServiceNow', aliases: ['servicenow', 'service now', 'snow'] },
  { canonical: 'excel', display: 'Microsoft Excel', aliases: ['microsoft excel', 'ms excel', 'excel'] },
  { canonical: 'ui/ux', display: 'UI/UX', aliases: ['ui/ux', 'ui ux', 'ux/ui'] },
];

const SEARCH_CORRECTION_STOPWORDS = new Set([
  'john', 'jane', 'mark', 'paul', 'dave', 'mike', 'alex', 'ryan', 'adam', 'eric',
  'rest', 'test', 'work', 'role', 'lead', 'team', 'core', 'data', 'user', 'best',
  'fast', 'good', 'open', 'code', 'full', 'part', 'hire', 'time', 'year', 'long',
  'high', 'name', 'city', 'firm', 'east', 'west', 'line', 'task', 'plan', 'list',
  'junior', 'senior', 'intern', 'remote', 'hybrid', 'onsite', 'contract', 'billable',
  'bench', 'manager', 'director', 'engineer', 'developer', 'architect', 'analyst',
  'consultant', 'principal', 'associate', 'staff',
]);

const ALIAS_TO_CANONICAL = new Map<string, string>();
const DISPLAY_BY_CANONICAL = new Map<string, string>();
const FUZZY_KEYS: Array<{ key: string; canonical: string; display: string }> = [];

function registerEntry(canonical: string, display: string, aliases: string[]) {
  if (!DISPLAY_BY_CANONICAL.has(canonical)) {
    DISPLAY_BY_CANONICAL.set(canonical, display);
  }
  const seen = new Set<string>();
  for (const raw of [canonical, display, ...aliases]) {
    const clean = raw.trim().toLowerCase();
    if (!clean) continue;
    if (!ALIAS_TO_CANONICAL.has(clean)) ALIAS_TO_CANONICAL.set(clean, canonical);
    const compact = clean.replace(/[\s.-]+/g, '');
    if (compact.length >= 2 && !ALIAS_TO_CANONICAL.has(compact)) {
      ALIAS_TO_CANONICAL.set(compact, canonical);
    }
    if (/^[a-z0-9.+/#-]+$/.test(clean) && !seen.has(clean)) {
      seen.add(clean);
      FUZZY_KEYS.push({ key: clean, canonical, display });
    }
  }
}

for (const entry of CANONICAL_ALIASES) {
  registerEntry(entry.canonical, entry.display, entry.aliases);
}
for (const taxSkill of MULTI_INDUSTRY_SKILLS_TAXONOMY) {
  const lower = taxSkill.trim().toLowerCase();
  const canonical = ALIAS_TO_CANONICAL.get(lower) || lower;
  const display = DISPLAY_BY_CANONICAL.get(canonical) || taxSkill.trim();
  registerEntry(canonical, display, [taxSkill]);
}

export function damerauLevenshtein(aRaw: string, bRaw: string): number {
  const a = aRaw.toLowerCase();
  const b = bRaw.toLowerCase();
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;
  if (a === b) return 0;

  const dp: number[][] = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0));
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
    }
  }
  return dp[lenA][lenB];
}

export function canonicalizeSkillExact(rawSkill: string): string {
  const cleaned = String(rawSkill || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const direct = ALIAS_TO_CANONICAL.get(cleaned);
  if (direct) return direct;
  const verStripped = cleaned.replace(/\s+v?\d+(?:\.\d+)*$/, '').trim();
  if (verStripped && verStripped !== cleaned) {
    const verMatch = ALIAS_TO_CANONICAL.get(verStripped);
    if (verMatch) return verMatch;
  }
  const compact = cleaned.replace(/[\s.-]+/g, '');
  if (compact.length >= 2) {
    const compactMatch = ALIAS_TO_CANONICAL.get(compact);
    if (compactMatch) return compactMatch;
  }
  return cleaned;
}

export function suggestSkillCorrection(
  rawTerm: string,
  options?: { allowSearchStopwords?: boolean }
): SkillTypoCorrection | null {
  const cleaned = String(rawTerm || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length < 3) return null;
  if (ALIAS_TO_CANONICAL.has(cleaned)) return null;
  const compact = cleaned.replace(/[\s.-]+/g, '');
  if (compact.length >= 2 && ALIAS_TO_CANONICAL.has(compact)) return null;
  if (!options?.allowSearchStopwords && SEARCH_CORRECTION_STOPWORDS.has(cleaned)) return null;

  const maxDist = cleaned.length <= 6 ? 1 : 2;
  let best: { canonical: string; display: string; distance: number; score: number } | null = null;

  for (const cand of FUZZY_KEYS) {
    if (Math.abs(cand.key.length - cleaned.length) > maxDist) continue;
    if (cleaned.length <= 5) {
      const sameFirst = cand.key[0] === cleaned[0];
      const sameLast = cand.key[cand.key.length - 1] === cleaned[cleaned.length - 1];
      if (!sameFirst && !sameLast) continue;
    }
    const dist = damerauLevenshtein(cleaned, cand.key);
    if (dist === 0 || dist > maxDist) continue;
    if (dist === 2 && (cleaned.length < 7 || cand.key.length < 7 || cand.key[0] !== cleaned[0])) {
      continue;
    }

    const score =
      10 - dist * 3 + (cand.key[0] === cleaned[0] ? 0.4 : 0) + (cand.key === cand.canonical ? 0.2 : 0);
    if (!best || score > best.score) {
      best = { canonical: cand.canonical, display: cand.display, distance: dist, score };
    }
  }

  if (!best) return null;
  return {
    from: String(rawTerm).trim(),
    canonical: best.canonical,
    display: best.display,
    distance: best.distance,
  };
}

export function getFuzzySkillSuggestions(query: string, excludeLowerSet: Set<string>, limit = 12): Array<{ label: string; correctedFrom?: string }> {
  const q = query.trim().toLowerCase();
  const available = MULTI_INDUSTRY_SKILLS_TAXONOMY.filter((s) => !excludeLowerSet.has(s.toLowerCase()));
  if (!q) return available.slice(0, limit).map((label) => ({ label }));

  const startsWith: Array<{ label: string }> = [];
  const contains: Array<{ label: string }> = [];
  for (const s of available) {
    const lower = s.toLowerCase();
    if (lower.startsWith(q)) startsWith.push({ label: s });
    else if (lower.includes(q)) contains.push({ label: s });
  }
  const direct = [...startsWith, ...contains];
  if (direct.length > 0) return direct.slice(0, limit);

  if (q.length >= 3) {
    const correction = suggestSkillCorrection(q, { allowSearchStopwords: true });
    if (correction && !excludeLowerSet.has(correction.display.toLowerCase())) {
      return [{ label: correction.display, correctedFrom: query.trim() }];
    }
  }
  return [];
}

export function textContainsCanonicalSkill(textLower: string, canonical: string): boolean {
  if (!textLower || !canonical) return false;
  const entry = CANONICAL_ALIASES.find((e) => e.canonical === canonical);
  const terms = entry ? Array.from(new Set([entry.canonical, ...entry.aliases])) : [canonical];
  for (const term of terms) {
    const needle = term.trim().toLowerCase();
    if (!needle) continue;
    if (needle.length <= 2 && needle !== 'go' && needle !== 'c#' && needle !== 'ai' && needle !== 'ml') {
      continue;
    }
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');
      if (re.test(textLower)) return true;
    } catch {
      if (textLower.includes(needle)) return true;
    }
  }
  return false;
}
