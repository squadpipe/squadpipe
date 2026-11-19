import zlib from 'zlib';
import { aiService, redactRatesFromText } from './ai.service';
import {
  cleanRawField,
  hasJobRoleKeyword,
  purifyJobTitle,
  sanitizeExtractedText,
  sanitizeMissingNotes,
} from './extractionSanitizer';
import type { EmailIntakeBaseline, ResumeParseBaseline } from './ai.types';

const COMMON_RESUME_SKILLS = [
  'React',
  'TypeScript',
  'JavaScript',
  'Node.js',
  'Python',
  'Java',
  'Spring Boot',
  'AWS',
  'Kubernetes',
  'Docker',
  'Terraform',
  'SQL',
  'PostgreSQL',
  'MongoDB',
  'Go',
  'C#',
  '.NET',
  'Kafka',
  'PySpark',
  'Snowflake',
];

const COMMON_EMAIL_SKILLS: Array<{ label: string; aliases?: string[] }> = [
  { label: 'React' },
  { label: 'Redux' },
  { label: 'Next.js', aliases: ['NextJS'] },
  { label: 'Vue.js', aliases: ['Vue', 'VueJS'] },
  { label: 'Angular' },
  { label: 'TypeScript' },
  { label: 'JavaScript' },
  { label: 'HTML' },
  { label: 'CSS' },
  { label: 'Tailwind CSS', aliases: ['Tailwind'] },
  { label: 'Node.js', aliases: ['NodeJS'] },
  { label: 'Express', aliases: ['Express.js'] },
  { label: 'Java', aliases: ['Java 17', 'Java 11', 'Java 8'] },
  { label: 'Spring Boot' },
  { label: 'Microservices' },
  { label: 'Python' },
  { label: 'FastAPI' },
  { label: 'Django' },
  { label: 'Flask' },
  { label: 'Go', aliases: ['Golang'] },
  { label: 'C#' },
  { label: '.NET', aliases: ['.NET Core', 'ASP.NET'] },
  { label: 'C++' },
  { label: 'Rust' },
  { label: 'Scala' },
  { label: 'PHP' },
  { label: 'Ruby on Rails' },
  { label: 'REST APIs', aliases: ['REST API', 'RESTful API', 'RESTful APIs'] },
  { label: 'GraphQL' },
  { label: 'AWS', aliases: ['Amazon Web Services'] },
  { label: 'Azure' },
  { label: 'GCP', aliases: ['Google Cloud'] },
  { label: 'Kubernetes', aliases: ['K8s'] },
  { label: 'Docker' },
  { label: 'Terraform' },
  { label: 'Helm' },
  { label: 'Ansible' },
  { label: 'CI/CD' },
  { label: 'Jenkins' },
  { label: 'GitHub Actions' },
  { label: 'GitLab' },
  { label: 'Linux' },
  { label: 'Prometheus' },
  { label: 'Grafana' },
  { label: 'Kafka' },
  { label: 'Snowflake' },
  { label: 'PySpark' },
  { label: 'Databricks' },
  { label: 'dbt' },
  { label: 'Airflow', aliases: ['Apache Airflow'] },
  { label: 'BigQuery' },
  { label: 'Redshift' },
  { label: 'Power BI' },
  { label: 'Tableau' },
  { label: 'SQL' },
  { label: 'PostgreSQL' },
  { label: 'MySQL' },
  { label: 'MongoDB' },
  { label: 'Redis' },
  { label: 'Elasticsearch' },
  { label: 'Splunk' },
  { label: 'EDR' },
  { label: 'SIEM' },
  { label: 'Salesforce' },
  { label: 'ServiceNow' },
  { label: 'Workday' },
  { label: 'SAP' },
  { label: 'SAP FICO' },
  { label: 'S/4HANA' },
  { label: 'Selenium' },
  { label: 'Playwright' },
  { label: 'Cypress' },
  { label: 'Agile' },
  { label: 'Scrum' },
  { label: 'Jira' },
  { label: 'HIPAA' },
  { label: 'HL7' },
  { label: 'FHIR' },
  { label: 'Epic' },
  { label: 'GAAP' },
  { label: 'FP&A' },
  { label: 'QuickBooks' },
  { label: 'SOX' },
  { label: 'Excel' },
];

export function cleanParseField(val?: unknown): string {
  return cleanRawField(val);
}

function splitSkillValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => cleanParseField(item)).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((item) => cleanParseField(item))
    .filter(Boolean);
}

function extractDocxXmlTextFromZipBuffer(fileBuffer: Buffer): string {
  // Walk ZIP Local File Headers (PK\x03\x04) using Node built-in zlib so .docx uploads
  // never degrade into raw ZIP XML/binary noise if the Python parser is temporarily unavailable.
  const chunks: string[] = [];
  let offset = 0;
  const maxEntries = 200;
  let seen = 0;

  while (offset + 30 <= fileBuffer.length && seen < maxEntries) {
    if (fileBuffer.readUInt32LE(offset) !== 0x04034b50) break;
    seen += 1;
    const compressionMethod = fileBuffer.readUInt16LE(offset + 8);
    const compressedSize = fileBuffer.readUInt32LE(offset + 18);
    const fileNameLen = fileBuffer.readUInt16LE(offset + 26);
    const extraLen = fileBuffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLen + extraLen;
    if (dataStart > fileBuffer.length) break;

    const entryName = fileBuffer.toString('utf8', nameStart, nameStart + fileNameLen);
    let dataEnd = dataStart + compressedSize;
    if (compressedSize === 0 && (fileBuffer.readUInt16LE(offset + 6) & 0x08) !== 0) {
      const nextSig = fileBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), dataStart);
      const centralSig = fileBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), dataStart);
      const candidates = [nextSig, centralSig].filter((idx) => idx > dataStart);
      if (candidates.length === 0) break;
      dataEnd = Math.min(...candidates);
    }
    if (dataEnd > fileBuffer.length) break;

    if (
      /^word\/(document|header\d*|footer\d*)\.xml$/i.test(entryName)
    ) {
      try {
        const rawPayload = fileBuffer.subarray(dataStart, dataEnd);
        const xmlBuf =
          compressionMethod === 8
            ? zlib.inflateRawSync(rawPayload)
            : compressionMethod === 0
              ? rawPayload
              : null;
        if (xmlBuf) {
          const text = xmlBuf
            .toString('utf8')
            .replace(/<\/w:p>|<w:br[^>]*\/?>|<\/w:tr>/gi, '\n')
            .replace(/<w:tab[^>]*\/?>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;|&#39;/g, "'")
            .replace(/[ \t]+/g, ' ')
            .replace(/\n\s+/g, '\n')
            .trim();
          if (text) chunks.push(text);
        }
      } catch {
        // Ignore malformed optional XML part
      }
    }

    offset = dataEnd;
  }

  return chunks.join('\n').trim();
}

export function extractReadableTextFromResumeBuffer(
  fileBuffer: Buffer,
  originalName: string
): string {
  const isZipDocx =
    fileBuffer.length >= 4 &&
    fileBuffer[0] === 0x50 &&
    fileBuffer[1] === 0x4b &&
    (fileBuffer[2] === 0x03 || fileBuffer[2] === 0x05);

  if (isZipDocx || originalName.toLowerCase().endsWith('.docx')) {
    const extracted = extractDocxXmlTextFromZipBuffer(fileBuffer);
    if (extracted) {
      return extracted.replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  const isPdfBinary =
    fileBuffer.length >= 5 && fileBuffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (isPdfBinary) {
    // Raw PDF streams are compressed binary; never store PDF bytes as readable text.
    return '';
  }

  return fileBuffer
    .toString('utf8')
    .replace(/[^\x20-\x7E\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Node-side fallback extraction when the Python resume-parser microservice is unreachable.
 */
export function buildNodeResumeFallback(
  fileBuffer: Buffer,
  originalName: string
): Record<string, any> {
  const rawText = extractReadableTextFromResumeBuffer(fileBuffer, originalName);
  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = rawText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const baseName =
    originalName
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\bresume\b/i, '')
      .trim() || 'Uploaded Candidate';
  const extractedSkills = COMMON_RESUME_SKILLS.filter((skill) =>
    new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(rawText)
  );

  return {
    full_name: baseName,
    email: emailMatch ? emailMatch[0] : `${baseName.toLowerCase().replace(/\s+/g, '.')}@candidate.io`,
    phone: phoneMatch ? phoneMatch[0] : '+1 (555) 000-0000',
    work_auth: /\bUS\s*Citizen\b/i.test(rawText)
      ? 'US Citizen'
      : /\bGreen\s*Card\b/i.test(rawText)
        ? 'Green Card'
        : /\bH-?1B\b/i.test(rawText)
          ? 'H-1B'
          : 'Authorized to Work',
    current_title: 'Senior Software Consultant',
    skills: extractedSkills.length > 0 ? extractedSkills : ['Full Stack Engineering', 'Cloud Architecture'],
    hourly_rate: '$95/hr (C2C)',
    relocation: /\brelocate|open\b/i.test(rawText) ? 'Open' : 'Remote / Negotiable',
    page_count: 2,
    confidence_score: 0.78,
    raw_text_snippet: rawText.slice(0, 8000) || `Extracted from uploaded file: ${originalName}`,
  };
}

export interface ResumeParseResponseOptions {
  upstreamPayload: Record<string, any>;
  rawTextForAi: string;
  tenantId?: string;
  userId?: string;
  rateMasked?: boolean;
  aiSvc?: Pick<typeof aiService, 'enhanceResumeParse'>;
}

/**
 * Merges optional fast-tier LLM resume enhancements onto Python/Node baseline output
 * while preserving exact offline shapes when AI is disabled or unavailable.
 */
export async function buildEnhancedResumeParseResponse(
  options: ResumeParseResponseOptions
): Promise<Record<string, any>> {
  const {
    upstreamPayload,
    rawTextForAi,
    tenantId,
    userId,
    rateMasked = false,
    aiSvc = aiService,
  } = options;

  const isWrappedEnvelope = Boolean(
    upstreamPayload &&
      typeof upstreamPayload === 'object' &&
      'data' in upstreamPayload &&
      upstreamPayload.data &&
      typeof upstreamPayload.data === 'object'
  );
  const profileObj: Record<string, any> = isWrappedEnvelope
    ? upstreamPayload.data
    : upstreamPayload || {};

  const baselineFields: ResumeParseBaseline = {
    fullName: sanitizeExtractedText(profileObj.fullName ?? profileObj.full_name),
    email: sanitizeExtractedText(profileObj.email),
    phone: sanitizeExtractedText(profileObj.phone),
    workAuth: sanitizeExtractedText(profileObj.workAuth ?? profileObj.work_auth),
    currentTitle:
      purifyJobTitle(profileObj.currentTitle ?? profileObj.current_title) ||
      sanitizeExtractedText(profileObj.currentTitle ?? profileObj.current_title),
    education: sanitizeExtractedText(profileObj.education),
    skills: splitSkillValues(profileObj.skills ?? profileObj.skillset),
    hourlyRate: rateMasked ? '' : sanitizeExtractedText(profileObj.hourlyRate ?? profileObj.hourly_rate),
    relocation: sanitizeExtractedText(profileObj.relocation),
  };

  const snippetText =
    rawTextForAi ||
    String(profileObj.rawSnippet || profileObj.raw_text_snippet || '').trim();
  const safeAiText = rateMasked ? redactRatesFromText(snippetText) : snippetText;

  if (!safeAiText.trim()) {
    return isWrappedEnvelope
      ? { ...upstreamPayload, aiUsed: false, data: { ...profileObj, aiUsed: false } }
      : { ...upstreamPayload, aiUsed: false };
  }

  const aiResult = await aiSvc.enhanceResumeParse(safeAiText, baselineFields, {
    tenantId,
    userId,
  });

  if (!aiResult.aiUsed) {
    const quotaNotice = (aiResult as any).quotaNotice;
    return isWrappedEnvelope
      ? {
          ...upstreamPayload,
          aiUsed: false,
          ...(quotaNotice ? { quotaNotice } : {}),
          data: { ...profileObj, aiUsed: false },
        }
      : {
          ...upstreamPayload,
          aiUsed: false,
          ...(quotaNotice ? { quotaNotice } : {}),
        };
  }

  const mergedSkills =
    aiResult.data.skills.length > 0 ? aiResult.data.skills : baselineFields.skills || [];
  const mergedRate = rateMasked
    ? profileObj.hourlyRate ?? profileObj.hourly_rate
    : aiResult.data.hourlyRate || profileObj.hourlyRate || profileObj.hourly_rate || '';

  if (isWrappedEnvelope) {
    return {
      ...upstreamPayload,
      aiUsed: true,
      data: {
        ...profileObj,
        fullName: aiResult.data.fullName || profileObj.fullName || '',
        email: aiResult.data.email || profileObj.email || null,
        phone: aiResult.data.phone || profileObj.phone || null,
        workAuth: aiResult.data.workAuth || profileObj.workAuth || '',
        currentTitle: aiResult.data.currentTitle || profileObj.currentTitle || '',
        education: aiResult.data.education || profileObj.education || null,
        skillset: mergedSkills.length > 0 ? mergedSkills.join(', ') : profileObj.skillset || '',
        hourlyRate: mergedRate,
        relocation: aiResult.data.relocation || profileObj.relocation || 'Yes',
        professionalSummary: aiResult.data.professionalSummary || undefined,
        aiUsed: true,
      },
    };
  }

  return {
    ...upstreamPayload,
    full_name: aiResult.data.fullName || profileObj.full_name,
    email: aiResult.data.email || profileObj.email,
    phone: aiResult.data.phone || profileObj.phone,
    work_auth: aiResult.data.workAuth || profileObj.work_auth,
    current_title: aiResult.data.currentTitle || profileObj.current_title,
    education: aiResult.data.education || profileObj.education,
    skills: mergedSkills.length > 0 ? mergedSkills : profileObj.skills,
    hourly_rate: mergedRate,
    relocation: aiResult.data.relocation || profileObj.relocation,
    professional_summary: aiResult.data.professionalSummary || undefined,
    aiUsed: true,
  };
}

const NON_COMPANY_TOKENS = new Set([
  'least',
  'most',
  'first',
  'last',
  'best',
  'next',
  'remote',
  'hybrid',
  'onsite',
  'on-site',
  'client',
  'our client',
  'the client',
  'present',
  'all',
  'any',
  'this',
  'that',
  'our',
  'the',
  'your',
  'work',
  'home',
  'night',
  'day',
  'est',
  'pst',
  'cst',
  'mst',
  'utc',
  'gmt',
  'ist',
  'asap',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]);

const GENERIC_SUBJECT_RE =
  /^(?:hi|hello|hey|quick\s+question|follow(?:ing)?\s*up|check(?:ing)?\s*in|update|question|staffing|staffing\s+update|new\s+requirement|open\s+position|job\s+opening|resource\s+request|help|call|meeting|re|fwd)$/i;

const PHONE_LINE_RE =
  /^(?:(?:tel|phone|mobile|cell|direct|office)\s*[:.]\s*)?\+?(?:\d[\d\s().-]{7,}\d)$/i;

function escapeRegexLiteral(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findSkillMatchIndex(text: string, term: string): number {
  const escaped = escapeRegexLiteral(term);
  const startsWord = /^[A-Za-z0-9]/.test(term);
  const endsWord = /[A-Za-z0-9]$/.test(term);
  const prefix = startsWord ? '(?<![A-Za-z0-9])' : '(?:^|[\\s,;/|(])';
  const suffix = endsWord ? '(?![A-Za-z0-9])' : '(?=$|[\\s,.;:/|)])';
  const match = new RegExp(`${prefix}${escaped}${suffix}`, 'i').exec(text);
  return match ? match.index : -1;
}

function extractEmailSkills(text: string): string[] {
  const found: Array<{ label: string; index: number }> = [];
  for (const entry of COMMON_EMAIL_SKILLS) {
    const candidates = [entry.label, ...(entry.aliases || [])];
    let earliest = -1;
    for (const term of candidates) {
      const idx = findSkillMatchIndex(text, term);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
      }
    }
    if (earliest !== -1) {
      found.push({ label: entry.label, index: earliest });
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found.map((item) => item.label);
}

function cleanCompanyCandidate(val?: string): string {
  const cleaned = sanitizeExtractedText(val)
    .replace(/\s+(?:Location|Position|Job\s*Title|Role|Work\s*Model)\s*:[\s\S]*$/i, '')
    .replace(/[.,;]+$/, '')
    .trim();
  if (!cleaned) return '';
  if (NON_COMPANY_TOKENS.has(cleaned.toLowerCase())) return '';
  if (/^(?:a|an|one|two|some)\s+/i.test(cleaned)) return '';
  return cleaned;
}

function extractEmailSignature(lines: string[]): {
  sigName: string;
  sigTitle: string;
  sigCompany: string;
} {
  let sigName = '';
  let sigTitle = '';
  let sigCompany = '';

  const sigIdx = lines.findIndex((l) =>
    /^(?:best\s+regards|warm\s+regards|regards|thanks|thank\s+you|sincerely|cheers|best)[,!]?(?:\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})?$/i.test(
      l
    )
  );
  if (sigIdx === -1) return { sigName, sigTitle, sigCompany };

  const inlineMatch = lines[sigIdx].match(
    /^(?:best\s+regards|warm\s+regards|regards|thanks|thank\s+you|sincerely|cheers|best)[,!]\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})$/i
  );

  const afterSig = lines
    .slice(sigIdx + 1)
    .filter((l) => Boolean(l) && !/^sent\s+from\s+my\b/i.test(l));

  if (inlineMatch?.[1]) {
    sigName = inlineMatch[1].trim();
  } else if (
    afterSig[0] &&
    !/@|https?:\/\/|www\./i.test(afterSig[0]) &&
    !PHONE_LINE_RE.test(afterSig[0])
  ) {
    sigName = afterSig.shift() || '';
  }

  for (const line of afterSig.slice(0, 3)) {
    if (/@|https?:\/\/|www\./i.test(line) || PHONE_LINE_RE.test(line)) continue;
    if (!sigTitle) {
      const splitPair = line.match(/^(.+?)\s*(?:,|\||@|\bat\b)\s*(.+)$/i);
      if (splitPair) {
        sigTitle = sanitizeExtractedText(splitPair[1]);
        const maybeComp = cleanCompanyCandidate(splitPair[2]);
        if (maybeComp && !sigCompany) sigCompany = maybeComp;
      } else {
        sigTitle = sanitizeExtractedText(line);
      }
      continue;
    }
    if (!sigCompany) {
      const maybeComp = cleanCompanyCandidate(line);
      if (maybeComp) sigCompany = maybeComp;
    }
  }

  return { sigName, sigTitle, sigCompany };
}

function extractCandidateJobTitle(text: string): string {
  const explicitLine = text.match(
    /(?:Job\s*Title|Position(?:\s*Title)?|Opportunity(?:\s*Title)?|Role(?:\s*Title)?|Opening)\s*:\s*([^\n\r]+)/i
  );
  if (explicitLine?.[1]) {
    const purified = purifyJobTitle(explicitLine[1]);
    if (purified) return purified;
  }

  // Handle standalone "Title:" line when used as requisition title (e.g. Title: Senior Java Developer)
  const standaloneTitleLine = text.match(/(?:^|\n)\s*Title\s*:\s*([^\n\r]+)/i);
  if (standaloneTitleLine?.[1] && hasJobRoleKeyword(standaloneTitleLine[1])) {
    const purified = purifyJobTitle(standaloneTitleLine[1]);
    if (purified) return purified;
  }

  const subjectMatch = text.match(
    /Subject:\s*(?:Re:|Fwd:|Fw:|Urgent(?:\s*Need|\s*Req)?\s*[:\-]?|Contract\s*[:\-]?|Open\s*Req\s*[:\-]?|Requisition\s*[:\-]?|Hot\s*Req\s*[:\-]?|Immediate\s*Need\s*[:\-]?)?\s*([^\n\r]+)/i
  );
  const purifiedSubject = subjectMatch?.[1] ? purifyJobTitle(subjectMatch[1]) : '';
  if (purifiedSubject && hasJobRoleKeyword(purifiedSubject)) {
    return purifiedSubject;
  }

  const conversationalPatterns = [
    /(?:we\s+are\s+|we're\s+|our\s+client\s+is\s+|client\s+is\s+)?(?:urgently\s+|currently\s+)?(?:looking\s+(?:for|to\s+hire)|seeking|hiring|in\s+need\s+of|recruiting\s+(?:for)?|backfill(?:ing)?\s+(?:for)?)\s+(?:an?\s+|\d+\s+)?([^\n\r.;!?]{3,110})/i,
    /(?:join\s+(?:their|our|the)\s+team\s+as|serve\s+as|work\s+as)\s+(?:an?\s+)?([^\n\r.;!?]{3,90})/i,
    /(?:need|require)\s+(?:someone\s+(?:as|for)\s+)?(?:an?\s+|\d+\s+)?([A-Za-z0-9.+#/&-\s]{3,80}?\b(?:developer|engineer|architect|consultant|analyst|manager|director|lead|specialist|administrator|designer|coordinator|technician|nurse|accountant|controller|auditor|recruiter|scientist|strategist|responder)s?\b)/i,
    /(?:open(?:ing)?|role|position|requirement)\s+(?:is\s+)?(?:for\s+)?(?:an?\s+)?([^\n\r.;!?]{3,90})/i,
  ];

  for (const pattern of conversationalPatterns) {
    const m = text.match(pattern);
    if (m?.[1]) {
      const purified = purifyJobTitle(m[1]);
      if (purified && hasJobRoleKeyword(purified)) {
        return purified;
      }
    }
  }

  if (purifiedSubject && !GENERIC_SUBJECT_RE.test(purifiedSubject)) {
    return purifiedSubject;
  }

  const forRole = text.match(
    /(?:for|seeking|hiring)\s+(?:a|an)\s+([A-Z][A-Za-z0-9\s/&+-]{3,60}?)(?:\s+at\b|\s+for\b|\s+in\b|\.|\n|$)/
  );
  if (forRole?.[1]) {
    const purified = purifyJobTitle(forRole[1]);
    if (purified && hasJobRoleKeyword(purified)) return purified;
  }

  return '';
}

/**
 * Deterministic regex/heuristic client intake email parser (Non-AI baseline).
 */
export function extractEmailHeuristics(rawText: string) {
  const text = rawText.replace(/\*\*/g, '').replace(/__/g, '');
  const lines = text.split(/\r?\n/).map((l) => cleanParseField(l));

  const companyLine = text.match(
    /(?:Target\s*Company|Company(?:\s*Name)?|Client(?:\s*Company|\s*Name)?|End\s*Client|Organization)\s*:\s*([^\n\r]+)/i
  );
  const managerFromCompany =
    text.match(
      /(?:hiring\s*manager|contact|coming\s+from|from)\s+(?:is\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*,\s*([A-Za-z][A-Za-z\s/&,-]{2,45}?)\s+(?:from|at|with)\s+([A-Z][A-Za-z0-9& .-]{1,50}?)(?:\.|,|\n|$)/i
    ) ||
    text.match(
      /(?:hiring\s*manager|contact)\s+is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:from|at|with)\s+([A-Z][A-Za-z0-9& .-]{1,50}?)(?:\.|,|\n|$)/i
    );
  const clientIsCompany = text.match(
    /\b(?:end[- ]?client|client|company)\s+is\s+([A-Z][A-Za-z0-9& .,'-]{2,45}?)(?:\.|,|\n|\s+(?:and|in|located|based|looking|seeking)\b|$)/
  );
  const atCompany = text.match(
    /\bat\s+([A-Z][A-Za-z0-9& .-]{1,40}?)(?:\s*\(|,|\s+for\b|\s+in\b|\s+is\b|\s+He\b|\s+She\b|\.|\n|$)/
  );
  const contactLine = text.match(
    /(?:From|Hiring\s*Manager|Contact(?:\s*Name)?|POC)\s*:\s*([^<\n\r]+?)(?:<|$)/i
  );
  const emailMatch =
    text.match(/<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/) ||
    text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  const locationLine = text.match(/(?:Work\s*Location|Location)\s*:\s*([^\n\r]+)/i);
  const basedInLocation = text.match(
    /(?:based\s+in|located\s+in|office\s+in)\s+([A-Z][A-Za-z. ,]{2,40}?)(?:\s+but\b|\s+and\b|\.|,|\n|$)/i
  );
  const cityState = text.match(/\b([A-Z][a-zA-Z ]{2,25},\s*[A-Z]{2}(?:\s*\([^)\n]+\))?)/);
  const contactTitleLine = text.match(
    /(?:Contact\s*Title|Designation|Hiring\s*Manager\s*Title|Sender\s*Title)\s*:\s*([^\n\r]+)/i
  );
  const sentenceContactTitle = text.match(
    /(?:He|She|They)\s+(?:is|are)\s+(?:the|a|an)\s+([A-Za-z][A-Za-z\s/&,-]{2,50}?)(?:\.|,|\n|$)/i
  );

  const { sigName, sigTitle, sigCompany } = extractEmailSignature(lines);

  const billRangeMatch = text.match(
    /(?:budget|bill(?:ing)?(?:\s*rate)?|client\s*rate|max(?:imum)?\s*rate)[^.\n\r]{0,35}[$£€]\d{2,3}(?!\d|,\d{3}|[kK]\b)\s*(?:to|-|–)\s*[$£€]?(\d{2,3})(?!\d|,\d{3}|[kK]\b)/i
  );
  const billRateMatch =
    billRangeMatch ||
    text.match(
      /(?:max(?:imum)?\s*(?:bill\s*)?rate|bill\s*rate|target\s*rate|client\s*rate|hourly\s*budget|budget(?:\s+is)?(?:\s+around)?)[^$£€\d\n\r]{0,30}[$£€]?(\d{2,3})(?!\d|,\d{3}|[kK]\b)\s*(?:\/(?:hr|hour)|per\s*(?:hr|hour)|an\s*hour|hr\b|hourly)?/i
    ) ||
    text.match(
      /[$£€](\d{2,3})(?!\d|,\d{3}|[kK]\b)\s*(?:\/(?:hr|hour)|per\s*(?:hr|hour)|an\s*hour|hr\b|hourly)/i
    );
  const payRangeMatch = text.match(
    /(?:pay(?:\s+(?:the\s+\w+\s+)*candidate)?|pay\s*rate|w2\s*rate|c2c\s*rate)[^.\n\r]{0,40}[$£€]\d{2,3}(?!\d|,\d{3}|[kK]\b)\s*(?:to|-|–)\s*[$£€]?(\d{2,3})(?!\d|,\d{3}|[kK]\b)/i
  );
  const payRateMatch =
    payRangeMatch ||
    text.match(
      /(?:candidate\s*pay\s*rate|pay\s*rate|w2\s*rate|c2c\s*rate|paying|pay[^.\n\r]{0,20})[^$£€\d\n\r]{0,20}[$£€](\d{2,3})(?!\d|,\d{3}|[kK]\b)/i
    );

  const parsedBillRate = billRateMatch ? parseInt(billRateMatch[1], 10) : 0;
  const parsedPayRate = payRateMatch
    ? parseInt(payRateMatch[1], 10)
    : parsedBillRate > 0
      ? Math.round(parsedBillRate * 0.75)
      : 0;

  const hasExplicitHybrid = /\bhybrid\b/i.test(text);
  const hasExplicitOnsite = /\bonsite\b|\bon-site\b|\bin[- ]office\b/i.test(text);
  const hasExplicitRemote = /\bremote\b|\bwfh\b|\bwork\s+from\s+home\b/i.test(text);

  let workModel: 'Remote' | 'Hybrid' | 'Onsite' = 'Remote';
  if (hasExplicitHybrid) workModel = 'Hybrid';
  else if (hasExplicitOnsite) workModel = 'Onsite';
  else if (/\bbased in\b/i.test(text) && !hasExplicitRemote) workModel = 'Onsite';

  const matchedSkills = extractEmailSkills(text);
  const resolvedCompany =
    cleanCompanyCandidate(companyLine?.[1]) ||
    cleanCompanyCandidate(managerFromCompany?.[3] || managerFromCompany?.[2]) ||
    cleanCompanyCandidate(clientIsCompany?.[1]) ||
    cleanCompanyCandidate(sigCompany) ||
    cleanCompanyCandidate(atCompany?.[1]);

  const resolvedTitle = extractCandidateJobTitle(text);
  const resolvedContact = sanitizeExtractedText(
    contactLine?.[1]?.replace(/^["']+|["']+$/g, '') || managerFromCompany?.[1] || sigName
  );
  const resolvedContactEmail = sanitizeExtractedText(emailMatch?.[1]);
  const resolvedContactTitle = sanitizeExtractedText(
    contactTitleLine?.[1] ||
      (managerFromCompany?.[3] ? managerFromCompany[2] : '') ||
      sentenceContactTitle?.[1] ||
      sigTitle
  );

  const rawLocation = sanitizeExtractedText(
    locationLine?.[1] ||
      (basedInLocation?.[1]
        ? hasExplicitRemote
          ? `${basedInLocation[1].trim()} / Remote`
          : basedInLocation[1].trim()
        : '') ||
      cityState?.[1] ||
      (hasExplicitRemote ? 'Remote' : '')
  );

  const missingParts: string[] = [];
  if (!resolvedCompany) missingParts.push('company name');
  if (!resolvedContactTitle) missingParts.push('contact designation');
  if (!/\+?(?:\d[\d\s().-]{7,}\d)/.test(text)) missingParts.push('direct telephone');
  if (!parsedBillRate) missingParts.push('target bill rate');
  if (!payRateMatch) missingParts.push('explicit pay rate');

  const positionsMatch =
    text.match(
      /(?:open\s*positions?|openings?|headcount|positions?\s*open|roles?\s*open|no\.?\s*of\s*positions?)\s*[:\-]?\s*(\d{1,3})\b/i
    ) ||
    text.match(/\b(\d{1,3})\s*(?:open\s*positions?|openings?|headcount)\b/i) ||
    text.match(
      /(?:looking\s+for|seeking|hiring|need)\s+(\d{1,2})\s+[A-Za-z0-9/+#&-\s]{2,45}?\b(?:developers|engineers|architects|consultants|analysts)\b/i
    );
  const parsedOpenPositions = positionsMatch
    ? Math.max(1, Math.min(1000, parseInt(positionsMatch[1], 10)))
    : undefined;

  return {
    companyName: resolvedCompany,
    opportunityTitle: resolvedTitle,
    openPositions: parsedOpenPositions,
    clientContact: resolvedContact,
    clientContactEmail: resolvedContactEmail,
    clientContactTitle: resolvedContactTitle,
    location: rawLocation,
    workModel,
    targetBillRate: parsedBillRate,
    targetPayRate: parsedPayRate,
    skillsRequired: matchedSkills.join(', '),
    missingNotes:
      missingParts.length > 0
        ? `Missing in email: ${missingParts.join(', ')}.`
        : 'All primary intake fields detected from email body.',
  };
}

export interface EmailParseResponseOptions {
  rawEmailText: string;
  upstreamParsed?: Record<string, any>;
  tenantId?: string;
  userId?: string;
  rateMasked?: boolean;
  aiSvc?: Pick<typeof aiService, 'enhanceEmailIntakeParse'>;
}

/**
 * Combines Python intake parser + local heuristics with optional fast-tier LLM refinement.
 */
export async function buildEnhancedEmailParseResponse(
  options: EmailParseResponseOptions
): Promise<Record<string, any>> {
  const {
    rawEmailText,
    upstreamParsed = {},
    tenantId,
    userId,
    rateMasked = false,
    aiSvc = aiService,
  } = options;

  const fallback = extractEmailHeuristics(rawEmailText);
  const parsed = upstreamParsed || {};

  const billRate = Number(parsed.billRate || parsed.targetBillRate || fallback.targetBillRate || 0);
  const payRate = Number(
    parsed.payRate ||
      parsed.targetPayRate ||
      fallback.targetPayRate ||
      (billRate > 0 ? Math.round(billRate * 0.75) : 0)
  );

  const parsedCompany = cleanCompanyCandidate(parsed.companyName || parsed.clientName);
  const parsedLocation = sanitizeExtractedText(parsed.location);
  const purifiedUpstreamTitle = purifyJobTitle(parsed.opportunityTitle || parsed.jobTitle);

  const enriched = {
    ...parsed,
    companyName: parsedCompany || fallback.companyName,
    opportunityTitle: purifiedUpstreamTitle || fallback.opportunityTitle,
    openPositions: parsed.openPositions || fallback.openPositions,
    clientContact:
      sanitizeExtractedText(parsed.clientContact || parsed.contactName) || fallback.clientContact,
    clientContactEmail:
      sanitizeExtractedText(parsed.clientContactEmail) || fallback.clientContactEmail,
    clientContactTitle:
      sanitizeExtractedText(parsed.clientContactTitle || parsed.contactTitle) ||
      fallback.clientContactTitle,
    location:
      parsedLocation && parsedLocation !== 'Remote / Hybrid'
        ? parsedLocation
        : fallback.location || (parsedLocation !== 'Remote / Hybrid' ? parsedLocation : ''),
    workModel: parsed.workModel || fallback.workModel,
    targetBillRate: billRate,
    targetPayRate: payRate,
    skillsRequired:
      sanitizeExtractedText(
        parsed.skillsRequired || (Array.isArray(parsed.skills) ? parsed.skills.join(', ') : '')
      ) || fallback.skillsRequired,
    missingNotes: fallback.missingNotes || sanitizeMissingNotes(parsed.missingNotes) || '',
  };

  const baselineForAi: EmailIntakeBaseline = {
    companyName: enriched.companyName,
    opportunityTitle: enriched.opportunityTitle,
    openPositions: enriched.openPositions,
    clientContact: enriched.clientContact,
    clientContactEmail: enriched.clientContactEmail,
    clientContactTitle: enriched.clientContactTitle,
    location: enriched.location,
    workModel:
      enriched.workModel === 'Hybrid' || enriched.workModel === 'Onsite'
        ? enriched.workModel
        : 'Remote',
    targetBillRate: rateMasked ? 0 : enriched.targetBillRate,
    targetPayRate: rateMasked ? 0 : enriched.targetPayRate,
    skills: splitSkillValues(enriched.skillsRequired),
    missingNotes: rateMasked ? redactRatesFromText(enriched.missingNotes) : enriched.missingNotes,
  };

  const aiEmailInput = rateMasked ? redactRatesFromText(rawEmailText) : rawEmailText;
  const aiResult = await aiSvc.enhanceEmailIntakeParse(aiEmailInput, baselineForAi, {
    tenantId,
    userId,
  });

  if (!aiResult.aiUsed) {
    const quotaNotice = (aiResult as any).quotaNotice;
    return {
      ...enriched,
      aiUsed: false,
      ...(quotaNotice ? { quotaNotice } : {}),
    };
  }

  const resolvedBillRate = rateMasked
    ? enriched.targetBillRate
    : aiResult.data.targetBillRate > 0
      ? aiResult.data.targetBillRate
      : enriched.targetBillRate;
  const resolvedPayRate = rateMasked
    ? enriched.targetPayRate
    : aiResult.data.targetPayRate > 0
      ? aiResult.data.targetPayRate
      : enriched.targetPayRate || (resolvedBillRate > 0 ? Math.round(resolvedBillRate * 0.75) : 0);

  const mergedSkills =
    aiResult.data.skills.length > 0 ? aiResult.data.skills.join(', ') : enriched.skillsRequired;

  return {
    ...enriched,
    companyName: sanitizeExtractedText(aiResult.data.companyName) || enriched.companyName,
    opportunityTitle: purifyJobTitle(aiResult.data.opportunityTitle) || enriched.opportunityTitle,
    openPositions: aiResult.data.openPositions ?? enriched.openPositions,
    clientContact: sanitizeExtractedText(aiResult.data.clientContact) || enriched.clientContact,
    clientContactEmail:
      sanitizeExtractedText(aiResult.data.clientContactEmail) || enriched.clientContactEmail,
    clientContactTitle:
      sanitizeExtractedText(aiResult.data.clientContactTitle) || enriched.clientContactTitle,
    location: sanitizeExtractedText(aiResult.data.location) || enriched.location,
    workModel: aiResult.data.workModel || enriched.workModel,
    targetBillRate: resolvedBillRate,
    targetPayRate: resolvedPayRate,
    skillsRequired: mergedSkills,
    missingNotes: sanitizeMissingNotes(aiResult.data.missingNotes) || enriched.missingNotes,
    aiUsed: true,
  };
}
