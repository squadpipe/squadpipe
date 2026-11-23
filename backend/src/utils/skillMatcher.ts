export interface SkillDefinition {
  canonical: string;
  display: string;
  aliases: string[];
  allowInFreeText?: boolean;
}

export interface SkillTypoCorrection {
  from: string;
  canonical: string;
  display: string;
  distance: number;
}

export interface NormalizedSkillResult {
  canonical: string;
  display: string;
  matchedViaTypo?: boolean;
  originalInput: string;
}

const CANONICAL_SKILL_DEFINITIONS: SkillDefinition[] = [
  // Cloud, DevOps & Infrastructure
  { canonical: 'aws', display: 'AWS', aliases: ['aws', 'amazon web services', 'amazon aws'] },
  { canonical: 'azure', display: 'Azure', aliases: ['azure', 'microsoft azure', 'ms azure'] },
  { canonical: 'gcp', display: 'GCP', aliases: ['gcp', 'google cloud', 'google cloud platform'] },
  { canonical: 'kubernetes', display: 'Kubernetes', aliases: ['kubernetes', 'k8s', 'kube'] },
  { canonical: 'docker', display: 'Docker', aliases: ['docker', 'docker containers'] },
  { canonical: 'terraform', display: 'Terraform', aliases: ['terraform', 'tf'] },
  { canonical: 'helm', display: 'Helm', aliases: ['helm', 'helm charts'] },
  { canonical: 'ansible', display: 'Ansible', aliases: ['ansible'] },
  { canonical: 'ci/cd', display: 'CI/CD', aliases: ['ci/cd', 'cicd', 'ci cd', 'ci-cd'] },
  { canonical: 'git', display: 'Git', aliases: ['git'] },
  { canonical: 'gitlab', display: 'GitLab', aliases: ['gitlab', 'gitlab ci'] },
  { canonical: 'github actions', display: 'GitHub Actions', aliases: ['github actions', 'gh actions'] },
  { canonical: 'jenkins', display: 'Jenkins', aliases: ['jenkins'] },
  { canonical: 'fedramp', display: 'FedRAMP', aliases: ['fedramp'] },
  { canonical: 'iam', display: 'IAM', aliases: ['iam', 'aws iam'] },
  { canonical: 'vpc', display: 'VPC', aliases: ['vpc'] },
  { canonical: 'eks', display: 'EKS', aliases: ['eks', 'aws eks'] },
  { canonical: 'aks', display: 'AKS', aliases: ['aks', 'azure aks'] },
  { canonical: 'linux', display: 'Linux', aliases: ['linux', 'rhel', 'ubuntu'] },
  { canonical: 'nginx', display: 'Nginx', aliases: ['nginx'] },
  { canonical: 'prometheus', display: 'Prometheus', aliases: ['prometheus'] },
  { canonical: 'grafana', display: 'Grafana', aliases: ['grafana'] },
  { canonical: 'vmware', display: 'VMware', aliases: ['vmware', 'vsphere'] },
  { canonical: 'active directory', display: 'Active Directory', aliases: ['active directory', 'azure ad', 'entra id'] },
  { canonical: 'openshift', display: 'OpenShift', aliases: ['openshift', 'red hat openshift'] },
  { canonical: 'pulumi', display: 'Pulumi', aliases: ['pulumi'] },

  // Data, Analytics & AI/ML
  { canonical: 'snowflake', display: 'Snowflake', aliases: ['snowflake', 'snowflake db'] },
  { canonical: 'databricks', display: 'Databricks', aliases: ['databricks'] },
  { canonical: 'pyspark', display: 'PySpark', aliases: ['pyspark', 'py spark'] },
  { canonical: 'apache spark', display: 'Apache Spark', aliases: ['apache spark', 'spark'] },
  { canonical: 'apache airflow', display: 'Apache Airflow', aliases: ['apache airflow', 'airflow'] },
  { canonical: 'dbt', display: 'dbt', aliases: ['dbt', 'dbt cloud', 'dbt core'] },
  { canonical: 'kafka', display: 'Kafka', aliases: ['kafka', 'apache kafka', 'confluent kafka'] },
  { canonical: 'hadoop', display: 'Hadoop', aliases: ['hadoop'] },
  { canonical: 'flink', display: 'Flink', aliases: ['flink', 'apache flink'] },
  { canonical: 'sql', display: 'SQL', aliases: ['sql', 't-sql', 'tsql', 'ansi sql'] },
  { canonical: 'pl/sql', display: 'PL/SQL', aliases: ['pl/sql', 'plsql'] },
  { canonical: 'postgresql', display: 'PostgreSQL', aliases: ['postgresql', 'postgres', 'pgsql'] },
  { canonical: 'mysql', display: 'MySQL', aliases: ['mysql'] },
  { canonical: 'mongodb', display: 'MongoDB', aliases: ['mongodb', 'mongo'] },
  { canonical: 'cassandra', display: 'Cassandra', aliases: ['cassandra', 'apache cassandra'] },
  { canonical: 'dynamodb', display: 'DynamoDB', aliases: ['dynamodb', 'dynamo db'] },
  { canonical: 'redis', display: 'Redis', aliases: ['redis'] },
  { canonical: 'bigquery', display: 'BigQuery', aliases: ['bigquery', 'big query'] },
  { canonical: 'redshift', display: 'Redshift', aliases: ['redshift', 'amazon redshift'] },
  { canonical: 'power bi', display: 'Power BI', aliases: ['power bi', 'powerbi'] },
  { canonical: 'tableau', display: 'Tableau', aliases: ['tableau'] },
  { canonical: 'looker', display: 'Looker', aliases: ['looker', 'lookml'] },
  { canonical: 'snowpark', display: 'Snowpark', aliases: ['snowpark'] },
  { canonical: 'etl', display: 'ETL', aliases: ['etl', 'elt'] },
  { canonical: 'machine learning', display: 'Machine Learning', aliases: ['machine learning', 'ml'] },
  { canonical: 'deep learning', display: 'Deep Learning', aliases: ['deep learning'] },
  { canonical: 'nlp', display: 'NLP', aliases: ['nlp', 'natural language processing'] },
  { canonical: 'llm', display: 'LLM', aliases: ['llm', 'llms', 'large language models'] },
  { canonical: 'genai', display: 'Generative AI', aliases: ['genai', 'gen ai', 'generative ai'] },
  { canonical: 'pytorch', display: 'PyTorch', aliases: ['pytorch', 'py torch'] },
  { canonical: 'tensorflow', display: 'TensorFlow', aliases: ['tensorflow', 'tensor flow'] },
  { canonical: 'scikit-learn', display: 'Scikit-learn', aliases: ['scikit-learn', 'scikit learn', 'sklearn'] },
  { canonical: 'langchain', display: 'LangChain', aliases: ['langchain'] },
  { canonical: 'rag', display: 'RAG', aliases: ['rag', 'retrieval augmented generation'] },
  { canonical: 'pandas', display: 'Pandas', aliases: ['pandas'] },
  { canonical: 'numpy', display: 'NumPy', aliases: ['numpy'] },

  // Programming, Web & Mobile
  { canonical: 'python', display: 'Python', aliases: ['python', 'python3'] },
  { canonical: 'java', display: 'Java', aliases: ['java', 'java 8', 'java 11', 'java 17', 'java 21', 'j2ee'] },
  { canonical: 'spring boot', display: 'Spring Boot', aliases: ['spring boot', 'springboot', 'spring framework'] },
  { canonical: 'spring cloud', display: 'Spring Cloud', aliases: ['spring cloud'] },
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
  { canonical: 'rust', display: 'Rust', aliases: ['rust', 'rustlang'] },
  { canonical: 'scala', display: 'Scala', aliases: ['scala'] },
  { canonical: 'php', display: 'PHP', aliases: ['php', 'laravel'] },
  { canonical: 'fastapi', display: 'FastAPI', aliases: ['fastapi', 'fast api'] },
  { canonical: 'django', display: 'Django', aliases: ['django'] },
  { canonical: 'flask', display: 'Flask', aliases: ['flask'] },
  { canonical: 'ruby on rails', display: 'Ruby on Rails', aliases: ['ruby on rails', 'rails', 'ror'] },
  { canonical: 'swift', display: 'Swift', aliases: ['swift', 'ios swift'] },
  { canonical: 'kotlin', display: 'Kotlin', aliases: ['kotlin'] },
  { canonical: 'flutter', display: 'Flutter', aliases: ['flutter', 'dart'] },

  // QA, Testing & Security
  { canonical: 'selenium', display: 'Selenium', aliases: ['selenium', 'selenium webdriver'] },
  { canonical: 'playwright', display: 'Playwright', aliases: ['playwright'] },
  { canonical: 'cypress', display: 'Cypress', aliases: ['cypress'] },
  { canonical: 'junit', display: 'JUnit', aliases: ['junit'] },
  { canonical: 'pytest', display: 'PyTest', aliases: ['pytest'] },
  { canonical: 'postman', display: 'Postman', aliases: ['postman'] },
  { canonical: 'loadrunner', display: 'LoadRunner', aliases: ['loadrunner'] },
  { canonical: 'jmeter', display: 'JMeter', aliases: ['jmeter', 'apache jmeter'] },
  { canonical: 'cyber security', display: 'Cyber Security', aliases: ['cyber security', 'cybersecurity', 'infosec'] },
  { canonical: 'siem', display: 'SIEM', aliases: ['siem'] },
  { canonical: 'splunk', display: 'Splunk', aliases: ['splunk'] },
  { canonical: 'edr', display: 'EDR', aliases: ['edr'] },
  { canonical: 'mitre att&ck', display: 'MITRE ATT&CK', aliases: ['mitre att&ck', 'mitre attack'] },
  { canonical: 'threat hunting', display: 'Threat Hunting', aliases: ['threat hunting'] },
  { canonical: 'devsecops', display: 'DevSecOps', aliases: ['devsecops'] },
  { canonical: 'soc 2', display: 'SOC 2', aliases: ['soc 2', 'soc2'] },
  { canonical: 'iso 27001', display: 'ISO 27001', aliases: ['iso 27001', 'iso27001'] },
  { canonical: 'penetration testing', display: 'Penetration Testing', aliases: ['penetration testing', 'pentesting'] },
  { canonical: 'zero trust', display: 'Zero Trust', aliases: ['zero trust'] },
  { canonical: 'okta', display: 'Okta', aliases: ['okta'] },
  { canonical: 'crowdstrike', display: 'CrowdStrike', aliases: ['crowdstrike'] },

  // Architecture, Enterprise & SaaS
  { canonical: 'microservices', display: 'Microservices', aliases: ['microservices', 'microservice'] },
  { canonical: 'rest api', display: 'REST API', aliases: ['rest api', 'rest apis', 'restful', 'restful api', 'restful apis'] },
  { canonical: 'graphql', display: 'GraphQL', aliases: ['graphql'] },
  { canonical: 'sap', display: 'SAP', aliases: ['sap'] },
  { canonical: 'sap fico', display: 'SAP FICO', aliases: ['sap fico', 'fico'] },
  { canonical: 'sap mm', display: 'SAP MM', aliases: ['sap mm'] },
  { canonical: 'sap sd', display: 'SAP SD', aliases: ['sap sd'] },
  { canonical: 's/4hana', display: 'S/4HANA', aliases: ['s/4hana', 's4hana', 's/4 hana'] },
  { canonical: 'salesforce', display: 'Salesforce', aliases: ['salesforce', 'sfdc', 'salesforce crm'] },
  { canonical: 'servicenow', display: 'ServiceNow', aliases: ['servicenow', 'service now', 'snow'] },
  { canonical: 'itsm', display: 'ITSM', aliases: ['itsm'] },
  { canonical: 'flow designer', display: 'Flow Designer', aliases: ['flow designer'] },
  { canonical: 'workday', display: 'Workday', aliases: ['workday'] },
  { canonical: 'oracle netsuite', display: 'Oracle NetSuite', aliases: ['oracle netsuite', 'netsuite'] },
  { canonical: 'dynamics 365', display: 'Dynamics 365', aliases: ['dynamics 365', 'd365', 'ms dynamics'] },
  { canonical: 'jira', display: 'Jira', aliases: ['jira'] },
  { canonical: 'confluence', display: 'Confluence', aliases: ['confluence'] },
  { canonical: 'sharepoint', display: 'SharePoint', aliases: ['sharepoint'] },
  { canonical: 'zendesk', display: 'Zendesk', aliases: ['zendesk'] },

  // Engineering, Finance, Healthcare & Operations
  { canonical: 'autocad', display: 'AutoCAD', aliases: ['autocad'] },
  { canonical: 'solidworks', display: 'SolidWorks', aliases: ['solidworks'] },
  { canonical: 'catia', display: 'CATIA', aliases: ['catia'] },
  { canonical: 'revit', display: 'Revit', aliases: ['revit'] },
  { canonical: 'matlab', display: 'MATLAB', aliases: ['matlab'] },
  { canonical: 'plc', display: 'PLC', aliases: ['plc'] },
  { canonical: 'scada', display: 'SCADA', aliases: ['scada'] },
  { canonical: 'ansys', display: 'ANSYS', aliases: ['ansys'] },
  { canonical: 'cnc', display: 'CNC', aliases: ['cnc'] },
  { canonical: 'quality assurance', display: 'Quality Assurance', aliases: ['quality assurance', 'qa'] },
  { canonical: 'six sigma', display: 'Six Sigma', aliases: ['six sigma'] },
  { canonical: 'gaap', display: 'GAAP', aliases: ['gaap'] },
  { canonical: 'ifrs', display: 'IFRS', aliases: ['ifrs'] },
  { canonical: 'fp&a', display: 'FP&A', aliases: ['fp&a'] },
  { canonical: 'quickbooks', display: 'QuickBooks', aliases: ['quickbooks'] },
  { canonical: 'excel', display: 'Microsoft Excel', aliases: ['microsoft excel', 'ms excel', 'excel'] },
  { canonical: 'sap concur', display: 'SAP Concur', aliases: ['sap concur', 'concur'] },
  { canonical: 'hipaa', display: 'HIPAA', aliases: ['hipaa'] },
  { canonical: 'ehr', display: 'EHR', aliases: ['ehr', 'emr'] },
  { canonical: 'epic', display: 'Epic', aliases: ['epic', 'epic ehr'] },
  { canonical: 'cerner', display: 'Cerner', aliases: ['cerner'] },
  { canonical: 'hl7', display: 'HL7', aliases: ['hl7'] },
  { canonical: 'fhir', display: 'FHIR', aliases: ['fhir'] },
  { canonical: 'gdpr', display: 'GDPR', aliases: ['gdpr'] },
  { canonical: 'ccpa', display: 'CCPA', aliases: ['ccpa'] },
  { canonical: 'product management', display: 'Product Management', aliases: ['product management', 'product manager'] },
  { canonical: 'ui/ux', display: 'UI/UX', aliases: ['ui/ux', 'ui ux', 'ux/ui'] },
  { canonical: 'figma', display: 'Figma', aliases: ['figma'] },
  { canonical: 'hubspot', display: 'HubSpot', aliases: ['hubspot'] },
  { canonical: 'marketo', display: 'Marketo', aliases: ['marketo'] },
  { canonical: 'project management', display: 'Project Management', aliases: ['project management'] },
  { canonical: 'pmp', display: 'PMP', aliases: ['pmp'] },
  { canonical: 'agile', display: 'Agile', aliases: ['agile'] },
  { canonical: 'scrum', display: 'Scrum', aliases: ['scrum'] },
  { canonical: 'kanban', display: 'Kanban', aliases: ['kanban'] },
  { canonical: 'supply chain', display: 'Supply Chain', aliases: ['supply chain'] },
  { canonical: 'erp', display: 'ERP', aliases: ['erp'] },
  { canonical: 'hris', display: 'HRIS', aliases: ['hris'] },
  { canonical: 'adp', display: 'ADP', aliases: ['adp'] },
];

// Common non-skill words & names that should never auto-correct via search-bar typo expansion
const SEARCH_CORRECTION_STOPWORDS = new Set([
  'john', 'jane', 'mark', 'paul', 'dave', 'mike', 'alex', 'ryan', 'adam', 'eric',
  'rest', 'test', 'work', 'role', 'lead', 'team', 'core', 'data', 'user', 'best',
  'fast', 'good', 'open', 'code', 'full', 'part', 'hire', 'time', 'year', 'long',
  'high', 'name', 'city', 'firm', 'east', 'west', 'line', 'task', 'plan', 'list',
  'view', 'page', 'note', 'call', 'mail', 'rate', 'term', 'week', 'home', 'base',
  'need', 'must', 'with', 'from', 'only', 'also', 'more', 'less', 'near', 'next',
  'junior', 'senior', 'intern', 'remote', 'hybrid', 'onsite', 'contract', 'billable',
  'bench', 'manager', 'director', 'engineer', 'developer', 'architect', 'analyst',
  'consultant', 'principal', 'associate', 'staff',
]);

const DISPLAY_BY_CANONICAL = new Map<string, string>();
const ALIAS_TO_CANONICAL = new Map<string, string>();
const FUZZY_CANDIDATE_KEYS: Array<{ key: string; canonical: string; display: string }> = [];

function registerSkillDefinition(def: SkillDefinition) {
  DISPLAY_BY_CANONICAL.set(def.canonical, def.display);
  const seenKeys = new Set<string>();
  for (const rawAlias of [def.canonical, def.display, ...def.aliases]) {
    const clean = rawAlias.trim().toLowerCase();
    if (!clean) continue;
    if (!ALIAS_TO_CANONICAL.has(clean)) {
      ALIAS_TO_CANONICAL.set(clean, def.canonical);
    }
    const compact = clean.replace(/[\s.-]+/g, '');
    if (compact.length >= 2 && !ALIAS_TO_CANONICAL.has(compact)) {
      ALIAS_TO_CANONICAL.set(compact, def.canonical);
    }
    if (/^[a-z0-9.+/#-]+$/.test(clean) && !seenKeys.has(clean)) {
      seenKeys.add(clean);
      FUZZY_CANDIDATE_KEYS.push({ key: clean, canonical: def.canonical, display: def.display });
    }
  }
}

for (const def of CANONICAL_SKILL_DEFINITIONS) {
  registerSkillDefinition(def);
}

/**
 * Optimal string alignment / Damerau-Levenshtein distance supporting transpositions (e.g. Raect -> React).
 */
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
      let val = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
    }
  }
  return dp[lenA][lenB];
}

/**
 * Normalizes a skill string to its canonical slug without typo guessing.
 */
export function canonicalizeSkillExact(rawSkill: string): string {
  const cleaned = String(rawSkill || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!cleaned) return '';

  const direct = ALIAS_TO_CANONICAL.get(cleaned);
  if (direct) return direct;

  // Strip trailing version numbers (e.g. "React 18", "Python 3.11", "Angular 17")
  const versionStripped = cleaned.replace(/\s+v?\d+(?:\.\d+)*$/, '').trim();
  if (versionStripped && versionStripped !== cleaned) {
    const verMatch = ALIAS_TO_CANONICAL.get(versionStripped);
    if (verMatch) return verMatch;
  }

  const compact = cleaned.replace(/[\s.-]+/g, '');
  if (compact.length >= 2) {
    const compactMatch = ALIAS_TO_CANONICAL.get(compact);
    if (compactMatch) return compactMatch;
  }

  return cleaned;
}

export function getSkillDisplayName(canonicalOrRaw: string): string {
  const canonical = canonicalizeSkillExact(canonicalOrRaw);
  return DISPLAY_BY_CANONICAL.get(canonical) || String(canonicalOrRaw || '').trim();
}

export function isKnownCanonicalSkill(canonical: string): boolean {
  return DISPLAY_BY_CANONICAL.has(String(canonical || '').trim().toLowerCase());
}

/**
 * Finds the best safe typo correction for an unknown skill token (e.g. "Rect" -> "React", "Kuberntes" -> "Kubernetes").
 */
export function suggestSkillCorrection(
  rawTerm: string,
  options?: { allowSearchStopwords?: boolean }
): SkillTypoCorrection | null {
  const cleaned = String(rawTerm || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length < 3) return null;

  // Never typo-correct if it already matches an exact canonical/alias
  if (ALIAS_TO_CANONICAL.has(cleaned)) return null;
  const compact = cleaned.replace(/[\s.-]+/g, '');
  if (compact.length >= 2 && ALIAS_TO_CANONICAL.has(compact)) return null;

  if (!options?.allowSearchStopwords && SEARCH_CORRECTION_STOPWORDS.has(cleaned)) {
    return null;
  }

  // Length guards prevent short acronyms ("go", "qa") or common words ("junior") from mis-correcting
  const maxAllowedDist = cleaned.length <= 6 ? 1 : 2;
  let best: {
    canonical: string;
    display: string;
    distance: number;
    score: number;
  } | null = null;

  for (const cand of FUZZY_CANDIDATE_KEYS) {
    if (Math.abs(cand.key.length - cleaned.length) > maxAllowedDist) continue;
    // For short tokens (3-5 chars), require matching first or last character
    if (cleaned.length <= 5) {
      const sameFirst = cand.key[0] === cleaned[0];
      const sameLast = cand.key[cand.key.length - 1] === cleaned[cleaned.length - 1];
      if (!sameFirst && !sameLast) continue;
    }

    const dist = damerauLevenshtein(cleaned, cand.key);
    if (dist === 0 || dist > maxAllowedDist) continue;
    if (dist === 2 && (cleaned.length < 7 || cand.key.length < 7 || cand.key[0] !== cleaned[0])) {
      continue;
    }

    // Score prefers smaller edit distance, matching first char, and canonical match
    const sameFirstBonus = cand.key[0] === cleaned[0] ? 0.4 : 0;
    const canonicalBonus = cand.key === cand.canonical ? 0.2 : 0;
    const score = (10 - dist * 3) + sameFirstBonus + canonicalBonus;

    if (!best || score > best.score) {
      best = {
        canonical: cand.canonical,
        display: cand.display,
        distance: dist,
        score,
      };
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

/**
 * Normalizes a skill chip with optional typo healing (for requirement skills & explicit candidate skill tags).
 */
export function normalizeSkillWithTypoFallback(
  rawSkill: string,
  options?: { allowTypoCorrection?: boolean }
): NormalizedSkillResult {
  const trimmed = String(rawSkill || '').trim();
  const exact = canonicalizeSkillExact(trimmed);
  if (!exact) {
    return { canonical: '', display: '', originalInput: trimmed };
  }

  if (ALIAS_TO_CANONICAL.has(exact) || DISPLAY_BY_CANONICAL.has(exact)) {
    return {
      canonical: exact,
      display: DISPLAY_BY_CANONICAL.get(exact) || trimmed,
      matchedViaTypo: false,
      originalInput: trimmed,
    };
  }

  if (options?.allowTypoCorrection !== false) {
    const correction = suggestSkillCorrection(trimmed, { allowSearchStopwords: true });
    if (correction) {
      return {
        canonical: correction.canonical,
        display: correction.display,
        matchedViaTypo: true,
        originalInput: trimmed,
      };
    }
  }

  return {
    canonical: exact,
    display: trimmed,
    matchedViaTypo: false,
    originalInput: trimmed,
  };
}

/**
 * Splits a CSV/semicolon/newline skill list while preserving protected slash terms (CI/CD, S/4HANA, UI/UX, PL/SQL).
 */
export function splitSkillItems(rawCsv?: string | null): string[] {
  const raw = String(rawCsv || '').trim();
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[,;\n|]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

/**
 * Checks whether a canonical skill appears inside unstructured text (title / resume snippet)
 * with boundary safety so "java" never matches "javascript" and "go" never matches "mongodb".
 */
export function textContainsCanonicalSkill(textLower: string, canonical: string): boolean {
  if (!textLower || !canonical) return false;
  const def = CANONICAL_SKILL_DEFINITIONS.find((d) => d.canonical === canonical);
  const terms = def ? Array.from(new Set([def.canonical, ...def.aliases])) : [canonical];

  for (const term of terms) {
    const needle = term.trim().toLowerCase();
    if (!needle) continue;
    // Skip overly ambiguous 2-char standalone abbreviations in unstructured resume prose
    if (needle.length <= 2 && needle !== 'go' && needle !== 'c#' && needle !== 'ai' && needle !== 'ml') {
      continue;
    }
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Boundary check works with symbols like C#, C++, .NET where \b alone fails
    const re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');
    if (re.test(textLower)) {
      return true;
    }
  }
  return false;
}

/**
 * Builds the canonical `normalizedSkills` array persisted on `Candidate` for fast GIN `@>` exact queries.
 */
export function extractNormalizedSkills(input: {
  skillset?: string | null;
  currentTitle?: string | null;
  rawSnippet?: string | null;
}): string[] {
  const slugs = new Set<string>();

  // 1. Explicit skillset tags (with typo fallback so "Rect" in CSV/resume tags normalizes to "react")
  for (const item of splitSkillItems(input.skillset)) {
    const norm = normalizeSkillWithTypoFallback(item, { allowTypoCorrection: true });
    if (norm.canonical) slugs.add(norm.canonical);
  }

  // 2. Boundary-safe scan of title + full resume text against canonical definitions
  const combinedText = [input.currentTitle, input.rawSnippet]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  if (combinedText) {
    for (const def of CANONICAL_SKILL_DEFINITIONS) {
      if (slugs.has(def.canonical)) continue;
      // Avoid noisy 2-letter acronyms in unstructured paragraphs unless explicitly in skillset
      if (def.canonical.length <= 2 && def.canonical !== 'go') continue;
      if (textContainsCanonicalSkill(combinedText, def.canonical)) {
        slugs.add(def.canonical);
      }
    }
  }

  return Array.from(slugs).slice(0, 80);
}

/**
 * Evaluates a candidate against a requirement's skills using canonical aliases and optional typo healing.
 */
export function evaluateNormalizedSkillOverlap(params: {
  requiredSkillsCsv?: string | null;
  candidateSkillset?: string | null;
  candidateNormalizedSkills?: string[] | null;
  candidateTitle?: string | null;
  candidateRawSnippet?: string | null;
}): {
  score: number;
  matched: string[];
  missing: string[];
  corrections: SkillTypoCorrection[];
} {
  const rawRequired = splitSkillItems(params.requiredSkillsCsv);
  if (rawRequired.length === 0) {
    return { score: 0, matched: [], missing: [], corrections: [] };
  }

  const candNormalizedSet = new Set<string>(
    Array.isArray(params.candidateNormalizedSkills) && params.candidateNormalizedSkills.length > 0
      ? params.candidateNormalizedSkills.map((s) => canonicalizeSkillExact(s)).filter(Boolean)
      : []
  );

  if (candNormalizedSet.size === 0) {
    for (const s of splitSkillItems(params.candidateSkillset)) {
      const norm = normalizeSkillWithTypoFallback(s, { allowTypoCorrection: true });
      if (norm.canonical) candNormalizedSet.add(norm.canonical);
    }
  }

  const haystackLower = [params.candidateTitle, params.candidateSkillset, params.candidateRawSnippet]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  const matched: string[] = [];
  const missing: string[] = [];
  const corrections: SkillTypoCorrection[] = [];
  const seenRequired = new Set<string>();

  for (const rawSkill of rawRequired) {
    const exactSlug = canonicalizeSkillExact(rawSkill);
    const norm = normalizeSkillWithTypoFallback(rawSkill, { allowTypoCorrection: true });
    const targetSlug = norm.canonical || exactSlug;
    if (!targetSlug || seenRequired.has(targetSlug)) continue;
    seenRequired.add(targetSlug);

    if (norm.matchedViaTypo) {
      corrections.push({
        from: rawSkill,
        canonical: norm.canonical,
        display: norm.display,
        distance: damerauLevenshtein(rawSkill, norm.display),
      });
    }

    const isMatch =
      candNormalizedSet.has(targetSlug) ||
      textContainsCanonicalSkill(haystackLower, targetSlug) ||
      (exactSlug !== targetSlug && haystackLower.includes(exactSlug));

    if (isMatch) {
      matched.push(rawSkill);
    } else {
      missing.push(rawSkill);
    }
  }

  const total = matched.length + missing.length;
  const score = total > 0 ? Math.round((matched.length / total) * 100) : 0;
  return { score, matched, missing, corrections };
}
