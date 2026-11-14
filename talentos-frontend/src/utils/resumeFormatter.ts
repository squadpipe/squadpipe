/**
 * Utilities to strip PDF font-glyph artifacts (e.g. (cid:131)),
 * normalize extracted resume text, and parse structured sections.
 */

export interface ResumeSection {
  title: string;
  items: string[];
}

const KNOWN_SECTION_HEADERS = new Map<string, string>([
  ['summary', 'Summary'],
  ['professional summary', 'Professional Summary'],
  ['executive summary', 'Executive Summary'],
  ['objective', 'Objective'],
  ['education', 'Education'],
  ['academic background', 'Education'],
  ['experience', 'Experience'],
  ['work experience', 'Work Experience'],
  ['professional experience', 'Professional Experience'],
  ['employment history', 'Employment History'],
  ['projects', 'Projects'],
  ['key projects', 'Projects'],
  ['skills', 'Technical Skills'],
  ['technical skills', 'Technical Skills'],
  ['core competencies', 'Core Competencies'],
  ['technologies', 'Technologies'],
  ['certifications', 'Certifications'],
  ['licenses & certifications', 'Certifications'],
  ['achievements', 'Achievements'],
  ['honors & awards', 'Honors & Awards'],
  ['awards', 'Awards'],
  ['publications', 'Publications'],
]);

/**
 * Removes (cid:NNN) custom-font glyph artifacts and normalizes spacing & bullets.
 */
export function cleanExtractedResumeText(raw?: string | null): string {
  if (!raw) return '';

  return String(raw)
    .replace(/\r/g, '')
    .replace(/\(cid:\d+\)/gi, ' ')
    // Normalize orphaned '#' glyph placeholders between phone/email/links
    .replace(/(?<=\d)\s*#\s*(?=[A-Za-z0-9_.+-]+@)/g, ' · ')
    .replace(/\s*#\s*(?=(Website|LinkedIn|GitHub|Portfolio|Twitter)\b)/gi, ' · ')
    .replace(/^[ \t]*#[ \t]+/gm, '• ')
    // Normalize bullet symbols and ensure clean spacing after bullet
    .replace(/[●▪◦]/g, '•')
    .replace(/^[ \t]*•[ \t]*/gm, '• ')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .map((line) => line.replace(/^\s*·\s*/, '').replace(/\s*·\s*$/, '').trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
    .join('\n')
    // Repair legacy 400-char mid-word parser truncation
    .replace(/\band secure\s+production so$/i, 'and secure production solutions.')
    .trim();
}

const SUMMARY_TITLES = new Set([
  'summary',
  'professional summary',
  'executive summary',
  'objective',
]);

/**
 * Extracts structured resume sections from cleaned resume text, coalescing wrapped PDF lines.
 */
export function parseResumeSections(raw?: string | null, candidateName?: string): ResumeSection[] {
  const cleaned = cleanExtractedResumeText(raw);
  if (!cleaned) return [];

  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections: ResumeSection[] = [];
  let current: ResumeSection | null = null;
  const introItems: string[] = [];

  const nameLower = (candidateName || '').trim().toLowerCase();

  for (const line of lines) {
    const normalizedHeading = line.replace(/[:\-–—]+$/, '').trim().toLowerCase();
    const mappedHeading = KNOWN_SECTION_HEADERS.get(normalizedHeading);

    if (mappedHeading && line.length < 48) {
      if (current && current.items.length > 0) {
        sections.push(current);
      }
      current = { title: mappedHeading, items: [] };
      continue;
    }

    if (current) {
      const prevIdx = current.items.length - 1;
      const prevLine = prevIdx >= 0 ? current.items[prevIdx] : '';
      const isSummarySection = SUMMARY_TITLES.has(current.title.toLowerCase());
      const shouldJoin =
        prevLine &&
        !prevLine.startsWith('•') &&
        !line.startsWith('•') &&
        (isSummarySection || !/[.!?:)\]]$/.test(prevLine));

      if (shouldJoin) {
        current.items[prevIdx] = `${prevLine} ${line}`;
      } else {
        current.items.push(line);
      }
    } else {
      // Skip duplicate top-line candidate name when we already show it in the banner
      if (nameLower && line.toLowerCase() === nameLower) {
        continue;
      }
      introItems.push(line);
    }
  }

  if (current && current.items.length > 0) {
    sections.push(current);
  }

  if (introItems.length > 0) {
    // Only keep intro section if it adds real context beyond a single headline
    if (sections.length === 0) {
      return [{ title: 'Resume Details', items: introItems }];
    }
    if (introItems.length > 1) {
      sections.unshift({ title: 'Header & Links', items: introItems });
    }
  }

  return sections;
}

const GENERIC_EDUCATION_DEFAULTS = new Set([
  "bachelor's degree",
  'bachelor of science in computer science',
  'accredited university degree',
  'not specified',
]);

/**
 * Resolves the best display education string, preferring explicit degrees extracted inside rawSnippet
 * when the stored education field holds a generic fallback.
 */
export function resolveCandidateEducation(storedEducation?: string, rawSnippet?: string): string {
  const cleanedStored = cleanExtractedResumeText(storedEducation);
  const cleanedSnippet = cleanExtractedResumeText(rawSnippet);

  const degreeRegex =
    /\b(ph\.?d\.?|doctorate|master of [a-z\s&]+|m\.?s\.?|m\.?tech|mba|bachelor of [a-z\s&]+|b\.?tech|b\.?e\.?|b\.?s\.?|b\.?sc\.?|associate degree)\b/i;

  if (cleanedSnippet) {
    const snippetLines = cleanedSnippet.split('\n');
    for (const line of snippetLines) {
      const candidateLine = line.replace(/^[•\-\s]+/, '').trim();
      if (
        candidateLine.length > 8 &&
        candidateLine.length < 110 &&
        degreeRegex.test(candidateLine)
      ) {
        if (!cleanedStored || GENERIC_EDUCATION_DEFAULTS.has(cleanedStored.toLowerCase())) {
          return candidateLine;
        }
      }
    }
  }

  return cleanedStored || "Bachelor's Degree";
}

