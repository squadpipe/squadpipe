import DOMPurify from 'dompurify';

const HTML_TAG_RE = /<\/?(?:p|br|strong|b|em|i|u|ul|ol|li|h[1-6]|blockquote)\b[^>]*>/i;

export function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isHtmlContent(value: string): boolean {
  return HTML_TAG_RE.test(String(value || ''));
}

/**
 * Converts legacy plain-text summaries (with newlines and bullet prefixes)
 * into clean semantic `<p>` and `<ul><li>` HTML so both rich editors and renderers treat them uniformly.
 */
export function plainTextSummaryToHtml(rawText: string): string {
  const normalized = String(rawText || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  if (isHtmlContent(normalized)) return normalized;

  const lines = normalized.split('\n');
  const htmlChunks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      htmlChunks.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
      listItems = [];
    }
  };

  let paragraphBuffer: string[] = [];
  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      htmlChunks.push(`<p>${escapeHtml(paragraphBuffer.join(' '))}</p>`);
      paragraphBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^(?:[-*•\u2022]|\d+[.)])\s+/.test(line)) {
      flushParagraph();
      listItems.push(line.replace(/^(?:[-*•\u2022]|\d+[.)])\s+/, '').trim());
    } else {
      flushList();
      paragraphBuffer.push(line);
    }
  }

  flushParagraph();
  flushList();

  return htmlChunks.join('');
}

/**
 * Sanitizes rich HTML (or legacy plain text) using DOMPurify with a strict safe allowlist.
 */
export function sanitizeRichHtml(rawHtmlOrText: string): string {
  const input = String(rawHtmlOrText || '').trim();
  if (!input) return '';
  const htmlSource = isHtmlContent(input) ? input : plainTextSummaryToHtml(input);
  return DOMPurify.sanitize(htmlSource, {
    ALLOWED_TAGS: [
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
    ],
    ALLOWED_ATTR: [],
  }).trim();
}

export function isRichTextEmpty(rawHtmlOrText: string): boolean {
  const stripped = String(rawHtmlOrText || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return stripped.length === 0;
}

/**
 * Builds a structured, client-safe rich-HTML Role Scope & Public Summary from requirement data.
 * Never includes client company names, contact details, internal requisition codes, or rates.
 */
export function buildClientSafeSummaryHtml(params: {
  opportunityTitle: string;
  openPositions?: number;
  workModel?: string;
  location?: string;
  skillsRequired?: string;
  companyName?: string;
  rawEmailText?: string | null;
}): string {
  const openPos = Number(params.openPositions || 1);
  const posText = openPos > 1 ? `${openPos} open positions` : 'an immediate opening';
  const title = String(params.opportunityTitle || 'Technical Specialist').trim();
  const workModel = String(params.workModel || 'Remote').trim() || 'Remote';
  const cleanLocation =
    String(params.location || 'Remote')
      .replace(/\s*\((?:Onsite|On-Site|Remote|Hybrid)\)\s*$/i, '')
      .trim() || 'Remote';

  const skills = String(params.skillsRequired || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const topSkills = skills.slice(0, 8).join(', ');
  const extraCount = Math.max(0, skills.length - 8);

  const rawJd = String(params.rawEmailText || '').replace(/\r\n/g, '\n');
  const expMatch = rawJd.match(
    /\b(\d+\+?(?:\s*[-–to]+\s*\d+\+?)?\s+years?(?:\s+of\s+experience)?)\b/i
  );
  const durMatch = rawJd.match(
    /\b(\d+\+?(?:\s*[-–to]+\s*\d+)?\s+months?(?:\s+contract|\s+initial)?|long[-\s]term\s+contract|full[-\s]time\s+role)\b/i
  );

  const companyLower = String(params.companyName || '').trim().toLowerCase();
  const cleanJdLines = rawJd
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (l.length < 20 || l.length > 240) return false;
      if (
        /^(?:from|to|cc|sent|subject|client|company|contact|rate|bill|pay|margin|budget|req)\b/i.test(
          l
        )
      ) {
        return false;
      }
      if (/@|[$£€₹]\s*\d|\bREQ-\d+\b|(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/i.test(l)) {
        return false;
      }
      if (companyLower && companyLower.length >= 3 && l.toLowerCase().includes(companyLower)) {
        return false;
      }
      return /^(?:[-*•\u2022]|\d+[.)])\s+/.test(l);
    })
    .map((l) => l.replace(/^(?:[-*•\u2022]|\d+[.)])\s+/, '').trim())
    .slice(0, 5);

  const htmlParts: string[] = [
    `<p>We are actively hiring for ${escapeHtml(posText)} for a <strong>${escapeHtml(title)}</strong> (${escapeHtml(workModel)} &mdash; ${escapeHtml(cleanLocation)}).</p>`,
  ];

  if (topSkills) {
    htmlParts.push(
      `<p>Core technical skills and capabilities cover ${escapeHtml(topSkills)}${
        extraCount > 0 ? `, plus ${extraCount} additional specialized competencies` : ''
      }.</p>`
    );
  }

  if (cleanJdLines.length > 0) {
    htmlParts.push(
      `<p><strong>Key Responsibilities &amp; Focus</strong></p><ul>${cleanJdLines
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('')}</ul>`
    );
  }

  if (expMatch?.[1] || durMatch?.[1]) {
    htmlParts.push(
      `<p><strong>Engagement Scope:</strong> ${escapeHtml(
        [expMatch?.[1], durMatch?.[1]].filter(Boolean).join(' • ')
      )}.</p>`
    );
  }

  return htmlParts.join('');
}
