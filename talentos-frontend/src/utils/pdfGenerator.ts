import { Candidate } from '../types';

interface StyledLine {
  text: string;
  font: 'F1' | 'F2'; // F1 = Helvetica, F2 = Helvetica-Bold
  size: number;
  leading: number;
  color: [number, number, number];
  align?: 'left' | 'center';
  ruleBelow?: boolean;
  ruleColor?: [number, number, number];
  gapAfter?: number;
}

/**
 * Normalizes text to WinAnsi/ASCII-safe printable characters and escapes PDF string literals.
 */
function sanitizePdfText(input: string): string {
  const normalized = String(input || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ');
  return normalized
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Approximates Helvetica/Helvetica-Bold glyph width in points to wrap text accurately to a fixed width.
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
        // Handle single very long token cleanly
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

/**
 * Builds a multi-page, standards-compliant PDF-1.4 document for an extracted candidate profile.
 */
export function generateCandidateResumePdf(candidate: Candidate, formattedRate: string): Blob {
  const pageWidth = 612; // US Letter width in pt
  const pageHeight = 792; // US Letter height in pt
  const marginX = 50;
  const contentWidth = pageWidth - marginX * 2;
  const topY = 742;
  const bottomY = 60;

  const skills = (candidate.skillset || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const lines: StyledLine[] = [];

  // Candidate Banner
  lines.push({
    text: candidate.fullName || 'Consultant Profile',
    font: 'F2',
    size: 19,
    leading: 24,
    color: [0.06, 0.09, 0.16],
    align: 'center',
  });

  if (candidate.currentTitle) {
    lines.push({
      text: candidate.currentTitle,
      font: 'F2',
      size: 11.5,
      leading: 16,
      color: [0.15, 0.39, 0.92],
      align: 'center',
    });
  }

  const metaParts = [
    candidate.email,
    candidate.phone,
    candidate.workAuth,
    candidate.relocation ? `Relocation: ${candidate.relocation}` : '',
    formattedRate && !formattedRate.includes('•') ? `Rate: ${formattedRate}` : '',
  ].filter(Boolean);

  for (const metaLine of wrapText(metaParts.join('  |  '), contentWidth, 9, false)) {
    lines.push({
      text: metaLine,
      font: 'F1',
      size: 9,
      leading: 13,
      color: [0.39, 0.45, 0.55],
      align: 'center',
    });
  }

  lines.push({
    text: '',
    font: 'F1',
    size: 6,
    leading: 8,
    color: [0, 0, 0],
    ruleBelow: true,
    ruleColor: [0.85, 0.88, 0.93],
    gapAfter: 12,
  });

  const addSectionHeading = (title: string) => {
    lines.push({
      text: title.toUpperCase(),
      font: 'F2',
      size: 9.5,
      leading: 14,
      color: [0.12, 0.25, 0.69],
      ruleBelow: true,
      ruleColor: [0.86, 0.91, 0.99],
      gapAfter: 6,
    });
  };

  // Executive Summary
  addSectionHeading('Executive Summary');
  const summaryText = `Results-driven ${candidate.currentTitle || 'technology specialist'} with enterprise experience across high-growth systems. Proven track record delivering reliable cloud infrastructure, scalable architectures, and secure production solutions.${skills.length ? ` Core technical expertise in ${skills.join(', ')}.` : ''}`;
  for (const l of wrapText(summaryText, contentWidth, 10, false)) {
    lines.push({
      text: l,
      font: 'F1',
      size: 10,
      leading: 14.5,
      color: [0.2, 0.25, 0.33],
    });
  }
  lines.push({ text: '', font: 'F1', size: 8, leading: 10, color: [0, 0, 0] });

  // Core Competencies
  if (skills.length > 0) {
    addSectionHeading('Core Competencies & Technologies');
    for (const l of wrapText(skills.join('   -   '), contentWidth, 10, true)) {
      lines.push({
        text: l,
        font: 'F2',
        size: 10,
        leading: 14.5,
        color: [0.12, 0.16, 0.23],
      });
    }
    lines.push({ text: '', font: 'F1', size: 8, leading: 10, color: [0, 0, 0] });
  }

  // Experience / Resume Details
  addSectionHeading(candidate.rawSnippet ? 'Extracted Resume Content & Experience' : 'Professional Experience');
  const experienceText =
    candidate.rawSnippet?.trim() ||
    `${candidate.currentTitle || 'Senior Consultant'} - Enterprise Staffing & Consulting\nSpecializing in ${skills.join(', ') || 'enterprise software delivery'} with verified project execution.`;

  for (const l of wrapText(experienceText, contentWidth, 9.5, false)) {
    lines.push({
      text: l,
      font: 'F1',
      size: 9.5,
      leading: 13.5,
      color: [0.22, 0.27, 0.35],
    });
  }
  lines.push({ text: '', font: 'F1', size: 8, leading: 10, color: [0, 0, 0] });

  // Education & Credentials
  addSectionHeading('Education & Credentials');
  for (const l of wrapText(candidate.education || 'Accredited University Degree', contentWidth, 10, true)) {
    lines.push({
      text: l,
      font: 'F2',
      size: 10,
      leading: 14,
      color: [0.12, 0.16, 0.23],
    });
  }
  lines.push({
    text: `Work Authorization: ${candidate.workAuth || 'Verified'}  |  Relocation: ${candidate.relocation || 'Open'}`,
    font: 'F1',
    size: 9.5,
    leading: 14,
    color: [0.39, 0.45, 0.55],
  });

  // Paginate lines into PDF page streams
  const pages: string[][] = [[]];
  let y = topY;

  for (const line of lines) {
    const needed = line.leading + (line.gapAfter || 0);
    if (y - needed < bottomY) {
      pages.push([]);
      y = topY;
    }

    const cmds = pages[pages.length - 1];
    if (line.text) {
      const isBold = line.font === 'F2';
      let x = marginX;
      if (line.align === 'center') {
        const w = estimateTextWidth(line.text, line.size, isBold);
        x = Math.max(marginX, (pageWidth - w) / 2);
      }
      const [r, g, b] = line.color;
      cmds.push(
        `BT /${line.font} ${line.size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${sanitizePdfText(line.text)}) Tj ET`
      );
    }

    if (line.ruleBelow) {
      const ruleY = y - 4;
      const [rr, rg, rb] = line.ruleColor || [0.85, 0.88, 0.93];
      cmds.push(
        `q ${rr.toFixed(3)} ${rg.toFixed(3)} ${rb.toFixed(3)} RG 0.8 w ${marginX} ${ruleY.toFixed(2)} m ${pageWidth - marginX} ${ruleY.toFixed(2)} l S Q`
      );
    }

    y -= needed;
  }

  // Add subtle footer to every page
  const totalPages = pages.length;
  pages.forEach((cmds, idx) => {
    const footerText = `Extracted Consultant Profile  -  Page ${idx + 1} of ${totalPages}`;
    cmds.push(
      `q 0.900 0.920 0.950 RG 0.5 w ${marginX} 42 m ${pageWidth - marginX} 42 l S Q`,
      `BT /F1 8 Tf 0.550 0.600 0.680 rg ${marginX} 28 Td (${sanitizePdfText(footerText)}) Tj ET`
    );
  });

  // Assemble PDF objects:
  // 1: Catalog, 2: Pages, 3: F1 Helvetica, 4: F2 Helvetica-Bold, then pairs of (Page, Content)
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');

  const pageObjNums: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(5 + i * 2);
  }
  objects.push(`<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  pages.forEach((cmds, i) => {
    const pageObjNum = 5 + i * 2;
    const contentObjNum = pageObjNum + 1;
    const stream = cmds.join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>`
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

