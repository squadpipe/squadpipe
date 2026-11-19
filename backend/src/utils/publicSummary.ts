/**
 * Client-safe summary extraction, sanitization, and HTML normalization utilities.
 * Never exposes internal requisition codes, end-client names, contact details, or hourly rates.
 */

export function formatWorkModelLabel(raw?: string | null): 'Remote' | 'Hybrid' | 'Onsite' {
  const upper = String(raw || '').trim().toUpperCase();
  if (upper === 'HYBRID') return 'Hybrid';
  if (upper === 'ONSITE' || upper === 'ON_SITE') return 'Onsite';
  return 'Remote';
}

const SENSITIVE_LINE_PREFIX_RE =
  /^(?:from|to|cc|bcc|sent|date|subject|client(?:\s*name)?|company(?:\s*name)?|contact|hiring\s*(?:manager|lead)|recruiter|owner|vms(?:\s*id)?|req(?:uisition)?(?:\s*id|\s*code)?|internal\s*note|bill\s*rate|target\s*bill|max\s*bill|pay\s*rate|target\s*pay|rate|budget|margin|salary|compensation|phone|tel|mobile|cell|email|e-mail|direct)\s*[:\-]/i;

const SIGN_OFF_OR_GREETING_RE =
  /^(?:hi(?:\s+team|\s+all|\s+there)?[,!:]?$|hello\b|dear\b|thanks\b|thank\s+you\b|best\s+regards\b|kind\s+regards\b|warm\s+regards\b|regards\b|sincerely\b|cheers\b|sent\s+from\s+my\b)/i;

const RATE_OR_CONTACT_LINE_RE =
  /(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(?:\$|£|€|₹)\s*\d|\b\d+(?:\.\d+)?\s*(?:\/\s*hr|\/\s*hour|per\s*hour|per\s*annum)\b|\b(?:bill\s*rate|pay\s*rate|hourly\s*rate|margin|internal\s*note|hiring\s*manager\s*direct)\b|\bREQ-\d+\b|(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4})/i;

const ALLOWED_HTML_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h3',
  'h4',
  'blockquote',
]);

function escapeRegexForScrub(val: string): string {
  return val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeHtmlText(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Strips potentially unsafe HTML (scripts, styles, event handlers, unknown tags) while preserving
 * clean rich-text formatting tags (`p`, `strong`, `em`, `ul`, `ol`, `li`, `h3`, `h4`, `blockquote`, `br`).
 */
export function sanitizePublicSummaryHtml(rawHtmlOrText: string): string {
  const input = String(rawHtmlOrText || '').trim();
  if (!input) return '';

  // Remove dangerous block tags and their inner content completely
  let cleaned = input
    .replace(/<\s*(script|style|iframe|object|embed|svg|form|noscript)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<\s*(script|style|iframe|object|embed|svg|form|input|button)[^>]*\/?>/gi, ' ');

  const hasTags = /<\/?[a-z][^>]*>/i.test(cleaned);
  if (!hasTags) {
    return cleaned;
  }

  // Filter every tag against ALLOWED_HTML_TAGS and strip all attributes
  cleaned = cleaned.replace(/<\/?\s*([a-zA-Z0-9]+)(?:\s+[^>]*)?\s*\/?>/g, (full, tagRaw) => {
    const tag = String(tagRaw).toLowerCase();
    // Map h1/h2 down to h3 so public cards keep visual hierarchy
    const normalizedTag = tag === 'h1' || tag === 'h2' ? 'h3' : tag;
    if (!ALLOWED_HTML_TAGS.has(normalizedTag)) {
      return '';
    }
    const isClosing = /^<\s*\//.test(full);
    if (normalizedTag === 'br') {
      return isClosing ? '' : '<br>';
    }
    return isClosing ? `</${normalizedTag}>` : `<${normalizedTag}>`;
  });

  // Check if stripped HTML has actual visible text
  const plainCheck = cleaned
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plainCheck) return '';

  return cleaned.trim();
}

export function scrubConfidentialText(
  rawText: string,
  secrets: { companyName?: string | null; contactName?: string | null; code?: string | null }
): string {
  let out = String(rawText || '');
  if (secrets.code?.trim()) {
    out = out.replace(new RegExp(`\\b${escapeRegexForScrub(secrets.code.trim())}\\b`, 'gi'), '');
  }
  out = out.replace(/\bREQ-\d{2,}\b/gi, '');
  if (secrets.companyName?.trim()) {
    const comp = secrets.companyName.trim();
    out = out.replace(new RegExp(escapeRegexForScrub(comp), 'gi'), 'our client');
    const shortComp = comp
      .replace(
        /\b(?:inc|llc|corp|corporation|ltd|limited|pvt|systems|solutions|technologies|group|co)\b\.?/gi,
        ''
      )
      .trim();
    if (shortComp.length >= 4 && shortComp.toLowerCase() !== comp.toLowerCase()) {
      out = out.replace(new RegExp(`\\b${escapeRegexForScrub(shortComp)}\\b`, 'gi'), 'our client');
    }
  }
  if (secrets.contactName?.trim() && secrets.contactName.trim().length >= 4) {
    out = out.replace(
      new RegExp(escapeRegexForScrub(secrets.contactName.trim()), 'gi'),
      'Hiring Team'
    );
  }
  return out
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '')
    .replace(/(?:\$|£|€|₹)\s*\d+(?:\.\d+)?(?:\s*\/\s*(?:hr|hour|yr|year|annum))?/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function buildClientSafePublicSummaryHtml(reqRecord: {
  code?: string | null;
  companyName?: string | null;
  clientContact?: { fullName?: string | null } | null;
  clientContactName?: string | null;
  opportunityTitle: string;
  location?: string | null;
  workModel?: string | null;
  skillsRequired?: string | null;
  openPositions?: number;
  publicDescription?: string | null;
  rawEmailText?: string | null;
}): {
  publicDescription: string | null;
  highlights: string[];
  engagementSummary: string | null;
} {
  const secrets = {
    code: reqRecord.code,
    companyName: reqRecord.companyName,
    contactName: reqRecord.clientContact?.fullName ?? reqRecord.clientContactName,
  };

  const rawText = String(reqRecord.rawEmailText || '').replace(/\r\n/g, '\n');
  const rawLines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const highlights: string[] = [];
  const proseParagraphs: string[] = [];

  for (const line of rawLines) {
    if (
      SENSITIVE_LINE_PREFIX_RE.test(line) ||
      SIGN_OFF_OR_GREETING_RE.test(line) ||
      RATE_OR_CONTACT_LINE_RE.test(line)
    ) {
      continue;
    }

    const scrubbed = scrubConfidentialText(
      line.replace(/^[-*•\u2022\d.)]+\s*/, '').trim(),
      secrets
    );
    if (scrubbed.length < 18 || scrubbed.length > 260) continue;

    if (/^[-*•\u2022]|^\d+[.)]\s+/.test(line)) {
      if (!highlights.some((h) => h.toLowerCase() === scrubbed.toLowerCase())) {
        highlights.push(scrubbed);
      }
    } else if (
      !/^(?:required\s*skills|skills|location|work\s*mode|experience|duration)\s*:/i.test(scrubbed)
    ) {
      proseParagraphs.push(scrubbed);
    }
  }

  // Extract engagement / duration / experience cues cleanly
  const expMatch = rawText.match(
    /\b(\d+\+?(?:\s*[-–to]+\s*\d+\+?)?\s+years?(?:\s+of\s+experience)?)\b/i
  );
  const durMatch = rawText.match(
    /\b(\d+\+?(?:\s*[-–to]+\s*\d+)?\s+months?(?:\s+contract|\s+initial)?|long[-\s]term\s+contract|full[-\s]time\s+role)\b/i
  );
  const engagementParts: string[] = [];
  if (expMatch?.[1]) engagementParts.push(`${expMatch[1].trim()} experience`);
  if (durMatch?.[1]) engagementParts.push(durMatch[1].trim());
  const engagementSummary = engagementParts.length > 0 ? engagementParts.join(' • ') : null;

  const cleanSavedDesc = reqRecord.publicDescription
    ? sanitizePublicSummaryHtml(scrubConfidentialText(reqRecord.publicDescription, secrets))
    : '';

  if (cleanSavedDesc) {
    return {
      publicDescription: cleanSavedDesc,
      highlights: highlights.slice(0, 5),
      engagementSummary,
    };
  }

  const skills = String(reqRecord.skillsRequired || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const workModel = formatWorkModelLabel(reqRecord.workModel);
  const cleanLocation =
    String(reqRecord.location || '')
      .replace(/\s*\((?:Onsite|On-Site|Remote|Hybrid)\)\s*$/i, '')
      .trim() || 'Remote';
  const openPos =
    Number.isInteger(reqRecord.openPositions) && Number(reqRecord.openPositions) > 0
      ? Number(reqRecord.openPositions)
      : 1;
  const titleText = String(reqRecord.opportunityTitle || 'Technical Specialist').trim();

  const htmlParts: string[] = [];
  if (proseParagraphs.length > 0) {
    for (const para of proseParagraphs.slice(0, 3)) {
      htmlParts.push(`<p>${escapeHtmlText(para)}</p>`);
    }
  } else {
    const openingStr = openPos > 1 ? `${openPos} open positions` : 'an immediate opening';
    const coreSkills = skills.slice(0, 8).join(', ');
    const extraSkillsCount = Math.max(0, skills.length - 8);
    htmlParts.push(
      `<p>We are actively hiring for ${escapeHtmlText(openingStr)} as a <strong>${escapeHtmlText(titleText)}</strong> (${escapeHtmlText(workModel)} &mdash; ${escapeHtmlText(cleanLocation)}).</p>`
    );
    if (coreSkills) {
      htmlParts.push(
        `<p>Key focus areas and required capabilities include ${escapeHtmlText(coreSkills)}${
          extraSkillsCount > 0
            ? `, plus ${extraSkillsCount} additional specialized competencies`
            : ''
        }.</p>`
      );
    }
  }

  if (highlights.length > 0) {
    const bulletItems = highlights
      .slice(0, 5)
      .map((item) => `<li>${escapeHtmlText(item)}</li>`)
      .join('');
    htmlParts.push(`<p><strong>Key Responsibilities &amp; Focus</strong></p><ul>${bulletItems}</ul>`);
  }

  if (engagementSummary) {
    htmlParts.push(`<p><strong>Target Profile:</strong> ${escapeHtmlText(engagementSummary)}.</p>`);
  }

  return {
    publicDescription: htmlParts.join('') || null,
    highlights: highlights.slice(0, 5),
    engagementSummary,
  };
}
