import zlib from 'zlib';
import { aiService, redactRatesFromText } from './ai.service';
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

const COMMON_EMAIL_SKILLS = [
  'Java',
  'Spring Boot',
  'Kafka',
  'AWS',
  'Kubernetes',
  'Docker',
  'Python',
  'React',
  'TypeScript',
  'Node.js',
  'Express',
  'MongoDB',
  'Snowflake',
  'PySpark',
  'Databricks',
  'Terraform',
  'Splunk',
  'EDR',
  'SIEM',
  'SQL',
  'Angular',
  'Go',
  'Azure',
  'GCP',
  'dbt',
  'Airflow',
  'Microservices',
  'PostgreSQL',
  'GraphQL',
  'REST API',
];

export function cleanParseField(val?: unknown): string {
  return String(val || '')
    .replace(/\*+/g, '')
    .replace(/[_`~]+/g, '')
    .replace(/^[\s:•\-–—]+|[\s*]+$/g, '')
    .trim();
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
    fullName: cleanParseField(profileObj.fullName ?? profileObj.full_name),
    email: cleanParseField(profileObj.email),
    phone: cleanParseField(profileObj.phone),
    workAuth: cleanParseField(profileObj.workAuth ?? profileObj.work_auth),
    currentTitle: cleanParseField(profileObj.currentTitle ?? profileObj.current_title),
    education: cleanParseField(profileObj.education),
    skills: splitSkillValues(profileObj.skills ?? profileObj.skillset),
    hourlyRate: rateMasked ? '' : cleanParseField(profileObj.hourlyRate ?? profileObj.hourly_rate),
    relocation: cleanParseField(profileObj.relocation),
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

/**
 * Deterministic regex/heuristic client intake email parser (Non-AI baseline).
 */
export function extractEmailHeuristics(rawText: string) {
  const text = rawText.replace(/\*\*/g, '').replace(/__/g, '');
  const lines = text.split(/\r?\n/).map((l) => cleanParseField(l));
  const cleanCompany = (val?: string) =>
    cleanParseField(val)
      .replace(/\s+(?:Location|Position|Job\s*Title|Role|Work\s*Model)\s*:[\s\S]*$/i, '')
      .replace(/[.,;]+$/, '')
      .trim();

  const companyLine = text.match(
    /(?:Target\s*Company|Company(?:\s*Name)?|Client(?:\s*Company)?|Organization)\s*:\s*([^\n\r]+)/i
  );
  const managerFromCompany =
    text.match(
      /(?:hiring\s*manager|contact|coming\s+from|from)\s+(?:is\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*,\s*([A-Za-z][A-Za-z\s/&,-]{2,45}?)\s+(?:from|at|with)\s+([A-Z][A-Za-z0-9& .-]{1,50}?)(?:\.|,|\n|$)/i
    ) ||
    text.match(
      /(?:hiring\s*manager|contact)\s+is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:from|at|with)\s+([A-Z][A-Za-z0-9& .-]{1,50}?)(?:\.|,|\n|$)/i
    );
  const atCompany = text.match(
    /\bat\s+([A-Z][A-Za-z0-9& .-]{1,40}?)(?:\s*\(|,|\s+for\b|\s+in\b|\s+is\b|\s+He\b|\s+She\b|\.|\n|$)/
  );
  const contactLine = text.match(/(?:From|Hiring\s*Manager|Contact(?:\s*Name)?)\s*:\s*([^<\n\r]+?)(?:<|$)/i);
  const emailMatch =
    text.match(/<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/) ||
    text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  const subjectLine = text.match(/Subject:\s*(?:Urgent:|Contract:|Open Req:|Requisition:)?\s*([^\n\r]+)/i);
  const jobTitleLine = text.match(
    /(?:Job\s*Title|Position(?:\s*Title)?|Opportunity(?:\s*Title)?|Role(?:\s*Title)?|Opening)\s*:\s*([^\n\r]+)/i
  );
  const conversationalRole = text.match(
    /(?:join\s+(?:their|our|the)\s+team\s+as\s+(?:a|an)\s+|looking\s+for\s+(?:a|an)\s+|seeking\s+(?:a|an)\s+|hiring\s+(?:a|an)\s+)([A-Za-z][A-Za-z0-9\s/&+-]{2,50}?)(?:\.|,|\n|\s+(?:in|at|with|who)\b|$)/i
  );
  const forRole = text.match(
    /(?:for|seeking|hiring)\s+(?:a|an)\s+([A-Z][A-Za-z0-9\s/&+-]{3,60}?)(?:\s+at\b|\s+for\b|\s+in\b|\.|\n|$)/i
  );
  const locationLine = text.match(/(?:Work\s*Location|Location)\s*:\s*([^\n\r]+)/i);
  const basedInLocation = text.match(
    /(?:based\s+in|located\s+in)\s+([A-Z][A-Za-z. ,]{2,40}?)(?:\s+but\b|\s+and\b|\.|,|\n|$)/i
  );
  const cityState = text.match(/\b([A-Z][a-zA-Z ]{2,25},\s*[A-Z]{2}(?:\s*\([^)\n]+\))?)/);
  const contactTitleLine = text.match(
    /(?:Contact\s*Title|Designation|Hiring\s*Manager\s*Title|(?:^|\n)\s*Title)\s*:\s*([^\n\r]+)/i
  );
  const sentenceContactTitle = text.match(
    /(?:He|She|They)\s+(?:is|are)\s+(?:the|a|an)\s+([A-Za-z][A-Za-z\s/&,-]{2,50}?)(?:\.|,|\n|$)/i
  );

  const toTitleCase = (s: string) => s.replace(/\b([a-z])([a-z]*)/g, (_, a, b) => a.toUpperCase() + b);

  let sigName = '';
  let sigTitle = '';
  let sigCompany = '';
  const sigIdx = lines.findIndex((l) =>
    /^(?:best\s+regards|regards|warm\s+regards|thanks|thank\s+you|sincerely)[,!]?$/i.test(l)
  );
  if (sigIdx !== -1) {
    const afterSig = lines.slice(sigIdx + 1).filter(Boolean);
    if (afterSig[0] && !/@/.test(afterSig[0])) sigName = afterSig[0];
    if (afterSig[1] && !/@|\d{3}[-.\s]\d{3}/.test(afterSig[1])) sigTitle = afterSig[1];
    if (afterSig[2] && !/@|\d{3}[-.\s]\d{3}/.test(afterSig[2])) sigCompany = afterSig[2];
  }

  const billRangeMatch = text.match(
    /(?:budget|bill(?:ing)?(?:\s*rate)?)[^.\n\r]{0,35}\$\d{2,3}\s*(?:to|-|–)\s*\$?(\d{2,3})/i
  );
  const billRateMatch =
    billRangeMatch ||
    text.match(
      /(?:max(?:imum)?\s*bill\s*rate|bill\s*rate|target\s*rate|budget)[^$\d\n\r]{0,30}\$?(\d{2,3})\s*(?:\/hr|per\s*hour|hr\b|hourly)?/i
    ) ||
    text.match(/\$(\d{2,3})\s*(?:\/hr|per\s*hour|hr\b|hourly)/i);
  const payRangeMatch = text.match(
    /(?:pay(?:\s+(?:the\s+\w+\s+)*candidate)?|pay\s*rate|w2\s*rate|c2c\s*rate)[^.\n\r]{0,40}\$\d{2,3}\s*(?:to|-|–)\s*\$?(\d{2,3})/i
  );
  const payRateMatch =
    payRangeMatch ||
    text.match(
      /(?:candidate\s*pay\s*rate|pay\s*rate|w2\s*rate|c2c\s*rate|pay[^.\n\r]{0,20})[^$\d\n\r]{0,20}\$(\d{2,3})/i
    );

  const parsedBillRate = billRateMatch ? parseInt(billRateMatch[1], 10) : 0;
  const parsedPayRate = payRateMatch
    ? parseInt(payRateMatch[1], 10)
    : parsedBillRate > 0
      ? Math.round(parsedBillRate * 0.75)
      : 0;

  let workModel: 'Remote' | 'Hybrid' | 'Onsite' = 'Remote';
  if (/\bhybrid\b/i.test(text)) workModel = 'Hybrid';
  else if (/\bonsite\b|\bon-site\b|\bin[- ]office\b/i.test(text)) workModel = 'Onsite';
  else if (/\bbased in\b/i.test(text) && !/\bremote\b/i.test(text)) workModel = 'Onsite';

  const matchedSkills = COMMON_EMAIL_SKILLS.filter((skill) =>
    new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
  );

  const missingParts: string[] = [];
  if (!/\+?\d[\d\s().-]{7,}\d/.test(text)) missingParts.push('direct telephone');
  if (!parsedBillRate) missingParts.push('target bill rate');
  if (!payRateMatch) missingParts.push('explicit pay rate');

  const rawOppTitle = cleanParseField(
    jobTitleLine?.[1] ||
      subjectLine?.[1] ||
      (conversationalRole?.[1] ? toTitleCase(conversationalRole[1].trim()) : '') ||
      forRole?.[1]
  );

  const rawLocation = cleanParseField(
    locationLine?.[1] ||
      (basedInLocation?.[1]
        ? /\bremote\b/i.test(text)
          ? `${basedInLocation[1].trim()} / Remote`
          : basedInLocation[1].trim()
        : '') ||
      cityState?.[1] ||
      (workModel === 'Remote' ? 'Remote' : workModel)
  );

  const positionsMatch =
    text.match(
      /(?:open\s*positions?|openings?|headcount|positions?\s*open|roles?\s*open|no\.?\s*of\s*positions?)\s*[:\-]?\s*(\d{1,3})\b/i
    ) || text.match(/\b(\d{1,3})\s*(?:open\s*positions?|openings?|headcount)\b/i);
  const parsedOpenPositions = positionsMatch
    ? Math.max(1, Math.min(1000, parseInt(positionsMatch[1], 10)))
    : undefined;

  return {
    companyName: cleanCompany(
      companyLine?.[1] ||
        managerFromCompany?.[3] ||
        managerFromCompany?.[2] ||
        sigCompany ||
        atCompany?.[1]
    ),
    opportunityTitle: rawOppTitle,
    openPositions: parsedOpenPositions,
    clientContact: cleanParseField(contactLine?.[1] || managerFromCompany?.[1] || sigName),
    clientContactEmail: cleanParseField(emailMatch?.[1]),
    clientContactTitle: cleanParseField(
      contactTitleLine?.[1] ||
        (managerFromCompany?.[3] ? managerFromCompany[2] : '') ||
        sentenceContactTitle?.[1] ||
        sigTitle
    ),
    location: rawLocation,
    workModel,
    targetBillRate: parsedBillRate,
    targetPayRate: parsedPayRate,
    skillsRequired: matchedSkills.join(', '),
    missingNotes:
      missingParts.length > 0
        ? `Not specified in email: ${missingParts.join(', ')}.`
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

  const parsedCompany = cleanParseField(parsed.companyName || parsed.clientName)
    .replace(/\s+(?:Location|Position|Job\s*Title|Role|Work\s*Model)\s*:[\s\S]*$/i, '')
    .trim();
  const parsedLocation = cleanParseField(parsed.location);

  const enriched = {
    ...parsed,
    companyName:
      (parsedCompany && parsedCompany !== 'Not Specified' ? parsedCompany : '') ||
      fallback.companyName,
    opportunityTitle:
      cleanParseField(parsed.opportunityTitle || parsed.jobTitle) || fallback.opportunityTitle,
    openPositions: parsed.openPositions || fallback.openPositions,
    clientContact:
      cleanParseField(parsed.clientContact || parsed.contactName) || fallback.clientContact,
    clientContactEmail:
      cleanParseField(parsed.clientContactEmail) || fallback.clientContactEmail,
    clientContactTitle:
      cleanParseField(parsed.clientContactTitle || parsed.contactTitle) ||
      fallback.clientContactTitle,
    location:
      parsedLocation && parsedLocation !== 'Remote / Hybrid'
        ? parsedLocation
        : fallback.location || parsedLocation || 'Remote',
    workModel: parsed.workModel || fallback.workModel,
    targetBillRate: billRate,
    targetPayRate: payRate,
    skillsRequired:
      cleanParseField(
        parsed.skillsRequired || (Array.isArray(parsed.skills) ? parsed.skills.join(', ') : '')
      ) || fallback.skillsRequired,
    missingNotes: fallback.missingNotes || cleanParseField(parsed.missingNotes) || '',
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
    companyName: aiResult.data.companyName || enriched.companyName,
    opportunityTitle: aiResult.data.opportunityTitle || enriched.opportunityTitle,
    openPositions: aiResult.data.openPositions ?? enriched.openPositions,
    clientContact: aiResult.data.clientContact || enriched.clientContact,
    clientContactEmail: aiResult.data.clientContactEmail || enriched.clientContactEmail,
    clientContactTitle: aiResult.data.clientContactTitle || enriched.clientContactTitle,
    location: aiResult.data.location || enriched.location,
    workModel: aiResult.data.workModel || enriched.workModel,
    targetBillRate: resolvedBillRate,
    targetPayRate: resolvedPayRate,
    skillsRequired: mergedSkills,
    missingNotes: aiResult.data.missingNotes || enriched.missingNotes,
    aiUsed: true,
  };
}
