import { Candidate } from '../types';
import {
  cleanExtractedResumeText,
  parseResumeSections,
  resolveCandidateEducation,
} from './resumeFormatter';
import { getWorkspaceBrand, WorkspaceBrand } from './workspaceBrand';

type RgbColor = [number, number, number];

const PAGE_WIDTH = 612; // US Letter width (pt)
const PAGE_HEIGHT = 792; // US Letter height (pt)
const MARGIN_X = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2; // 528pt
const RIGHT_X = PAGE_WIDTH - MARGIN_X; // 570pt
const BOTTOM_LIMIT_Y = 64;

const PALETTE = {
  navy: [15, 23, 42] as RgbColor,
  navyAlt: [30, 41, 59] as RgbColor,
  slateBorderDark: [71, 85, 105] as RgbColor,
  slateText: [51, 65, 85] as RgbColor,
  mutedText: [100, 116, 139] as RgbColor,
  softText: [148, 163, 184] as RgbColor,
  lightSlateText: [203, 213, 225] as RgbColor,
  brandIndigo: [79, 70, 229] as RgbColor,
  brandIndigoSoft: [199, 210, 254] as RgbColor,
  surfaceSubtle: [248, 250, 252] as RgbColor,
  pillBg: [241, 245, 249] as RgbColor,
  borderLight: [226, 232, 240] as RgbColor,
  borderMedium: [203, 213, 225] as RgbColor,
  white: [255, 255, 255] as RgbColor,
  emeraldBg: [236, 253, 245] as RgbColor,
  emeraldBorder: [167, 243, 208] as RgbColor,
  emeraldText: [4, 120, 87] as RgbColor,
  blueBg: [239, 246, 255] as RgbColor,
  blueBorder: [191, 219, 254] as RgbColor,
  blueText: [29, 78, 216] as RgbColor,
  indigoBg: [238, 242, 255] as RgbColor,
  indigoBorder: [199, 210, 254] as RgbColor,
  indigoText: [67, 56, 202] as RgbColor,
};

const SUMMARY_SECTION_TITLES = new Set([
  'summary',
  'professional summary',
  'executive summary',
  'objective',
]);

const DEMO_PLACEHOLDER_VALUES = new Set([
  'talentos-agency.com',
  'https://talentos-agency.com',
  'desk@talentos-agency.com',
  '+1 (800) 555-0199',
  'austin, tx',
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

function sanitizeBrandContact(value: string | undefined, isDefaultBrand: boolean): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (!isDefaultBrand && DEMO_PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) {
    return '';
  }
  return trimmed;
}

function getStageColors(stage?: string): { bg: RgbColor; border: RgbColor; text: RgbColor } {
  const key = (stage || '').trim().toLowerCase();
  if (key.includes('available') || key.includes('bench')) {
    return { bg: PALETTE.emeraldBg, border: PALETTE.emeraldBorder, text: PALETTE.emeraldText };
  }
  if (key.includes('submitted')) {
    return { bg: PALETTE.blueBg, border: PALETTE.blueBorder, text: PALETTE.blueText };
  }
  if (key.includes('billable') || key.includes('selected')) {
    return { bg: PALETTE.indigoBg, border: PALETTE.indigoBorder, text: PALETTE.indigoText };
  }
  return { bg: PALETTE.pillBg, border: PALETTE.borderMedium, text: PALETTE.slateText };
}

/**
 * Generates an executive, clean, non-CV Consultant Profile Brief PDF using the active
 * organization brand configured in General Settings.
 */
export function generateCandidateResumePdf(
  candidate: Candidate,
  formattedRate: string,
  brandOverride?: Partial<WorkspaceBrand>
): Blob {
  const brand: WorkspaceBrand = {
    ...getWorkspaceBrand(),
    ...(brandOverride || {}),
  };
  const brandName = (brand.agencyName || brand.legalEntityName || 'Staffing Agency').trim();
  const isDefaultBrand = brandName.toLowerCase() === 'talentos staffing';
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
    drawRect(cmds, 0, PAGE_HEIGHT - 42, PAGE_WIDTH, 2, PALETTE.brandIndigo);
    drawText(
      cmds,
      `${truncateTextToWidth(brandName, 250, 8.8, true)}  |  Executive Consultant Profile`,
      MARGIN_X,
      PAGE_HEIGHT - 25,
      8.8,
      true,
      PALETTE.navy
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
  // 1. TOP EXECUTIVE HEADER BANNER (Page 1)
  // =========================================================================
  drawRect(cmds, 0, 718, PAGE_WIDTH, 74, PALETTE.navy);
  drawRect(cmds, 0, 715, PAGE_WIDTH, 3, PALETTE.brandIndigo);

  const brandSize = measurePdfTextWidth(brandName, 17, true) > 280 ? 13.5 : 17;
  drawText(
    cmds,
    truncateTextToWidth(brandName, 300, brandSize, true),
    MARGIN_X,
    756,
    brandSize,
    true,
    PALETTE.white
  );

  const subtitleText =
    brandLegal && brandLegal.toLowerCase() !== brandName.toLowerCase()
      ? `${brandLegal}  •  Executive Consultant Profile Brief`
      : 'Executive Consultant Profile Brief  •  Client Submittal';
  drawText(
    cmds,
    truncateTextToWidth(subtitleText, 320, 8.4, false),
    MARGIN_X,
    737,
    8.4,
    false,
    PALETTE.lightSlateText
  );

  // Right side: Pill badge + optional agency metadata / prepared date
  const headerBadgeW = 128;
  drawRect(
    cmds,
    RIGHT_X - headerBadgeW,
    755,
    headerBadgeW,
    18,
    PALETTE.navyAlt,
    PALETTE.slateBorderDark,
    0.75
  );
  drawText(
    cmds,
    'CONSULTANT BRIEF',
    RIGHT_X - headerBadgeW / 2,
    761.2,
    7.2,
    true,
    PALETTE.brandIndigoSoft,
    'center'
  );

  const brandLocationLine = [brandHq, brandWebsite].filter(Boolean).join('  |  ');
  const brandContactLine = [brandEmail, brandPhone].filter(Boolean).join('  |  ');

  if (brandLocationLine || brandContactLine) {
    if (brandLocationLine) {
      drawText(
        cmds,
        truncateTextToWidth(brandLocationLine, 210, 7.6, false),
        RIGHT_X,
        740,
        7.6,
        false,
        PALETTE.lightSlateText,
        'right'
      );
    }
    if (brandContactLine) {
      drawText(
        cmds,
        truncateTextToWidth(brandContactLine, 210, 7.6, false),
        RIGHT_X,
        brandLocationLine ? 729 : 740,
        7.6,
        false,
        PALETTE.softText,
        'right'
      );
    }
  } else {
    drawText(
      cmds,
      `Prepared ${preparedDate}`,
      RIGHT_X,
      738,
      8.0,
      false,
      PALETTE.lightSlateText,
      'right'
    );
  }

  // =========================================================================
  // 2. SUBTLE DOCUMENT CLASSIFICATION STRIP (Clean, honest summary disclosure)
  // =========================================================================
  drawRect(cmds, MARGIN_X, 682, CONTENT_WIDTH, 22, PALETTE.surfaceSubtle, PALETTE.borderLight, 0.7);
  drawRect(cmds, MARGIN_X, 682, 2.8, 22, PALETTE.brandIndigo);
  drawText(
    cmds,
    truncateTextToWidth(
      `Prepared by ${brandName}  -  Structured CRM Profile Summary (Not original candidate CV)`,
      395,
      7.6,
      false
    ),
    MARGIN_X + 10,
    690.2,
    7.6,
    false,
    PALETTE.slateText
  );
  drawText(cmds, `Date: ${preparedDate}`, RIGHT_X - 10, 690.2, 7.6, true, PALETTE.mutedText, 'right');

  // =========================================================================
  // 3. PRESENTED CANDIDATE SPOTLIGHT CARD
  // =========================================================================
  const cardTop = 670;
  const cardHeight = 64;
  const cardBottom = cardTop - cardHeight; // 606
  drawRect(cmds, MARGIN_X, cardBottom, CONTENT_WIDTH, cardHeight, PALETTE.white, PALETTE.borderMedium, 0.8);
  drawRect(cmds, MARGIN_X, cardBottom, 3.2, cardHeight, PALETTE.brandIndigo);

  // Monogram square
  drawRect(cmds, MARGIN_X + 14, cardBottom + 11, 42, 42, PALETTE.navy);
  drawText(cmds, initials || 'C', MARGIN_X + 35, cardBottom + 27, 13.5, true, PALETTE.white, 'center');

  // Identity lines
  drawText(cmds, 'PRESENTED CONSULTANT', MARGIN_X + 68, cardBottom + 46.5, 6.8, true, PALETTE.brandIndigo);
  drawText(
    cmds,
    truncateTextToWidth(candidate.fullName || 'Consultant Profile', 285, 15.5, true),
    MARGIN_X + 68,
    cardBottom + 27.5,
    15.5,
    true,
    PALETTE.navy
  );
  drawText(
    cmds,
    truncateTextToWidth(candidate.currentTitle || 'Technology Consultant', 285, 9.4, true),
    MARGIN_X + 68,
    cardBottom + 12.5,
    9.4,
    true,
    PALETTE.slateText
  );

  // Right-aligned stage badge + rate
  const stageLabel = candidate.pipelineStage || 'Available / Bench';
  const stagePalette = getStageColors(stageLabel);
  const stageTextW = measurePdfTextWidth(stageLabel, 7.8, true);
  const stagePillW = Math.min(156, Math.max(82, stageTextW + 24));
  const stagePillX = RIGHT_X - 14 - stagePillW;
  drawRect(cmds, stagePillX, cardBottom + 34, stagePillW, 18.5, stagePalette.bg, stagePalette.border, 0.7);
  drawText(
    cmds,
    truncateTextToWidth(stageLabel, stagePillW - 14, 7.8, true),
    stagePillX + stagePillW / 2,
    cardBottom + 40.4,
    7.8,
    true,
    stagePalette.text,
    'center'
  );

  if (formattedRate) {
    drawText(
      cmds,
      truncateTextToWidth(`Bill / Target Rate: ${formattedRate}`, 170, 8.2, true),
      RIGHT_X - 14,
      cardBottom + 16.5,
      8.2,
      true,
      PALETTE.slateText,
      'right'
    );
  }

  // =========================================================================
  // 4. EXECUTIVE ATTRIBUTES MATRIX (Full-width Education so degrees never clip)
  // =========================================================================
  let matrixY = cardBottom - 10; // 596

  // Row 1: 3-column Eligibility & Ownership Strip
  const col3W = CONTENT_WIDTH / 3; // 176pt
  const row1H = 34;
  matrixY -= row1H;
  const row1Cells: Array<[string, string]> = [
    ['WORK AUTHORIZATION', candidate.workAuth || 'Authorized'],
    ['RELOCATION', candidate.relocation || 'Open'],
    ['REPRESENTING RECRUITER', candidate.assignedRecruiter || brandName],
  ];
  row1Cells.forEach(([label, value], cIdx) => {
    const cx = MARGIN_X + cIdx * col3W;
    drawRect(cmds, cx, matrixY, col3W, row1H, PALETTE.surfaceSubtle, PALETTE.borderLight, 0.7);
    drawText(cmds, label, cx + 10, matrixY + 22, 6.6, true, PALETTE.mutedText);
    drawText(
      cmds,
      truncateTextToWidth(value, col3W - 20, 8.6, true),
      cx + 10,
      matrixY + 9,
      8.6,
      true,
      PALETTE.navy
    );
  });

  // Row 2: 2-column Contact Strip
  const col2W = CONTENT_WIDTH / 2; // 264pt
  const row2H = 34;
  matrixY -= row2H;
  const row2Cells: Array<[string, string]> = [
    ['EMAIL ADDRESS', candidate.email || 'Available upon request'],
    ['DIRECT PHONE', candidate.phone || 'Available upon request'],
  ];
  row2Cells.forEach(([label, value], cIdx) => {
    const cx = MARGIN_X + cIdx * col2W;
    drawRect(cmds, cx, matrixY, col2W, row2H, PALETTE.white, PALETTE.borderLight, 0.7);
    drawText(cmds, label, cx + 10, matrixY + 22, 6.6, true, PALETTE.mutedText);
    drawText(
      cmds,
      truncateTextToWidth(value, col2W - 20, 8.6, true),
      cx + 10,
      matrixY + 9,
      8.6,
      true,
      PALETTE.navy
    );
  });

  // Row 3: Full-width Education & Academic Credentials (auto-wraps cleanly, never clipped)
  const eduLines = wrapText(resolvedEducation, CONTENT_WIDTH - 24, 8.8, true).slice(0, 3);
  const eduRowH = Math.max(34, 21 + Math.max(1, eduLines.length) * 12);
  matrixY -= eduRowH;
  drawRect(cmds, MARGIN_X, matrixY, CONTENT_WIDTH, eduRowH, PALETTE.surfaceSubtle, PALETTE.borderLight, 0.7);
  drawText(
    cmds,
    'EDUCATION & ACADEMIC CREDENTIALS',
    MARGIN_X + 10,
    matrixY + eduRowH - 11.5,
    6.6,
    true,
    PALETTE.mutedText
  );
  eduLines.forEach((line, idx) => {
    drawText(
      cmds,
      line,
      MARGIN_X + 10,
      matrixY + eduRowH - 24 - idx * 12,
      8.8,
      true,
      PALETTE.navy
    );
  });

  cursorY = matrixY - 22;

  // =========================================================================
  // 5. STRUCTURED BODY SECTIONS (Paginated cleanly)
  // =========================================================================
  let sectionCounter = 1;
  const drawSectionHeader = (title: string, rightPillText?: string) => {
    ensureSpace(40);
    const numLabel = String(sectionCounter++).padStart(2, '0');
    drawRect(cmds, MARGIN_X, cursorY - 3, 15, 15, PALETTE.brandIndigo);
    drawText(cmds, numLabel, MARGIN_X + 7.5, cursorY + 1.6, 7.2, true, PALETTE.white, 'center');
    drawText(cmds, title.toUpperCase(), MARGIN_X + 22, cursorY + 1, 9.6, true, PALETTE.navy);

    if (rightPillText) {
      const rpW = Math.max(46, measurePdfTextWidth(rightPillText, 7.2, true) + 14);
      drawRect(cmds, RIGHT_X - rpW, cursorY - 2, rpW, 14, PALETTE.pillBg, PALETTE.borderLight, 0.6);
      drawText(
        cmds,
        rightPillText,
        RIGHT_X - rpW / 2,
        cursorY + 2.2,
        7.2,
        true,
        PALETTE.slateText,
        'center'
      );
    }

    drawLine(cmds, MARGIN_X, cursorY - 9, RIGHT_X, cursorY - 9, PALETTE.borderLight, 0.85);
    cursorY -= 24;
  };

  // 01. EXECUTIVE PROFILE SUMMARY (Contained in a clean card with continuous left stripe)
  drawSectionHeader('Consultant Profile Summary');
  const overviewLines =
    summarySection && summarySection.items.length > 0
      ? summarySection.items.map((l) => cleanExtractedResumeText(l.replace(/^[•\-\s]+/, '')))
      : [
          `${candidate.currentTitle || 'Technology Consultant'}${
            skills.length > 0 ? ` specializing in ${skills.slice(0, 6).join(', ')}` : ''
          }. Prepared by ${brandName} as a structured client submittal summary.`,
        ];

  for (const para of overviewLines) {
    const wrapped = wrapText(para, CONTENT_WIDTH - 24, 9.4, false);
    if (wrapped.length === 0) continue;
    const cardH = wrapped.length * 14.5 + 16;
    ensureSpace(cardH + 6);
    const boxBottom = cursorY - cardH + 10;
    drawRect(cmds, MARGIN_X, boxBottom, CONTENT_WIDTH, cardH, PALETTE.surfaceSubtle, PALETTE.borderLight, 0.7);
    drawRect(cmds, MARGIN_X, boxBottom, 2.8, cardH, PALETTE.brandIndigo);

    let lineY = cursorY - 4;
    for (const wrappedLine of wrapped) {
      if (wrappedLine) {
        drawText(cmds, wrappedLine, MARGIN_X + 12, lineY, 9.4, false, PALETTE.slateText);
      }
      lineY -= 14.5;
    }
    cursorY = boxBottom - 16;
  }

  // 02. CORE COMPETENCIES & TECHNICAL STACK
  if (skills.length > 0) {
    drawSectionHeader(
      'Core Competencies & Technical Stack',
      `${skills.length} ${skills.length === 1 ? 'skill' : 'skills'}`
    );
    let pillX = MARGIN_X;
    const pillHeight = 19;
    const gapX = 6;
    const rowStep = 25;

    ensureSpace(pillHeight + 8);
    for (const skill of skills) {
      const safeLabel = truncateTextToWidth(skill, CONTENT_WIDTH - 28, 8.2, true);
      const pillW = Math.min(CONTENT_WIDTH, measurePdfTextWidth(safeLabel, 8.2, true) + 20);

      if (pillX + pillW > RIGHT_X && pillX > MARGIN_X) {
        cursorY -= rowStep;
        ensureSpace(pillHeight + 8);
        pillX = MARGIN_X;
      }

      const pillBottom = cursorY - pillHeight + 11;
      drawRect(cmds, pillX, pillBottom, pillW, pillHeight, PALETTE.white, PALETTE.borderMedium, 0.7);
      drawText(cmds, safeLabel, pillX + pillW / 2, pillBottom + 6.4, 8.2, true, PALETTE.navyAlt, 'center');
      pillX += pillW + gapX;
    }
    cursorY -= 32;
  }

  // 03. EXTRACTED HIGHLIGHTS OR SUBMITTAL READINESS SUMMARY
  if (detailSections.length > 0) {
    drawSectionHeader('Extracted Profile Highlights & Experience');
    for (const section of detailSections) {
      ensureSpace(26);
      drawText(cmds, section.title.toUpperCase(), MARGIN_X, cursorY, 8.4, true, PALETTE.brandIndigo);
      cursorY -= 14;

      for (const rawLine of section.items) {
        const isBullet = rawLine.startsWith('•');
        const cleanedLine = cleanExtractedResumeText(
          isBullet ? rawLine.slice(1).trim() : rawLine
        );
        const textMaxW = isBullet ? CONTENT_WIDTH - 16 : CONTENT_WIDTH - 4;
        const wrapped = wrapText(cleanedLine, textMaxW, 9.0, false);

        wrapped.forEach((wLine, idx) => {
          ensureSpace(14);
          if (isBullet && idx === 0) {
            drawRect(cmds, MARGIN_X + 4, cursorY + 2.2, 3.2, 3.2, PALETTE.brandIndigo);
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
  } else {
    drawSectionHeader('Submittal Readiness & Agency Endorsement');
    const summaryPairs: Array<[string, string]> = [
      ['Primary Specialization', candidate.currentTitle || 'Technology Consultant'],
      ['Pipeline Readiness', stageLabel],
      ['Work Eligibility', candidate.workAuth || 'Authorized'],
      ['Relocation Flexibility', candidate.relocation || 'Open'],
    ];

    const halfW = CONTENT_WIDTH / 2;
    const itemH = 30;
    ensureSpace(itemH * 2 + 12);
    summaryPairs.forEach(([lbl, val], idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cellX = MARGIN_X + col * halfW;
      const cellY = cursorY - (row + 1) * itemH + 10;
      drawRect(
        cmds,
        cellX,
        cellY,
        halfW,
        itemH,
        row % 2 === 0 ? PALETTE.surfaceSubtle : PALETTE.white,
        PALETTE.borderLight,
        0.65
      );
      drawText(cmds, lbl.toUpperCase(), cellX + 10, cellY + 19, 6.6, true, PALETTE.mutedText);
      drawText(
        cmds,
        truncateTextToWidth(val, halfW - 20, 8.6, true),
        cellX + 10,
        cellY + 7,
        8.6,
        true,
        PALETTE.navy
      );
    });
    cursorY -= itemH * 2 + 14;

    if (educationSection && educationSection.items.length > 0) {
      const eduNotes = educationSection.items
        .map((i) => cleanExtractedResumeText(i.replace(/^[•\-\s]+/, '')))
        .filter((line) => line.toLowerCase() !== resolvedEducation.toLowerCase())
        .join('  •  ');
      if (eduNotes) {
        const wrappedEdu = wrapText(`Academic Details: ${eduNotes}`, CONTENT_WIDTH - 16, 8.8, false);
        ensureSpace(wrappedEdu.length * 13 + 8);
        for (const line of wrappedEdu) {
          drawText(cmds, line, MARGIN_X + 4, cursorY, 8.8, false, PALETTE.slateText);
          cursorY -= 13;
        }
        cursorY -= 4;
      }
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
          drawText(cmds, labelPrefix, MARGIN_X + 4, cursorY, 8.8, true, PALETTE.navy);
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
      PALETTE.slateText
    );
    drawText(
      pageCmds,
      truncateTextToWidth(
        `Structured consultant brief prepared by ${brandName} (CRM summary - not original candidate CV)`,
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
