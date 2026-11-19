import crypto from 'node:crypto';

export interface CandidateChunkDraft {
  chunkIndex: number;
  sectionType: 'PROFILE' | 'RESUME';
  chunkText: string;
  contentHash: string;
}

const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_CHUNK_OVERLAP = 150;
const MAX_CHUNKS_PER_CANDIDATE = 18;

/**
 * Scrubs candidate contact PII and financial hourly/annual rates before indexing/embedding.
 */
export function scrubChunkPiiAndRates(rawText: string): string {
  return String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, ' ')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, ' ')
    .replace(
      /(?:[$£€₹]\s*\d[\d,]*(?:\.\d+)?(?:\s*[-–/]\s*[$£€₹]?\s*\d[\d,]*(?:\.\d+)?)?(?:\s*(?:\/|\s*per\s*)(?:hr|hour|wk|week|mo|month|yr|year|annum))?|\b\d+(?:\.\d+)?\s*(?:k|usd|inr|eur|gbp)?\s*(?:\/|\s*per\s*)(?:hr|hour|yr|year|annum)\b|\b(?:bill\s*rate|pay\s*rate|hourly\s*rate|target\s*rate|w2\s*rate|c2c\s*rate|margin)\b[^.\n]{0,40})/gi,
      ' '
    )
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function hashChunkContent(sectionType: string, chunkText: string, embeddingModel = ''): string {
  return crypto
    .createHash('sha256')
    .update(`${sectionType}\n${embeddingModel}\n${chunkText}`)
    .digest('hex');
}

/**
 * Splits long multi-page resume text into clean overlapping chunks respecting paragraph/line boundaries.
 */
export function splitResumeTextIntoChunks(
  rawText: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP,
  maxChunks = MAX_CHUNKS_PER_CANDIDATE - 1
): string[] {
  const clean = scrubChunkPiiAndRates(rawText);
  if (!clean) return [];

  const blocks = clean
    .split(/\n{2,}/)
    .map((b) => b.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((b) => b.length >= 20);

  if (blocks.length === 0) return [clean.slice(0, chunkSize)];

  const chunks: string[] = [];
  let current = '';

  const pushWithOverlap = (blockToFinish: string) => {
    chunks.push(blockToFinish);
    if (overlap <= 0 || blockToFinish.length <= overlap) return '';
    const tail = blockToFinish.slice(-overlap);
    const spaceIdx = tail.indexOf(' ');
    return spaceIdx >= 0 ? tail.slice(spaceIdx + 1) : tail;
  };

  for (const block of blocks) {
    if (block.length > chunkSize) {
      if (current) {
        current = pushWithOverlap(current);
        if (chunks.length >= maxChunks) break;
      }
      // Split oversized block cleanly at word boundaries
      let start = 0;
      while (start < block.length && chunks.length < maxChunks) {
        let end = Math.min(block.length, start + chunkSize);
        if (end < block.length) {
          const lastSpace = block.lastIndexOf(' ', end);
          if (lastSpace > start + Math.floor(chunkSize * 0.5)) {
            end = lastSpace;
          }
        }
        const piece = block.slice(start, end).trim();
        if (piece) chunks.push(piece);
        if (end >= block.length) break;
        start = Math.max(end - overlap, start + 1);
      }
      current = '';
      if (chunks.length >= maxChunks) break;
      continue;
    }

    const candidate = current ? `${current}\n${block}` : block;
    if (candidate.length <= chunkSize) {
      current = candidate;
    } else {
      const carry = pushWithOverlap(current);
      if (chunks.length >= maxChunks) break;
      current = carry ? `${carry}\n${block}`.slice(0, chunkSize + 80) : block;
    }
  }

  if (current && chunks.length < maxChunks) {
    chunks.push(current.trim());
  }

  return chunks.slice(0, maxChunks);
}

/**
 * Builds deterministic PROFILE + RESUME chunks across full candidate profile and multi-page CV text.
 */
export function buildCandidateChunks(candidate: {
  currentTitle?: string | null;
  skillset?: string | null;
  workAuth?: string | null;
  education?: string | null;
  relocation?: string | null;
  rawSnippet?: string | null;
}): CandidateChunkDraft[] {
  const parts: string[] = [];
  if (candidate.currentTitle?.trim()) parts.push(`Role Title: ${candidate.currentTitle.trim()}`);
  if (candidate.skillset?.trim()) parts.push(`Core Skills: ${candidate.skillset.trim()}`);
  if (candidate.education?.trim()) parts.push(`Education: ${candidate.education.trim()}`);
  if (candidate.workAuth?.trim()) parts.push(`Work Authorization: ${candidate.workAuth.trim()}`);
  if (candidate.relocation?.trim()) parts.push(`Relocation: ${candidate.relocation.trim()}`);

  const profileHeader = scrubChunkPiiAndRates(parts.join('\n'));
  const resumeSegments = splitResumeTextIntoChunks(String(candidate.rawSnippet || ''));

  const result: CandidateChunkDraft[] = [];

  const profileText = [
    profileHeader,
    resumeSegments.length > 0 ? `Summary Excerpt: ${resumeSegments[0].slice(0, 350)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .trim();

  if (profileText) {
    result.push({
      chunkIndex: 0,
      sectionType: 'PROFILE',
      chunkText: profileText,
      contentHash: hashChunkContent('PROFILE', profileText),
    });
  }

  for (const seg of resumeSegments) {
    if (!seg || seg.length < 15) continue;
    const chunkIndex = result.length;
    result.push({
      chunkIndex,
      sectionType: 'RESUME',
      chunkText: seg,
      contentHash: hashChunkContent('RESUME', seg),
    });
    if (result.length >= MAX_CHUNKS_PER_CANDIDATE) break;
  }

  return result;
}

/**
 * Builds a clean semantic + keyword search query representing a job requirement.
 */
export function buildRequirementSearchQuery(req: {
  opportunityTitle?: string | null;
  skillsRequired?: string | null;
  location?: string | null;
  workModel?: string | null;
  publicDescription?: string | null;
  rawEmailText?: string | null;
}): {
  queryText: string;
  skillTokens: string[];
} {
  const skillTokens = Array.from(
    new Set(
      String(req.skillsRequired || '')
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2)
    )
  ).slice(0, 20);

  const rawBody = scrubChunkPiiAndRates(
    String(req.publicDescription || req.rawEmailText || '').replace(/<[^>]+>/g, ' ')
  ).slice(0, 1800);

  const lines: string[] = [];
  if (req.opportunityTitle?.trim()) lines.push(`Role: ${req.opportunityTitle.trim()}`);
  if (skillTokens.length > 0) lines.push(`Required Skills: ${skillTokens.join(', ')}`);
  if (req.workModel?.trim() || req.location?.trim()) {
    lines.push(
      `Location / Work Model: ${[req.workModel, req.location].filter(Boolean).join(' - ')}`
    );
  }
  if (rawBody) lines.push(`Role Context: ${rawBody}`);

  return {
    queryText: lines.join('\n').trim() || 'Technical Consultant',
    skillTokens,
  };
}
