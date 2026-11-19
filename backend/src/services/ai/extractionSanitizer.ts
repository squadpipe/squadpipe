const MARKDOWN_NOISE_RE = /[*_`~]+/g;

const PLACEHOLDER_EXACT_RE =
  /^(?:not\s+(?:explicitly\s+)?(?:specified|mentioned|provided|stated|disclosed|available|found|given|listed|known|applicable|included)(?:\s+in\s+(?:the\s+)?(?:email|message|thread|resume|cv|document)(?:\s+body)?)?|unspecified|none|n\/?a|unknown|unk|tbd|tba|to\s+be\s+(?:determined|confirmed|decided|advised)|missing|pending(?:\s+confirmation)?|blank|empty|nil|null|undisclosed|no\s+(?:data|info|information|company|title|designation|contact|name|location|rate)\s*(?:found|provided|available|given|mentioned)?|not\s+applicable)$/i;

const PLACEHOLDER_PREFIX_RE =
  /^(?:not\s+(?:specified|mentioned|provided|stated|disclosed)\s+(?:in|within)\b|no\s+(?:company|title|designation|location|contact|email|phone|rate)\s+(?:mentioned|specified|provided|found|given|listed)\b|does\s+not\s+(?:specify|mention|include)\b)/i;

const PLACEHOLDER_BRACKET_RE = /^[\[(<][^\]>)]{1,40}[\])>]$/;

const ROLE_SUFFIX_RE =
  /\b(?:developer|engineer|architect|consultant|analyst|manager|director|lead|specialist|administrator|admin|designer|coordinator|technician|nurse|accountant|controller|auditor|recruiter|scientist|strategist|responder|owner|master|officer|executive|representative|supervisor|counsel|attorney|paralegal|underwriter|planner|buyer|instructor|therapist|pharmacist|physician)s?$/i;

const PLURAL_ROLE_NOUNS_RE =
  /\b(Developers|Engineers|Architects|Consultants|Analysts|Managers|Directors|Specialists|Administrators|Designers|Coordinators|Technicians|Nurses|Accountants|Recruiters|Scientists|Strategists|Responders|Owners|Officers|Representatives|Supervisors|Paralegals|Underwriters|Planners|Buyers|Instructors|Therapists|Pharmacists|Physicians)$/i;

const PAREN_METADATA_RE =
  /(?:remote|hybrid|onsite|on-site|in[- ]?office|wfh|contract|c2c|w-?2|1099|full[- ]?time|part[- ]?time|months?|mos?|weeks?|years?|yrs?|urgent|asap|\$\d+|£\d+|€\d+|^[A-Z][a-zA-Z .]+,\s*[A-Z]{2}$)/i;

const TITLE_CLAUSE_CUT_RE =
  /\s+\b(?:needed|required|wanted|for\s+(?:one\s+of\b|our\b|their\b|this\b|that\b|the\s+(?:ongoing|new|upcoming|client|project|team|position|role)\b|an?\s+(?:ongoing|long[- ]term|short[- ]term|upcoming|new|client|direct|contract|\d+[- ]?(?:month|mo|week|year|yr))\b|ongoing\b|client\b|projects?\b)|with\s+(?:\d+|around|approx(?:imately)?|at\s+least|minimum|over|\+?\s*years?\b|strong\b|good\b|deep\b|solid\b|extensive\b|hands[- ]?on\b|experience\b|expertise\b|background\b|knowledge\b)|who\s+(?:can|has|have|is|will|knows?|brings?)|that\s+(?:can|has|have|is|will)|to\s+(?:join|work|support|build|lead|manage|help|start|assist|hit|take|own)|on\s+(?:one\s+of\b|our\b|this\b|an?\s+ongoing\b|a\s+contract)|based\s+(?:in|out\s+of)\b|located\s+(?:in|at)\b|starting\b|available\b)\b.*$/i;

const TITLE_LOCATION_CUT_RE =
  /\s+\b(?:at|in)\s+(?:remote\b|hybrid\b|onsite\b|on-site\b|[A-Z][a-zA-Z .]{1,25},\s*[A-Z]{2}\b|(?:Austin|New\s+York|NYC|Dallas|Chicago|Seattle|Atlanta|Boston|San\s+Francisco|Phoenix|Denver|Houston|Los\s+Angeles|Miami|Charlotte|Jersey\s+City|McLean|London|Toronto|Bengaluru|Hyderabad|Pune|Mumbai)\b).*$/;

const DELIMITER_METADATA_CUT_RE =
  /\s+(?:[-–—|•]|@)\s*(?:\$?\d|£\d|€\d|remote\b|hybrid\b|onsite\b|on-site\b|in[- ]?office\b|contract\b|c2c\b|w-?2\b|1099\b|full[- ]?time\b|part[- ]?time\b|urgent\b|asap\b|immediately\b|\d+\+?\s*(?:months?|mos?|weeks?|years?|yrs?)\b|our\s+client\b|direct\s+client\b|[A-Z][a-zA-Z .]+,\s*[A-Z]{2}\b).*$/i;

const TECH_CASE_MAP: Record<string, string> = {
  ai: 'AI',
  ml: 'ML',
  llm: 'LLM',
  nlp: 'NLP',
  aws: 'AWS',
  gcp: 'GCP',
  api: 'API',
  apis: 'APIs',
  ui: 'UI',
  ux: 'UX',
  qa: 'QA',
  qe: 'QE',
  sdet: 'SDET',
  sre: 'SRE',
  bi: 'BI',
  etl: 'ETL',
  elt: 'ELT',
  sql: 'SQL',
  nosql: 'NoSQL',
  dba: 'DBA',
  erp: 'ERP',
  crm: 'CRM',
  sap: 'SAP',
  fico: 'FICO',
  fscm: 'FSCM',
  mm: 'MM',
  sd: 'SD',
  pp: 'PP',
  qm: 'QM',
  iam: 'IAM',
  siem: 'SIEM',
  edr: 'EDR',
  soc: 'SOC',
  it: 'IT',
  itsm: 'ITSM',
  hr: 'HR',
  hris: 'HRIS',
  rn: 'RN',
  lpn: 'LPN',
  bsn: 'BSN',
  cpa: 'CPA',
  pmp: 'PMP',
  vp: 'VP',
  svp: 'SVP',
  evp: 'EVP',
  avp: 'AVP',
  cto: 'CTO',
  ceo: 'CEO',
  cfo: 'CFO',
  cio: 'CIO',
  ciso: 'CISO',
  coo: 'COO',
  hipaa: 'HIPAA',
  ehr: 'EHR',
  emr: 'EMR',
  fhir: 'FHIR',
  hl7: 'HL7',
  kyc: 'KYC',
  aml: 'AML',
  sox: 'SOX',
  cad: 'CAD',
  plc: 'PLC',
  scada: 'SCADA',
  cnc: 'CNC',
  icu: 'ICU',
  devops: 'DevOps',
  devsecops: 'DevSecOps',
  ios: 'iOS',
  macos: 'macOS',
  '.net': '.NET',
  'c#': 'C#',
  'c++': 'C++',
  'node.js': 'Node.js',
  nodejs: 'Node.js',
  'next.js': 'Next.js',
  nextjs: 'Next.js',
  'vue.js': 'Vue.js',
  vuejs: 'Vue.js',
  react: 'React',
  redux: 'Redux',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  pyspark: 'PySpark',
  's/4hana': 'S/4HANA',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  mongodb: 'MongoDB',
  graphql: 'GraphQL',
  fastapi: 'FastAPI',
  servicenow: 'ServiceNow',
  salesforce: 'Salesforce',
  workday: 'Workday',
  quickbooks: 'QuickBooks',
  autocad: 'AutoCAD',
  solidworks: 'SolidWorks',
  sharepoint: 'SharePoint',
  powerbi: 'Power BI',
};

const LOWERCASE_CONNECTORS = new Set(['of', 'and', 'in', 'for', 'to', 'on', 'with']);

/**
 * Strips markdown formatting, surrounding punctuation, and repeated whitespace.
 */
export function cleanRawField(val?: unknown): string {
  return String(val ?? '')
    .replace(MARKDOWN_NOISE_RE, '')
    .replace(/^[\s:•\-–—]+|[\s*]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true when an extracted string is a sentinel/placeholder rather than real data.
 */
export function isPlaceholderText(raw?: unknown): boolean {
  const cleaned = cleanRawField(raw);
  if (!cleaned) return true;

  const unwrapped = cleaned
    .replace(/^["'\[\]()<>]+|["'\[\]()<>.:;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!unwrapped || /^[-–—.?!]+$/.test(unwrapped)) return true;
  if (PLACEHOLDER_EXACT_RE.test(unwrapped)) return true;
  if (PLACEHOLDER_PREFIX_RE.test(unwrapped)) return true;
  if (
    PLACEHOLDER_BRACKET_RE.test(cleaned) &&
    /(?:company|client|title|designation|name|location|email|phone|rate|specify|specified|unknown|tbd|missing)/i.test(
      unwrapped
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Normalizes an extracted text field and turns placeholder strings into "".
 */
export function sanitizeExtractedText(val?: unknown): string {
  const cleaned = cleanRawField(val);
  return isPlaceholderText(cleaned) ? '' : cleaned;
}

/**
 * Cleans missing-info notes so "Not specified in email" phrases never leak to users.
 */
export function sanitizeMissingNotes(val?: unknown): string {
  const cleaned = sanitizeExtractedText(val);
  if (!cleaned) return '';

  const normalized = cleaned
    .replace(
      /\b(?:were|was|are|is)?\s*not\s+(?:explicitly\s+)?specified(?:\s+in\s+(?:the\s+)?email(?:\s+body)?)?\s*:?/gi,
      'Missing in email:'
    )
    .replace(/\s*:\s*:/g, ':')
    .replace(/\s+/g, ' ')
    .trim();

  return isPlaceholderText(normalized) ? '' : normalized;
}

function formatTitleWord(word: string, isEdgeWord: boolean): string {
  if (!word) return '';
  const lower = word.toLowerCase();

  if (TECH_CASE_MAP[lower]) {
    return TECH_CASE_MAP[lower];
  }

  if (word.includes('/')) {
    return word
      .split('/')
      .map((part, idx, arr) => formatTitleWord(part, isEdgeWord && idx === 0 && arr.length === 1))
      .join('/');
  }

  if (word.includes('-')) {
    return word
      .split('-')
      .map((part) => formatTitleWord(part, true))
      .join('-');
  }

  if (!isEdgeWord && LOWERCASE_CONNECTORS.has(lower)) {
    return lower;
  }

  // Preserve intentional mixed/acronym tokens like "C#", "iOS", "DevOps", "FSCM"
  const hasUpper = /[A-Z]/.test(word);
  const hasLower = /[a-z]/.test(word);
  if (hasUpper && (hasLower || word.length <= 5)) {
    return word;
  }

  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Applies tech- and acronym-aware Title Case to job titles while preserving legitimate acronyms.
 */
export function formatPureTitleCase(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  return words
    .map((word, idx) => {
      if (/^\([^)]+\)$/.test(word)) {
        const inner = word.slice(1, -1);
        const mappedInner = TECH_CASE_MAP[inner.toLowerCase()];
        return mappedInner ? `(${mappedInner})` : word;
      }
      return formatTitleWord(word, idx === 0 || idx === words.length - 1);
    })
    .join(' ');
}

/**
 * Strips intake prose, clauses, rates, locations, durations, and labels from a raw title
 * so only the pure canonical job role remains.
 */
export function purifyJobTitle(raw?: unknown): string {
  let candidate = sanitizeExtractedText(raw);
  if (!candidate) return '';

  // Remove wrapping quotes if entire title was quoted
  candidate = candidate.replace(/^["']+|["']+$/g, '').trim();

  // Strip email header tags and conversational lead-ins iteratively
  for (let i = 0; i < 4; i += 1) {
    const before = candidate;
    candidate = candidate
      .replace(/^(?:re|fw|fwd)\s*:\s*/i, '')
      .replace(/^(?:req(?:uisition)?\s*(?:#\s*)?[a-z0-9-]*\s*[-:|]\s*)/i, '')
      .replace(
        /^(?:job\s*title|position(?:\s*title)?|opportunity(?:\s*title)?|role(?:\s*title)?|opening|open\s*req|requisition|hot\s*req|priority\s*req|new\s*req|urgent(?:\s*need|\s*req|\s*hiring|\s*role)?|immediate(?:\s*need|\s*opening)?|title)\s*[:\-–|]\s*/i,
        ''
      )
      .replace(
        /^(?:we\s+are\s+|we're\s+|our\s+client\s+is\s+|client\s+is\s+)?(?:urgently\s+|currently\s+|actively\s+)?(?:looking\s+(?:for|to\s+hire)|seeking|hiring|need(?:ing)?|recruiting\s+(?:for)?|in\s+need\s+of|backfill(?:ing)?\s+(?:for)?|join\s+(?:our|their|the)\s+team\s+as)\s+/i,
        ''
      )
      .replace(/^(?:a|an|\d+)\s+(?=[A-Za-z.#])/i, '')
      .replace(
        /^(?:experienced|skilled|strong|qualified|talented|dedicated|dynamic|great)\s+(?=[A-Za-z])/i,
        ''
      )
      .trim();
    if (candidate === before) break;
  }

  // Strip trailing parenthetical metadata such as (Remote), (6 Months), (Austin, TX), ($85/hr)
  let prev = '';
  while (candidate && candidate !== prev) {
    prev = candidate;
    const parenMatch = candidate.match(/\s*\(([^)]+)\)\s*$/);
    if (parenMatch && PAREN_METADATA_RE.test(parenMatch[1])) {
      candidate = candidate.slice(0, parenMatch.index).trim();
    }
  }

  // Strip delimiter metadata (- Remote, | Hybrid, @ Acme, - $90/hr, , Austin, TX)
  candidate = candidate
    .replace(DELIMITER_METADATA_CUT_RE, '')
    .replace(/\s*,\s*(?:remote|hybrid|onsite|on-site|[A-Z][a-zA-Z .]+,\s*[A-Z]{2})\s*$/i, '')
    .replace(TITLE_CLAUSE_CUT_RE, '')
    .replace(TITLE_LOCATION_CUT_RE, '')
    .replace(/\s+\b(?:ASAP|immediately|urgent(?:ly)?)\b.*$/i, '')
    .trim();

  // Cut any trailing "with/having/where <skills or requirements>" clause when a complete role precedes it
  const withClauseMatch = candidate.match(/\s+\b(?:with|having|where)\b/i);
  if (withClauseMatch && withClauseMatch.index && withClauseMatch.index > 0) {
    const prefixBeforeWith = candidate.slice(0, withClauseMatch.index).trim();
    if (ROLE_SUFFIX_RE.test(prefixBeforeWith)) {
      candidate = prefixBeforeWith;
    }
  }

  // Strip trailing filler wrapper nouns ("React Developer role" -> "React Developer")
  const strippedWrapper = candidate.replace(
    /\s+\b(?:role|position|opening|opportunity|requirement|req|candidate|resource)\b\.?$/i,
    ''
  ).trim();
  if (strippedWrapper && ROLE_SUFFIX_RE.test(strippedWrapper)) {
    candidate = strippedWrapper;
  }

  // Singularize plural role endings when multi-word ("React Developers" -> "React Developer")
  if (/\s/.test(candidate)) {
    candidate = candidate.replace(PLURAL_ROLE_NOUNS_RE, (full) => full.slice(0, -1));
  }

  candidate = candidate.replace(/^[\s:•\-–—/,&]+|[\s:•\-–—/,&.;]+$/g, '').trim();
  if (!candidate || isPlaceholderText(candidate)) return '';

  return formatPureTitleCase(candidate);
}

/**
 * Returns true if text contains a recognizable job role noun (e.g. Developer, Engineer, Architect).
 */
export function hasJobRoleKeyword(text: string): boolean {
  return /\b(?:developers?|engineers?|architects?|consultants?|analysts?|managers?|directors?|leads?|specialists?|administrators?|admins?|designers?|coordinators?|technicians?|nurses?|accountants?|controllers?|auditors?|recruiters?|scientists?|strategists?|responders?|scrum\s+masters?|product\s+owners?|dbas?|sres?|vp|ciso|cto)\b/i.test(
    text
  );
}
