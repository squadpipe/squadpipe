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
const MARGIN_X = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2; // 524pt
const RIGHT_X = PAGE_WIDTH - MARGIN_X; // 568pt
const BOTTOM_LIMIT_Y = 66;

const PALETTE = {
  navy: [15, 23, 42] as RgbColor,
  navyAlt: [30, 41, 59] as RgbColor,
  slateBorderDark: [71, 85, 105] as RgbColor,
  slateText: [51, 65, 85] as RgbColor,
  mutedText: [100, 116, 139] as RgbColor,
  softText: [148, 163, 184] as RgbColor,
  lightSlateText: [203, 213, 225] as RgbColor,
  brandIndigo: [67, 97, 238] as RgbColor,
  brandIndigoSoft: [191, 208, 253] as RgbColor,
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

/**
 * Normalizes text to ASCII-safe printable WinAnsi characters and escapes PDF string literals.
 */
function sanitizePdfText(input: string): string {
  const ascii = String(input || '')
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

  return ascii.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function rgbStr(color: RgbColor): string {
  return `${(color[0] / 255).toFixed(3)} ${(color[1] / 255).toFixed(3)} ${(color[2] / 255).toFixed(3)}`;
}

/**
 * Estimates Helvetica / Helvetica-Bold string width in points for precise wrapping and pill layout.
 */
function estimateTextWidth(text: string, size: number, bold: boolean): number {
  let factor = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ('ilI.,;:\'|! '.includes(ch)) factor += 0.28;
    else if ('mwMW@%'.includes(ch)) factor += 0.78;
    else if (ch >= 'A' && ch <= 'Z') factor += 0.65;
    else factor += 0.51;
  }
  return factor * size * (bold ? 1.05 : 1);
}

function truncateTextToWidth(text: string, maxWidth: number, size: number, bold: boolean): string {
  const clean = String(text || '').trim();
  if (estimateTextWidth(clean, size, bold) <= maxWidth) return clean;
  let out = '';
  for (let i = 0; i < clean.length; i++) {
    const candidate = `${out}${clean[i]}...`;
    if (estimateTextWidth(candidate, size, bold) > maxWidth) {
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
      if (estimateTextWidth(next, size, bold) <= maxWidth) {
        current = next;
      } else {
        if (current) result.push(current);
        if (estimateTextWidth(word, size, bold) > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (estimateTextWidth(chunk + ch, size, bold) > maxWidth && chunk) {
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
  const raw = String(text || '').trim();
  if (!raw) return;
  const textW = estimateTextWidth(raw, size, bold);
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
 * Generates a branded, non-CV executive Consultant Profile Brief PDF using the active
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
  const brandName = (brand.agencyName || brand.legalEntityName || 'TalentOS Staffing').trim();
  const brandLegal = (brand.legalEntityName || '').trim();

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

    // Subtle running corporate header bar on continuation pages
    drawRect(cmds, 0, PAGE_HEIGHT - 38, PAGE_WIDTH, 38, PALETTE.surfaceSubtle);
    drawLine(cmds, 0, PAGE_HEIGHT - 38, PAGE_WIDTH, PAGE_HEIGHT - 38, PALETTE.borderLight, 0.8);
    drawLine(cmds, 0, PAGE_HEIGHT - 40, PAGE_WIDTH, PAGE_HEIGHT - 40, PALETTE.brandIndigo, 1.5);
    drawText(
      cmds,
      `${truncateTextToWidth(brandName, 240, 8.5, true)}  |  Consultant Profile Brief`,
      MARGIN_X,
      PAGE_HEIGHT - 24,
      8.5,
      true,
      PALETTE.navy
    );
    drawText(
      cmds,
      truncateTextToWidth(`${candidate.fullName || 'Consultant'} (Continued)`, 220, 8.2, false),
      RIGHT_X,
      PAGE_HEIGHT - 24,
      8.2,
      false,
      PALETTE.mutedText,
      'right'
    );

    cursorY = PAGE_HEIGHT - 64;
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < BOTTOM_LIMIT_Y) {
      startContinuationPage();
    }
  };

  // =========================================================================
  // 1. TOP BRANDED AGENCY HEADER BANNER (Page 1)
  // =========================================================================
  drawRect(cmds, 0, 714, PAGE_WIDTH, 78, PALETTE.navy);
  drawRect(cmds, 0, 710, PAGE_WIDTH, 4, PALETTE.brandIndigo);

  const brandSize = estimateTextWidth(brandName, 15, true) > 280 ? 12.5 : 15;
  drawText(
    cmds,
    truncateTextToWidth(brandName, 295, brandSize, true),
    MARGIN_X,
    756,
    brandSize,
    true,
    PALETTE.white
  );

  const subtitleText =
    brandLegal && brandLegal.toLowerCase() !== brandName.toLowerCase()
      ? `${brandLegal}  |  Consultant Profile Brief`
      : 'Consultant Profile Brief  |  Client Submittal Summary';
  drawText(
    cmds,
    truncateTextToWidth(subtitleText, 305, 8.2, false),
    MARGIN_X,
    738,
    8.2,
    false,
    PALETTE.softText
  );

  // Top-right badge + agency contact metadata
  drawRect(cmds, RIGHT_X - 134, 753, 134, 19, PALETTE.navyAlt, PALETTE.slateBorderDark, 0.7);
  drawText(
    cmds,
    'CONSULTANT BRIEF',
    RIGHT_X - 67,
    759.8,
    7.4,
    true,
    PALETTE.brandIndigoSoft,
    'center'
  );

  const brandLocationLine = [brand.headquarters, cleanDisplayUrl(brand.website)]
    .filter(Boolean)
    .join('  |  ');
  const brandContactLine = [brand.supportEmail, brand.supportPhone].filter(Boolean).join('  |  ');

  if (brandLocationLine) {
    drawText(
      cmds,
      truncateTextToWidth(brandLocationLine, 210, 7.6, false),
      RIGHT_X,
      738,
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
      726,
      7.6,
      false,
      PALETTE.softText,
      'right'
    );
  }

  // =========================================================================
  // 2. EXPLICIT BRIEF NOTICE CALLOUT (Not Original CV)
  // =========================================================================
  drawRect(cmds, MARGIN_X, 678, CONTENT_WIDTH, 22, PALETTE.surfaceSubtle, PALETTE.borderLight, 0.75);
  drawRect(cmds, MARGIN_X, 678, 3, 22, PALETTE.brandIndigo);

  const preparedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const noticeText = truncateTextToWidth(
    `Notice: Branded summary brief prepared by ${brandName} ( Not original CV document).`,
    410,
    7.6,
    false
  );
  drawText(cmds, noticeText, MARGIN_X + 10, 686.2, 7.6, false, PALETTE.slateText);
  drawText(cmds, `Prepared ${preparedDate}`, RIGHT_X - 9, 686.2, 7.6, true, PALETTE.mutedText, 'right');

  // =========================================================================
  // 3. PRESENTED CANDIDATE SPOTLIGHT CARD
  // =========================================================================
  drawRect(cmds, MARGIN_X, 606, CONTENT_WIDTH, 62, PALETTE.white, PALETTE.borderMedium, 0.8);

  // Monogram square
  drawRect(cmds, MARGIN_X + 14, 617, 40, 40, PALETTE.navy);
  drawText(cmds, initials || 'C', MARGIN_X + 34, 632.3, 13, true, PALETTE.white, 'center');

  // Identity lines
  drawText(cmds, 'PRESENTED CONSULTANT', MARGIN_X + 66, 650, 7.2, true, PALETTE.brandIndigo);
  drawText(
    cmds,
    truncateTextToWidth(candidate.fullName || 'Consultant Profile', 285, 14.5, true),
    MARGIN_X + 66,
    632,
    14.5,
    true,
    PALETTE.navy
  );
  drawText(
    cmds,
    truncateTextToWidth(candidate.currentTitle || 'Technology Consultant', 285, 9.2, true),
    MARGIN_X + 66,
    617,
    9.2,
    true,
    PALETTE.slateText
  );

  // Stage badge + rate on right of spotlight card
  const stageLabel = candidate.pipelineStage || 'Available / Bench';
  const stagePalette = getStageColors(stageLabel);
  const stagePillW = Math.min(148, Math.max(88, estimateTextWidth(stageLabel, 7.8, true) + 22));
  const stagePillX = RIGHT_X - 14 - stagePillW;
  drawRect(cmds, stagePillX, 637, stagePillW, 18, stagePalette.bg, stagePalette.border, 0.7);
  drawText(
    cmds,
    truncateTextToWidth(stageLabel, stagePillW - 12, 7.8, true),
    stagePillX + stagePillW / 2,
    643.2,
    7.8,
    true,
    stagePalette.text,
    'center'
  );

  if (formattedRate) {
    drawText(
      cmds,
      truncateTextToWidth(`Rate: ${formattedRate}`, 155, 8.2, true),
      RIGHT_X - 14,
      620,
      8.2,
      true,
      PALETTE.slateText,
      'right'
    );
  }

  // =========================================================================
  // 4. EXECUTIVE 2-COLUMN ATTRIBUTES MATRIX
  // =========================================================================
  const metadataRows: Array<[string, string, string, string]> = [
    [
      'EMAIL ADDRESS',
      candidate.email || 'On request',
      'DIRECT PHONE',
      candidate.phone || 'On request',
    ],
    [
      'WORK AUTHORIZATION',
      candidate.workAuth || 'Authorized',
      'RELOCATION PREFERENCE',
      candidate.relocation || 'Open',
    ],
    [
      'EDUCATION',
      resolvedEducation,
      'REPRESENTING RECRUITER',
      candidate.assignedRecruiter || brandName,
    ],
  ];

  const colW = CONTENT_WIDTH / 2; // 262pt
  const rowH = 33;
  let tableTopY = 596;

  metadataRows.forEach(([labelL, valL, labelR, valR], rIdx) => {
    const yBot = tableTopY - (rIdx + 1) * rowH;
    const rowBg = rIdx % 2 === 0 ? PALETTE.surfaceSubtle : PALETTE.white;

    drawRect(cmds, MARGIN_X, yBot, colW, rowH, rowBg, PALETTE.borderLight, 0.7);
    drawRect(cmds, MARGIN_X + colW, yBot, colW, rowH, rowBg, PALETTE.borderLight, 0.7);

    drawText(cmds, labelL, MARGIN_X + 10, yBot + 21, 6.8, true, PALETTE.mutedText);
    drawText(
      cmds,
      truncateTextToWidth(valL, colW - 20, 8.6, true),
      MARGIN_X + 10,
      yBot + 8.5,
      8.6,
      true,
      PALETTE.navy
    );

    drawText(cmds, labelR, MARGIN_X + colW + 10, yBot + 21, 6.8, true, PALETTE.mutedText);
    drawText(
      cmds,
      truncateTextToWidth(valR, colW - 20, 8.6, true),
      MARGIN_X + colW + 10,
      yBot + 8.5,
      8.6,
      true,
      PALETTE.navy
    );
  });

  cursorY = tableTopY - metadataRows.length * rowH - 22;

  // =========================================================================
  // 5. STRUCTURED BODY SECTIONS (Paginated cleanly)
  // =========================================================================
  let sectionCounter = 1;
  const drawSectionHeader = (title: string) => {
    ensureSpace(36);
    const numLabel = String(sectionCounter++).padStart(2, '0');
    drawRect(cmds, MARGIN_X, cursorY - 2.5, 14, 14, PALETTE.brandIndigo);
    drawText(cmds, numLabel, MARGIN_X + 7, cursorY + 1.8, 7.2, true, PALETTE.white, 'center');
    drawText(cmds, title.toUpperCase(), MARGIN_X + 21, cursorY + 1, 9.6, true, PALETTE.navy);
    drawLine(cmds, MARGIN_X, cursorY - 8, RIGHT_X, cursorY - 8, PALETTE.borderLight, 0.85);
    cursorY -= 24;
  };

  // 01. CONSULTANT OVERVIEW
  drawSectionHeader('Consultant Profile Summary');
  const overviewLines =
    summarySection && summarySection.items.length > 0
      ? summarySection.items.map((l) => cleanExtractedResumeText(l.replace(/^[•\-\s]+/, '')))
      : [
        `${candidate.currentTitle || 'Technology Consultant'}${skills.length > 0 ? ` specializing in ${skills.slice(0, 6).join(', ')}` : ''
        }. Prepared by ${brandName} as a structured client submittal summary.`,
      ];

  for (const para of overviewLines) {
    const wrapped = wrapText(para, CONTENT_WIDTH - 10, 9.4, false);
    if (wrapped.length === 0) continue;
    const blockHeight = wrapped.length * 14;
    ensureSpace(blockHeight + 4);
    const barTop = cursorY + 9;
    for (const wrappedLine of wrapped) {
      if (wrappedLine) {
        drawText(cmds, wrappedLine, MARGIN_X + 10, cursorY, 9.4, false, PALETTE.slateText);
      }
      cursorY -= 14;
    }
    const barBottom = cursorY + 11;
    drawRect(
      cmds,
      MARGIN_X,
      barBottom,
      2.4,
      Math.max(10, barTop - barBottom),
      PALETTE.brandIndigo
    );
  }
  cursorY -= 12;

  // 02. TECHNICAL COMPETENCIES (Rendered as crisp vector pill badges)
  if (skills.length > 0) {
    drawSectionHeader('Core Competencies & Technical Stack');
    let pillX = MARGIN_X;
    const pillHeight = 18;
    const gapX = 6;
    const rowStep = 24;

    ensureSpace(pillHeight + 8);
    for (const skill of skills) {
      const safeLabel = truncateTextToWidth(skill, CONTENT_WIDTH - 24, 8.2, true);
      const pillW = Math.min(CONTENT_WIDTH, estimateTextWidth(safeLabel, 8.2, true) + 18);

      if (pillX + pillW > RIGHT_X && pillX > MARGIN_X) {
        cursorY -= rowStep;
        ensureSpace(pillHeight + 8);
        pillX = MARGIN_X;
      }

      const pillBottom = cursorY - pillHeight + 11;
      drawRect(cmds, pillX, pillBottom, pillW, pillHeight, PALETTE.pillBg, PALETTE.borderMedium, 0.6);
      drawText(cmds, safeLabel, pillX + pillW / 2, pillBottom + 6.0, 8.2, true, PALETTE.navyAlt, 'center');
      pillX += pillW + gapX;
    }
    cursorY -= 32;
  }

  // 03. EXTRACTED HIGHLIGHTS OR CRM SUBMISSION SCOPE
  if (detailSections.length > 0) {
    drawSectionHeader('Extracted Profile Highlights & Background');
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
          cursorY -= 13.5;
        });
      }
      cursorY -= 8;
    }
  } else {
    drawSectionHeader('Submittal Scope & Record Notes');
    const noteLines = [
      `This document is a structured consultant brief generated by ${brandName} from CRM profile records.`,
      'It intentionally summarizes candidate readiness, eligibility, and core technical stack rather than reproducing a personal CV format.',
    ];
    if (educationSection && educationSection.items.length > 0) {
      noteLines.push(
        `Education Record: ${educationSection.items
          .map((i) => cleanExtractedResumeText(i.replace(/^[•\-\s]+/, '')))
          .join(' | ')}`
      );
    }
    const wrappedNote: string[] = [];
    noteLines.forEach((n) => wrappedNote.push(...wrapText(n, CONTENT_WIDTH - 20, 8.8, false)));

    const boxHeight = wrappedNote.length * 13 + 16;
    ensureSpace(boxHeight + 6);
    drawRect(
      cmds,
      MARGIN_X,
      cursorY - boxHeight + 10,
      CONTENT_WIDTH,
      boxHeight,
      PALETTE.surfaceSubtle,
      PALETTE.borderLight,
      0.75
    );
    let innerY = cursorY - 4;
    for (const line of wrappedNote) {
      drawText(cmds, line, MARGIN_X + 10, innerY, 8.8, false, PALETTE.slateText);
      innerY -= 13;
    }
    cursorY -= boxHeight + 10;
  }

  // 04. ADDITIONAL CUSTOM ATTRIBUTES (if present)
  const customEntries = Object.entries(candidate.customFields || {}).filter(
    ([, val]) => val !== null && val !== undefined && String(val).trim() !== ''
  );
  if (customEntries.length > 0) {
    drawSectionHeader('Additional Profile Attributes');
    for (const [k, v] of customEntries) {
      const labelPrefix = `${k}: `;
      const prefixW = estimateTextWidth(labelPrefix, 8.8, true);
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
  const footerMeta = [brandName, cleanDisplayUrl(brand.website), brand.supportEmail]
    .filter(Boolean)
    .join('  |  ');

  pages.forEach((pageCmds, idx) => {
    drawLine(pageCmds, MARGIN_X, 48, RIGHT_X, 48, PALETTE.borderLight, 0.75);
    drawText(
      pageCmds,
      truncateTextToWidth(footerMeta, 420, 7.6, true),
      MARGIN_X,
      34,
      7.6,
      true,
      PALETTE.slateText
    );
    drawText(
      pageCmds,
      truncateTextToWidth(
        `Summary brief generated by ${brandName} (Not an original candidate CV)`,
        420,
        7.0,
        false
      ),
      MARGIN_X,
      23,
      7.0,
      false,
      PALETTE.softText
    );
    drawText(
      pageCmds,
      `Page ${idx + 1} of ${totalPages}`,
      RIGHT_X,
      34,
      7.6,
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
