import { Candidate } from '../types';
import {
  cleanExtractedResumeText,
  parseResumeSections,
  resolveCandidateEducation,
} from './resumeFormatter';
import {
  getWorkspaceBrand,
  isDefaultBrandName,
  sanitizeBrandContact,
  WorkspaceBrand,
} from './workspaceBrand';

type RgbColor = [number, number, number];

const PAGE_WIDTH = 612; // US Letter width (pt)
const PAGE_HEIGHT = 792; // US Letter height (pt)
const MARGIN_X = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2; // 528pt
const RIGHT_X = PAGE_WIDTH - MARGIN_X; // 570pt
const BOTTOM_LIMIT_Y = 64;

const PALETTE = {
  obsidian: [20, 22, 21] as RgbColor,
  ink: [15, 23, 42] as RgbColor,
  inkAlt: [30, 41, 59] as RgbColor,
  slateText: [51, 65, 85] as RgbColor,
  mutedText: [100, 116, 139] as RgbColor,
  softText: [148, 163, 184] as RgbColor,
  lightSlateText: [203, 213, 225] as RgbColor,
  // SquadPipe Deep Spruce Pine brand scale
  brandPrimary: [15, 92, 86] as RgbColor, // #0F5C56 (brand-600)
  brandDark: [11, 70, 65] as RgbColor, // #0B4641 (brand-700)
  brandSoftBg: [240, 247, 245] as RgbColor, // #F0F7F5 (brand-50)
  brandSoftBorder: [184, 217, 207] as RgbColor, // #B8D9CF (brand-200)
  // Neutral canvas, cards, and borders
  cardBg: [250, 250, 250] as RgbColor, // #FAFAFA warm neutral card
  surfaceSubtle: [248, 250, 252] as RgbColor, // #F8FAFC (slate-50)
  borderLight: [226, 232, 240] as RgbColor, // #E2E8F0 (slate-200)
  borderMedium: [203, 213, 225] as RgbColor, // #CBD5E1 (slate-300)
  white: [255, 255, 255] as RgbColor,
  // Unified semantic status dots matching stageStyles.ts
  dotEmerald: [16, 185, 129] as RgbColor, // #10B981
  dotAmber: [245, 158, 11] as RgbColor, // #F59E0B
  dotZinc: [63, 63, 70] as RgbColor, // #3F3F46
  dotRose: [244, 63, 94] as RgbColor, // #F43F5E
  dotSlate: [148, 163, 184] as RgbColor, // #94A3B8
};

const SUMMARY_SECTION_TITLES = new Set([
  'summary',
  'professional summary',
  'executive summary',
  'objective',
]);

/**
 * Standard Adobe Type1 Helvetica character widths (in 1/1000 em units).
 */
const HELVETICA_WIDTHS: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
  ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722, 'I': 278, 'J': 500,
  'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778, 'P': 667, 'Q': 778, 'R': 722, 'S': 667, 'T': 611,
  'U': 722, 'V': 667, 'W': 944, 'X': 667, 'Y': 667, 'Z': 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556, '`': 333,
  'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556, 'h': 556, 'i': 222, 'j': 222,
  'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556, 'p': 556, 'q': 556, 'r': 333, 's': 500, 't': 278,
  'u': 556, 'v': 500, 'w': 722, 'x': 500, 'y': 500, 'z': 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
};

const HELVETICA_BOLD_WIDTHS: Record<string, number> = {
  ' ': 278, '!': 333, '"': 474, '#': 556, '$': 556, '%': 889, '&': 722, "'": 238,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
  ':': 333, ';': 333, '<': 584, '=': 584, '>': 584, '?': 611, '@': 975,
  'A': 722, 'B': 722, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722, 'I': 278, 'J': 556,
  'K': 722, 'L': 611, 'M': 833, 'N': 722, 'O': 778, 'P': 667, 'Q': 778, 'R': 722, 'S': 667, 'T': 611,
  'U': 722, 'V': 667, 'W': 944, 'X': 667, 'Y': 667, 'Z': 611,
  '[': 333, '\\': 278, ']': 333, '^': 584, '_': 556, '`': 333,
  'a': 556, 'b': 611, 'c': 556, 'd': 611, 'e': 556, 'f': 333, 'g': 611, 'h': 611, 'i': 278, 'j': 278,
  'k': 556, 'l': 278, 'm': 889, 'n': 611, 'o': 611, 'p': 611, 'q': 611, 'r': 389, 's': 556, 't': 333,
  'u': 611, 'v': 556, 'w': 778, 'x': 556, 'y': 556, 'z': 500,
  '{': 389, '|': 280, '}': 389, '~': 584,
};

/**
 * Converts text into ASCII-safe WinAnsi characters and escapes PDF string literals.
 */
function sanitizePdfText(input: string): string {
  const ascii = toPrintableAscii(input);
  return ascii.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function toPrintableAscii(input: string): string {
  return String(input || '')
    .replace(/\u20B9/g, 'INR ')
    .replace(/\u20AC/g, 'EUR ')
    .replace(/\u00A3/g, 'GBP ')
    .replace(/\u00A5/g, 'JPY ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022|\u00B7/g, ' - ')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function rgbStr(color: RgbColor): string {
  return `${(color[0] / 255).toFixed(3)} ${(color[1] / 255).toFixed(3)} ${(color[2] / 255).toFixed(3)}`;
}

/**
 * Computes exact Helvetica / Helvetica-Bold string width in points.
 */
function measurePdfTextWidth(text: string, size: number, bold: boolean): number {
  const clean = toPrintableAscii(text);
  const table = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  let units = 0;
  for (let i = 0; i < clean.length; i++) {
    units += table[clean[i]] ?? 556;
  }
  return (units / 1000) * size;
}

function truncateTextToWidth(text: string, maxWidth: number, size: number, bold: boolean): string {
  const clean = String(text || '').trim();
  if (measurePdfTextWidth(clean, size, bold) <= maxWidth) return clean;
  let out = '';
  for (let i = 0; i < clean.length; i++) {
    const candidate = `${out}${clean[i]}...`;
    if (measurePdfTextWidth(candidate, size, bold) > maxWidth) {
      return `${out.trimEnd()}...`;
    }
    out += clean[i];
  }
  return out;
}

function wrapText(text: string, maxWidth: number, size: number, bold: boolean): string[] {
  const cleaned = String(text || '').replace(/\r/g, '');
  const paragraphs = cleaned.split('\n');
  const result: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      result.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (measurePdfTextWidth(next, size, bold) <= maxWidth) {
        current = next;
      } else {
        if (current) result.push(current);
        if (measurePdfTextWidth(word, size, bold) > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (measurePdfTextWidth(chunk + ch, size, bold) > maxWidth && chunk) {
              result.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) result.push(current);
  }

  return result;
}

function drawRect(
  cmds: string[],
  x: number,
  yBottom: number,
  w: number,
  h: number,
  fill?: RgbColor,
  stroke?: RgbColor,
  lineWidth = 0.75
) {
  cmds.push('q');
  if (fill) cmds.push(`${rgbStr(fill)} rg`);
  if (stroke) cmds.push(`${rgbStr(stroke)} RG ${lineWidth.toFixed(2)} w`);
  cmds.push(`${x.toFixed(2)} ${yBottom.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
  if (fill && stroke) cmds.push('B');
  else if (fill) cmds.push('f');
  else if (stroke) cmds.push('S');
  cmds.push('Q');
}

function drawRoundedRect(
  cmds: string[],
  x: number,
  yBottom: number,
  w: number,
  h: number,
  radius: number,
  fill?: RgbColor,
  stroke?: RgbColor,
  lineWidth = 0.75
) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (r <= 0.1) {
    drawRect(cmds, x, yBottom, w, h, fill, stroke, lineWidth);
    return;
  }
  const k = 0.5522847498 * r;
  const xR = x + w;
  const yT = yBottom + h;

  cmds.push('q');
  if (fill) cmds.push(`${rgbStr(fill)} rg`);
  if (stroke) cmds.push(`${rgbStr(stroke)} RG ${lineWidth.toFixed(2)} w`);
  cmds.push(`${(x + r).toFixed(2)} ${yBottom.toFixed(2)} m`);
  cmds.push(`${(xR - r).toFixed(2)} ${yBottom.toFixed(2)} l`);
  cmds.push(
    `${(xR - r + k).toFixed(2)} ${yBottom.toFixed(2)} ${xR.toFixed(2)} ${(yBottom + r - k).toFixed(2)} ${xR.toFixed(2)} ${(yBottom + r).toFixed(2)} c`
  );
  cmds.push(`${xR.toFixed(2)} ${(yT - r).toFixed(2)} l`);
  cmds.push(
    `${xR.toFixed(2)} ${(yT - r + k).toFixed(2)} ${(xR - r + k).toFixed(2)} ${yT.toFixed(2)} ${(xR - r).toFixed(2)} ${yT.toFixed(2)} c`
  );
  cmds.push(`${(x + r).toFixed(2)} ${yT.toFixed(2)} l`);
  cmds.push(
    `${(x + r - k).toFixed(2)} ${yT.toFixed(2)} ${x.toFixed(2)} ${(yT - r + k).toFixed(2)} ${x.toFixed(2)} ${(yT - r).toFixed(2)} c`
  );
  cmds.push(`${x.toFixed(2)} ${(yBottom + r).toFixed(2)} l`);
  cmds.push(
    `${x.toFixed(2)} ${(yBottom + r - k).toFixed(2)} ${(x + r - k).toFixed(2)} ${yBottom.toFixed(2)} ${(x + r).toFixed(2)} ${yBottom.toFixed(2)} c`
  );
  cmds.push('h');
  if (fill && stroke) cmds.push('B');
  else if (fill) cmds.push('f');
  else if (stroke) cmds.push('S');
  cmds.push('Q');
}

function drawLine(
  cmds: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: RgbColor,
  lineWidth = 0.75
) {
  cmds.push(
    `q ${rgbStr(stroke)} RG ${lineWidth.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`
  );
}

function drawText(
  cmds: string[],
  text: string,
  x: number,
  yBaseline: number,
  size: number,
  bold: boolean,
  color: RgbColor,
  align: 'left' | 'right' | 'center' = 'left'
) {
  const font = bold ? 'F2' : 'F1';
  const raw = toPrintableAscii(text);
  if (!raw) return;
  const textW = measurePdfTextWidth(raw, size, bold);
  let actualX = x;
  if (align === 'right') actualX = x - textW;
  else if (align === 'center') actualX = x - textW / 2;

  cmds.push(
    `BT /${font} ${size.toFixed(1)} Tf ${rgbStr(color)} rg ${actualX.toFixed(2)} ${yBaseline.toFixed(2)} Td (${sanitizePdfText(raw)}) Tj ET`
  );
}

function cleanDisplayUrl(url?: string): string {
  if (!url) return '';
  return String(url)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

function getStageColors(stage?: string): {
  bg: RgbColor;
  border: RgbColor;
  text: RgbColor;
  dot: RgbColor;
} {
  const key = (stage || '').trim().toLowerCase();
  const base = { bg: PALETTE.white, border: PALETTE.borderLight, text: PALETTE.slateText };

  if (
    key.includes('available') ||
    key.includes('bench') ||
    key.includes('onboarding') ||
    key.includes('placed') ||
    key.includes('billable') ||
    key.includes('active') ||
    key.includes('extended') ||
    key.includes('msa executed')
  ) {
    return { ...base, dot: PALETTE.dotEmerald };
  }
  if (key.includes('submitted') || key.includes('expiring')) {
    return { ...base, dot: PALETTE.dotAmber };
  }
  if (key.includes('interview')) {
    return { ...base, dot: PALETTE.brandPrimary };
  }
  if (key.includes('selected')) {
    return { ...base, dot: PALETTE.dotZinc };
  }
  if (key.includes('closed') || key.includes('terminated')) {
    return { ...base, dot: PALETTE.dotRose };
  }
  return { ...base, dot: PALETTE.dotSlate };
}

function maskCandidateContacts(text: string): string {
  return String(text || '')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[Email hidden]')
    .replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g, '[Phone hidden]');
}

export interface ResumePdfOptions {
  masked?: boolean;
  blind?: boolean;
}

/**
 * Downloads the generated Candidate Profile PDF cleanly in the browser.
 */
export function downloadCandidateResumePdf(
  candidate: Candidate,
  formattedRate: string,
  brandOverride?: Partial<WorkspaceBrand>,
  options?: ResumePdfOptions
): string {
  const isMasked = Boolean(options?.masked ?? options?.blind);
  const blob = generateCandidateResumePdf(candidate, formattedRate, brandOverride, options);
  const url = URL.createObjectURL(blob);
  const safeName = (candidate.fullName || 'Consultant').replace(/\s+/g, '_');
  const fileName = `${safeName}${isMasked ? '_Masked_Profile' : '_Profile_Brief'}.pdf`;
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return fileName;
}

/**
 * Generates an executive, clean, non-CV Consultant Profile Brief PDF using the active
 * organization brand configured in General Settings.
 */
export function generateCandidateResumePdf(
  candidate: Candidate,
  formattedRate: string,
  brandOverride?: Partial<WorkspaceBrand>,
  options?: ResumePdfOptions
): Blob {
  const isMasked = Boolean(options?.masked ?? options?.blind);
  const brand: WorkspaceBrand = {
    ...getWorkspaceBrand(),
    ...(brandOverride || {}),
  };
  const brandName = (brand.agencyName || brand.legalEntityName || 'Staffing Agency').trim();
  const isDefaultBrand = isDefaultBrandName(brandName);
  const brandLegal = (brand.legalEntityName || '').trim();
  const brandWebsite = cleanDisplayUrl(sanitizeBrandContact(brand.website, isDefaultBrand));
  const brandEmail = sanitizeBrandContact(brand.supportEmail, isDefaultBrand);
  const brandPhone = sanitizeBrandContact(brand.supportPhone, isDefaultBrand);
  const brandHq = sanitizeBrandContact(brand.headquarters, isDefaultBrand);

  const skills = (candidate.skillset || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const initials = (candidate.fullName || 'C')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const parsedSections = parseResumeSections(candidate.rawSnippet, candidate.fullName);
  const summarySection = parsedSections.find((s) =>
    SUMMARY_SECTION_TITLES.has(s.title.toLowerCase())
  );
  const educationSection = parsedSections.find((s) =>
    s.title.toLowerCase().includes('education')
  );
  const detailSections = parsedSections.filter(
    (s) =>
      !SUMMARY_SECTION_TITLES.has(s.title.toLowerCase()) &&
      !s.title.toLowerCase().includes('education')
  );
  const resolvedEducation = resolveCandidateEducation(candidate.education, candidate.rawSnippet);

  const pages: string[][] = [[]];
  let cmds = pages[0];
  let cursorY = PAGE_HEIGHT;

  const startContinuationPage = () => {
    const nextCmds: string[] = [];
    pages.push(nextCmds);
    cmds = nextCmds;

    drawRect(cmds, 0, PAGE_HEIGHT - 40, PAGE_WIDTH, 40, PALETTE.surfaceSubtle);
    drawLine(cmds, 0, PAGE_HEIGHT - 40, PAGE_WIDTH, PAGE_HEIGHT - 40, PALETTE.borderLight, 0.8);
    drawRect(cmds, 0, PAGE_HEIGHT - 42, PAGE_WIDTH, 2, PALETTE.brandPrimary);
    drawText(
      cmds,
      `${truncateTextToWidth(brandName, 250, 8.8, true)}  |  Executive Consultant Profile`,
      MARGIN_X,
      PAGE_HEIGHT - 25,
      8.8,
      true,
      PALETTE.ink
    );
    drawText(
      cmds,
      truncateTextToWidth(`${candidate.fullName || 'Consultant'} (Continued)`, 220, 8.2, false),
      RIGHT_X,
      PAGE_HEIGHT - 25,
      8.2,
      false,
      PALETTE.mutedText,
      'right'
    );

    cursorY = PAGE_HEIGHT - 66;
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < BOTTOM_LIMIT_Y) {
      startContinuationPage();
    }
  };

  const preparedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // =========================================================================
  // 1. MINIMALIST TOP ACCENT & BRAND HEADER (Page 1)
  // =========================================================================
  drawRect(cmds, 0, PAGE_HEIGHT - 3.5, PAGE_WIDTH, 3.5, PALETTE.brandPrimary);

  const brandSize = measurePdfTextWidth(brandName, 12.5, true) > 280 ? 10.5 : 12.5;
  drawText(
    cmds,
    truncateTextToWidth(brandName, 300, brandSize, true),
    MARGIN_X,
    756,
    brandSize,
    true,
    PALETTE.obsidian
  );

  drawText(
    cmds,
    isMasked ? 'MASKED CANDIDATE PROFILE' : 'CANDIDATE PROFILE',
    RIGHT_X,
    761,
    7.6,
    true,
    PALETTE.brandPrimary,
    'right'
  );
  drawText(cmds, `Prepared ${preparedDate}`, RIGHT_X, 748, 8.0, false, PALETTE.mutedText, 'right');

  // =========================================================================
  // 2. HERO CONSULTANT IDENTITY & RATE
  // =========================================================================
  drawText(cmds, 'PRESENTED CONSULTANT', MARGIN_X, 718, 7.2, true, PALETTE.mutedText);

  const fullNameText = truncateTextToWidth(candidate.fullName || 'Consultant Profile', 360, 21.5, true);
  drawText(cmds, fullNameText, MARGIN_X, 691, 21.5, true, PALETTE.ink);

  const roleTitleText = truncateTextToWidth(candidate.currentTitle || 'Technology Consultant', 260, 10.2, false);
  const roleTitleW = measurePdfTextWidth(roleTitleText, 10.2, false);
  drawText(cmds, roleTitleText, MARGIN_X, 669, 10.2, false, PALETTE.slateText);

  const stageLabel = candidate.pipelineStage || 'Available / Bench';
  const stagePalette = getStageColors(stageLabel);
  const stagePillW = Math.min(148, Math.max(66, measurePdfTextWidth(stageLabel, 7.8, true) + 27));
  const stagePillX = MARGIN_X + roleTitleW + 10;
  drawRoundedRect(cmds, stagePillX, 664.2, stagePillW, 16, 8, stagePalette.bg, stagePalette.border, 0.6);
  drawRoundedRect(cmds, stagePillX + 8.5, 669.9, 4.6, 4.6, 2.3, stagePalette.dot);
  drawText(
    cmds,
    truncateTextToWidth(stageLabel, stagePillW - 25.5, 7.8, true),
    stagePillX + 17.5,
    669.4,
    7.8,
    true,
    stagePalette.text,
    'left'
  );

  // Right-aligned Bill / Target Rate block
  if (formattedRate) {
    drawText(cmds, 'BILL / TARGET RATE', RIGHT_X, 718, 7.2, true, PALETTE.mutedText, 'right');
    const rateRaw = String(formattedRate).trim();
    const slashIdx = rateRaw.indexOf('/');
    const mainRate = slashIdx > 0 ? rateRaw.slice(0, slashIdx) : rateRaw;
    const suffixRate = slashIdx > 0 ? rateRaw.slice(slashIdx) : '';
    const suffixW = suffixRate ? measurePdfTextWidth(suffixRate, 9.2, false) : 0;

    if (suffixRate) {
      drawText(cmds, suffixRate, RIGHT_X, 692, 9.2, false, PALETTE.mutedText, 'right');
    }
    drawText(cmds, mainRate, RIGHT_X - suffixW - (suffixW ? 1.5 : 0), 691, 21.5, true, PALETTE.ink, 'right');

    const rateTypeLabel = String((candidate as any).rateType || '').trim();
    if (rateTypeLabel) {
      drawText(cmds, rateTypeLabel, RIGHT_X, 671, 8.6, false, PALETTE.mutedText, 'right');
    }
  }

  cursorY = 636;

  // =========================================================================
  // 3. CLEAN SECTION HEADER HELPER (Short rounded accent dash + Uppercase label)
  // =========================================================================
  const softCardBg = PALETTE.cardBg;
  const drawSectionHeader = (title: string) => {
    ensureSpace(44);
    drawRoundedRect(cmds, MARGIN_X, cursorY + 1.5, 13, 2.4, 1.2, PALETTE.brandPrimary);
    drawText(cmds, title.toUpperCase(), MARGIN_X + 19, cursorY, 7.8, true, PALETTE.ink);
    cursorY -= 16;
  };

  // =========================================================================
  // 4. CONTACT (3 rounded cards)
  // =========================================================================
  drawSectionHeader('Contact');
  const contactGap = 10;
  const c1W = 132;
  const c2W = 222;
  const c3W = CONTENT_WIDTH - c1W - c2W - contactGap * 2;
  const contactCardH = 48;
  const contactBottom = cursorY - contactCardH + 10;

  const contactCards: Array<{ x: number; w: number; label: string; value: string; twoLineLabel?: string }> = [
    {
      x: MARGIN_X,
      w: c1W,
      label: 'REPRESENTING',
      twoLineLabel: 'RECRUITER',
      value: candidate.assignedRecruiter || brandName,
    },
    {
      x: MARGIN_X + c1W + contactGap,
      w: c2W,
      label: 'EMAIL ADDRESS',
      value: isMasked
        ? 'Hidden - Contact Staffing Team'
        : candidate.email || 'Available upon request',
    },
    {
      x: MARGIN_X + c1W + contactGap + c2W + contactGap,
      w: c3W,
      label: 'DIRECT PHONE',
      value: isMasked ? 'Hidden' : candidate.phone || 'Available upon request',
    },
  ];

  contactCards.forEach((card) => {
    drawRoundedRect(cmds, card.x, contactBottom, card.w, contactCardH, 7, softCardBg, PALETTE.borderLight, 0.55);
    if (card.twoLineLabel) {
      drawText(cmds, card.label, card.x + 12, contactBottom + 34.5, 6.5, true, PALETTE.mutedText);
      drawText(cmds, card.twoLineLabel, card.x + 12, contactBottom + 26.5, 6.5, true, PALETTE.mutedText);
      drawText(
        cmds,
        truncateTextToWidth(card.value, card.w - 24, 9.0, true),
        card.x + 12,
        contactBottom + 11.5,
        9.0,
        true,
        PALETTE.ink
      );
    } else {
      drawText(cmds, card.label, card.x + 12, contactBottom + 31.5, 6.5, true, PALETTE.mutedText);
      drawText(
        cmds,
        truncateTextToWidth(card.value, card.w - 24, 9.0, true),
        card.x + 12,
        contactBottom + 15.5,
        9.0,
        true,
        PALETTE.ink
      );
    }
  });

  cursorY = contactBottom - 24;

  // =========================================================================
  // 5. PROFILE SUMMARY (Clean unboxed copy)
  // =========================================================================
  drawSectionHeader('Profile Summary');
  const overviewLines =
    summarySection && summarySection.items.length > 0
      ? summarySection.items.map((l) => {
          const cleaned = cleanExtractedResumeText(l.replace(/^[•\-\s]+/, ''));
          return isMasked ? maskCandidateContacts(cleaned) : cleaned;
        })
      : [
          `${candidate.currentTitle || 'Technology Consultant'}${
            skills.length > 0 ? ` specializing in ${skills.slice(0, 6).join(', ')}` : ''
          }. Prepared by ${brandName} as a structured client submittal summary.`,
        ];

  for (const para of overviewLines) {
    const wrapped = wrapText(para, CONTENT_WIDTH - 4, 9.4, false);
    if (wrapped.length === 0) continue;
    ensureSpace(wrapped.length * 14.5 + 8);
    for (const wrappedLine of wrapped) {
      if (wrappedLine) {
        drawText(cmds, wrappedLine, MARGIN_X, cursorY, 9.4, false, PALETTE.slateText);
      }
      cursorY -= 14.5;
    }
    cursorY -= 4;
  }
  cursorY -= 14;

  // =========================================================================
  // 6. CORE COMPETENCIES & TECHNICAL STACK (Rounded white pills)
  // =========================================================================
  if (skills.length > 0) {
    drawSectionHeader('Core Competencies & Technical Stack');
    let pillX = MARGIN_X;
    const pillHeight = 20;
    const gapX = 7;
    const rowStep = 26;

    ensureSpace(pillHeight + 8);
    for (const skill of skills) {
      const safeLabel = truncateTextToWidth(skill, CONTENT_WIDTH - 28, 8.2, true);
      const pillW = Math.min(CONTENT_WIDTH, measurePdfTextWidth(safeLabel, 8.2, true) + 22);

      if (pillX + pillW > RIGHT_X && pillX > MARGIN_X) {
        cursorY -= rowStep;
        ensureSpace(pillHeight + 8);
        pillX = MARGIN_X;
      }

      const pillBottom = cursorY - pillHeight + 11;
      drawRoundedRect(cmds, pillX, pillBottom, pillW, pillHeight, 9.5, PALETTE.white, PALETTE.borderLight, 0.65);
      drawText(cmds, safeLabel, pillX + pillW / 2, pillBottom + 6.8, 8.2, true, PALETTE.slateText, 'center');
      pillX += pillW + gapX;
    }
    cursorY -= 34;
  }

  // =========================================================================
  // 7. SUBMITTAL READINESS & ELIGIBILITY (4-card row + full-width Education card)
  // =========================================================================
  drawSectionHeader('Submittal Readiness & Eligibility');
  const gridGap = 10;
  const col4W = (CONTENT_WIDTH - gridGap * 3) / 4;
  const readinessCardH = 56;
  ensureSpace(readinessCardH + 62);
  const readinessBottom = cursorY - readinessCardH + 10;

  const readinessCards: Array<{
    label1: string;
    label2?: string;
    value: string;
    valueColor?: RgbColor;
    statusDot?: RgbColor;
  }> = [
    {
      label1: 'PRIMARY',
      label2: 'SPECIALIZATION',
      value: candidate.currentTitle || 'Technology Consultant',
    },
    {
      label1: 'PIPELINE READINESS',
      value: stageLabel,
      valueColor: PALETTE.ink,
      statusDot: stagePalette.dot,
    },
    {
      label1: 'WORK AUTHORIZATION',
      value: candidate.workAuth || 'Authorized',
    },
    {
      label1: 'RELOCATION',
      value: candidate.relocation || 'Open',
    },
  ];

  readinessCards.forEach((rc, idx) => {
    const cx = MARGIN_X + idx * (col4W + gridGap);
    drawRoundedRect(cmds, cx, readinessBottom, col4W, readinessCardH, 7, softCardBg, PALETTE.borderLight, 0.55);
    if (rc.label2) {
      drawText(cmds, rc.label1, cx + 11, readinessBottom + 41.5, 6.4, true, PALETTE.mutedText);
      drawText(cmds, rc.label2, cx + 11, readinessBottom + 33.5, 6.4, true, PALETTE.mutedText);
      const valLines = wrapText(rc.value, col4W - 22, 8.8, true).slice(0, 2);
      valLines.forEach((vl, lIdx) => {
        drawText(cmds, vl, cx + 11, readinessBottom + 19 - lIdx * 11, 8.8, true, rc.valueColor || PALETTE.ink);
      });
    } else {
      drawText(cmds, rc.label1, cx + 11, readinessBottom + 40, 6.4, true, PALETTE.mutedText);
      if (rc.statusDot) {
        drawRoundedRect(cmds, cx + 11, readinessBottom + 23.9, 4.4, 4.4, 2.2, rc.statusDot);
      }
      const valLines = wrapText(rc.value, col4W - (rc.statusDot ? 30 : 22), 8.8, true).slice(0, 2);
      valLines.forEach((vl, lIdx) => {
        const valX = rc.statusDot && lIdx === 0 ? cx + 19 : cx + 11;
        drawText(cmds, vl, valX, readinessBottom + 23 - lIdx * 11, 8.8, true, rc.valueColor || PALETTE.ink);
      });
    }
  });

  cursorY = readinessBottom - 10;

  // Full-width Education card
  const eduLines = wrapText(resolvedEducation, CONTENT_WIDTH - 24, 9.0, true).slice(0, 3);
  const eduCardH = Math.max(44, 26 + Math.max(1, eduLines.length) * 12);
  ensureSpace(eduCardH + 10);
  const eduBottom = cursorY - eduCardH;
  drawRoundedRect(cmds, MARGIN_X, eduBottom, CONTENT_WIDTH, eduCardH, 7, softCardBg, PALETTE.borderLight, 0.55);
  drawText(cmds, 'EDUCATION', MARGIN_X + 12, eduBottom + eduCardH - 15, 6.5, true, PALETTE.mutedText);
  eduLines.forEach((line, idx) => {
    drawText(cmds, line, MARGIN_X + 12, eduBottom + eduCardH - 30 - idx * 12, 9.0, true, PALETTE.ink);
  });
  cursorY = eduBottom - 22;

  // =========================================================================
  // 8. EXTRACTED RESUME HIGHLIGHTS & EXPERIENCE (when parsed CV text exists)
  // =========================================================================
  if (detailSections.length > 0) {
    drawSectionHeader('Experience & Profile Highlights');
    for (const section of detailSections) {
      ensureSpace(26);
      drawText(cmds, section.title.toUpperCase(), MARGIN_X, cursorY, 8.4, true, PALETTE.brandPrimary);
      cursorY -= 14;

      for (const rawLine of section.items) {
        const isBullet = rawLine.startsWith('•');
        const extractedLine = cleanExtractedResumeText(
          isBullet ? rawLine.slice(1).trim() : rawLine
        );
        const cleanedLine = isMasked ? maskCandidateContacts(extractedLine) : extractedLine;
        const textMaxW = isBullet ? CONTENT_WIDTH - 16 : CONTENT_WIDTH - 4;
        const wrapped = wrapText(cleanedLine, textMaxW, 9.0, false);

        wrapped.forEach((wLine, idx) => {
          ensureSpace(14);
          if (isBullet && idx === 0) {
            drawRoundedRect(cmds, MARGIN_X + 4, cursorY + 2.2, 3.2, 3.2, 1.6, PALETTE.brandPrimary);
          }
          if (wLine) {
            drawText(
              cmds,
              wLine,
              isBullet ? MARGIN_X + 13 : MARGIN_X + 2,
              cursorY,
              9.0,
              false,
              PALETTE.slateText
            );
          }
          cursorY -= 13.8;
        });
      }
      cursorY -= 8;
    }
  }

  // 04. ADDITIONAL CUSTOM ATTRIBUTES (if present)
  const customEntries = Object.entries(candidate.customFields || {}).filter(
    ([, val]) => val !== null && val !== undefined && String(val).trim() !== ''
  );
  if (customEntries.length > 0) {
    drawSectionHeader('Additional Profile Attributes');
    for (const [k, v] of customEntries) {
      const labelPrefix = `${k}: `;
      const prefixW = measurePdfTextWidth(labelPrefix, 8.8, true);
      const valLines = wrapText(String(v), Math.max(180, CONTENT_WIDTH - prefixW - 8), 8.8, false);
      valLines.forEach((vl, idx) => {
        ensureSpace(14);
        if (idx === 0) {
          drawText(cmds, labelPrefix, MARGIN_X + 4, cursorY, 8.8, true, PALETTE.ink);
        }
        drawText(cmds, vl, MARGIN_X + 4 + prefixW, cursorY, 8.8, false, PALETTE.slateText);
        cursorY -= 13.5;
      });
    }
  }

  // =========================================================================
  // 6. CONSISTENT BRANDED FOOTER ACROSS ALL PAGES
  // =========================================================================
  const totalPages = pages.length;
  const footerMeta = [brandName, brandWebsite, brandEmail].filter(Boolean).join('  |  ');

  pages.forEach((pageCmds, idx) => {
    drawLine(pageCmds, MARGIN_X, 46, RIGHT_X, 46, PALETTE.borderLight, 0.75);
    drawText(
      pageCmds,
      truncateTextToWidth(footerMeta || brandName, 420, 7.8, true),
      MARGIN_X,
      32,
      7.8,
      true,
      PALETTE.inkAlt
    );
    drawText(
      pageCmds,
      truncateTextToWidth(
        `Candidate summary prepared by ${brandName} (formatted profile sheet - not the original CV)`,
        430,
        7.0,
        false
      ),
      MARGIN_X,
      21,
      7.0,
      false,
      PALETTE.mutedText
    );
    drawText(
      pageCmds,
      `Page ${idx + 1} of ${totalPages}`,
      RIGHT_X,
      32,
      7.8,
      true,
      PALETTE.mutedText,
      'right'
    );
  });

  // =========================================================================
  // 7. ASSEMBLE STANDARDS-COMPLIANT PDF 1.4 STREAM
  // =========================================================================
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');

  const pageObjNums: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(5 + i * 2);
  }
  objects.push(
    `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`
  );
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  pages.forEach((pageCmds, i) => {
    const pageObjNum = 5 + i * 2;
    const contentObjNum = pageObjNum + 1;
    const stream = pageCmds.join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>`
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((obj, idx) => {
    offsets.push(pdf.length);
    pdf += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}
