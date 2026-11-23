import { prisma } from '../config/prisma.config';
import {
  CandidateLawfulBasis,
  CandidatePipelineStage,
  ConsentStatus,
  PlacementStatus,
  Prisma,
} from '@prisma/client';
import {
  cvStorageService,
  parseCvStorageUri,
  StoredCvMetadata,
  UploadedCvFile,
} from './cvStorage.service';
import { getTenantSettings } from '../config/smtp.config';
import {
  complianceService,
  computeRetentionExpiresAt,
  CURRENT_PRIVACY_NOTICE_VERSION,
  resolveConsentConfirmation,
} from './compliance.service';
import { parseCustomFields } from '../utils/customFields';
import { parseRateNumber } from '../utils/rateParser';
import { candidateIndexingService } from './vector/candidateIndexing.service';
import {
  SortDirection,
  buildPrismaOrderBy,
  sortRecordsByColumn,
} from '../utils/tableSort';
import {
  compileBooleanAstToPrismaWhere,
  compileBooleanAstToSql,
  parseBooleanSearchQuery,
} from '../utils/booleanSearch';
import {
  canonicalizeSkillExact,
  damerauLevenshtein,
  evaluateNormalizedSkillOverlap,
  extractNormalizedSkills,
  isKnownCanonicalSkill,
  normalizeSkillWithTypoFallback,
  splitSkillItems,
  type SkillTypoCorrection,
} from '../utils/skillMatcher';

export const CANDIDATE_SORTABLE_FIELDS = [
  'fullName',
  'workAuth',
  'currentTitle',
  'hourlyRate',
  'relocation',
  'stage',
  'pipelineStage',
  'createdAt',
] as const;

export interface CandidateFilterParams {
  tenantId?: string;
  search?: string;
  exactOnly?: boolean;
  stage?: string;
  workAuth?: string;
  vendorId?: string;
  minRate?: number;
  maxRate?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: SortDirection;
}

export type MatchAvailabilityScope = 'bench' | 'non_billable' | 'all';
export type SkillMatchFilterMode = 'strict' | 'overlap' | 'all';
export type CandidateMatchSortBy = 'match' | 'bench' | 'rate_asc' | 'recent';

export interface CandidateMatchSearchParams {
  tenantId: string;
  requirementId?: string;
  skillsRequired?: string;
  search?: string;
  exactOnly?: boolean;
  workAuth?: string;
  availabilityScope?: MatchAvailabilityScope;
  relocation?: string;
  maxRate?: number;
  rateMasked?: boolean;
  matchMode?: SkillMatchFilterMode;
  sortBy?: CandidateMatchSortBy;
  excludeAttached?: boolean;
  excludeCandidateIds?: string[];
  page?: number;
  limit?: number;
}

export function parseCandidateSearchTokens(search?: string): string[] {
  const raw = String(search || '').trim();
  if (!raw) return [];

  const tokens: string[] = [];
  const regex = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const token = (match[1] ?? match[2] ?? '').replace(/^,+|,+$/g, '').trim();
    if (!token) continue;
    const upper = token.toUpperCase();
    if (upper === 'AND' || token === '&' || token === '+') continue;
    tokens.push(token);
    if (tokens.length >= 8) break;
  }
  return tokens;
}

export function buildCandidateWhereClause(
  params: CandidateFilterParams,
  parsedQuery?: ReturnType<typeof parseBooleanSearchQuery>
): Prisma.CandidateWhereInput {
  const { search, exactOnly, stage, workAuth, vendorId, minRate, maxRate, tenantId } = params;
  const where: Prisma.CandidateWhereInput = {};

  if (tenantId) {
    where.tenantId = tenantId;
  }

  const andClauses: Prisma.CandidateWhereInput[] = [];
  const parsed = parsedQuery ?? parseBooleanSearchQuery(search, { exactOnly });
  const compiledSearch = compileBooleanAstToPrismaWhere(parsed.ast);
  if (compiledSearch) {
    if (Array.isArray((compiledSearch as any).AND)) {
      andClauses.push(...((compiledSearch as any).AND as Prisma.CandidateWhereInput[]));
    } else {
      andClauses.push(compiledSearch);
    }
  }

  const hasMinRate = typeof minRate === 'number' && Number.isFinite(minRate) && minRate >= 0;
  const hasMaxRate = typeof maxRate === 'number' && Number.isFinite(maxRate) && maxRate >= 0;
  if (hasMinRate || hasMaxRate) {
    const rateCond: Prisma.DecimalNullableFilter = {
      ...(hasMinRate ? { gte: minRate } : {}),
      ...(hasMaxRate ? { lte: maxRate } : {}),
    };
    andClauses.push({
      OR: [{ hourlyRateW2: rateCond }, { hourlyRateC2c: rateCond }],
    });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  if (stage && stage !== 'ALL' && stage !== 'All') {
    const mappedStage = stageMap[stage] || (stage as CandidatePipelineStage);
    where.pipelineStage = mappedStage;
  }
  if (workAuth && workAuth !== 'ALL' && workAuth !== 'All') {
    where.workAuth = { contains: String(workAuth).trim(), mode: 'insensitive' };
  }
  if (vendorId && vendorId !== 'ALL' && vendorId !== 'All') {
    where.vendorId = vendorId;
  }

  return where;
}

export const stageMap: Record<string, CandidatePipelineStage> = {
  'Available / Bench': CandidatePipelineStage.AVAILABLE_BENCH,
  'AVAILABLE_BENCH': CandidatePipelineStage.AVAILABLE_BENCH,
  'Submitted': CandidatePipelineStage.SUBMITTED,
  'SUBMITTED': CandidatePipelineStage.SUBMITTED,
  'Interview': CandidatePipelineStage.INTERVIEW,
  'INTERVIEW': CandidatePipelineStage.INTERVIEW,
  'Selected': CandidatePipelineStage.SELECTED,
  'SELECTED': CandidatePipelineStage.SELECTED,
  'Onboarding': CandidatePipelineStage.ONBOARDING,
  'ONBOARDING': CandidatePipelineStage.ONBOARDING,
  'Billable': CandidatePipelineStage.BILLABLE,
  'BILLABLE': CandidatePipelineStage.BILLABLE,
  'Archived': CandidatePipelineStage.ARCHIVED,
  'ARCHIVED': CandidatePipelineStage.ARCHIVED
};

const CANDIDATE_DEFAULT_INCLUDE = {
  assignedRecruiter: {
    select: { id: true, fullName: true, role: true, desk: true },
  },
  vendor: {
    select: { id: true, name: true, msaSigned: true, coiExpiryDate: true },
  },
} satisfies Prisma.CandidateInclude;

export class CandidateService {
  private buildWhereClause(
    params: CandidateFilterParams,
    parsedQuery?: ReturnType<typeof parseBooleanSearchQuery>
  ): Prisma.CandidateWhereInput {
    return buildCandidateWhereClause(params, parsedQuery);
  }

  private async resolveTenantVendorId(
    tenantId: string,
    raw: any
  ): Promise<string | null | undefined> {
    if (raw.vendorId === undefined && raw.vendorName === undefined) {
      return undefined;
    }
    const rawId = typeof raw.vendorId === 'string' ? raw.vendorId.trim() : raw.vendorId;
    if (rawId) {
      const existingVendor = await prisma.vendor.findFirst({
        where: { id: String(rawId), tenantId },
        select: { id: true },
      });
      return existingVendor?.id ?? null;
    }
    const rawName = typeof raw.vendorName === 'string' ? raw.vendorName.trim() : '';
    if (rawName) {
      const matchedVendor = await prisma.vendor.findFirst({
        where: { tenantId, name: { equals: rawName, mode: 'insensitive' } },
        select: { id: true },
      });
      return matchedVendor?.id ?? null;
    }
    return null;
  }

  private getCandidateOrderBy(
    sortBy?: string,
    sortDir: SortDirection = 'desc'
  ): Prisma.CandidateOrderByWithRelationInput[] {
    const defaultOrder: Prisma.CandidateOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { id: 'desc' },
    ];
    return buildPrismaOrderBy<Prisma.CandidateOrderByWithRelationInput>(
      sortBy,
      sortDir,
      {
        fullName: (d) => [{ fullName: d }, { id: d }],
        workAuth: (d) => [{ workAuth: d }, { id: d }],
        currentTitle: (d) => [{ currentTitle: d }, { id: d }],
        relocation: (d) => [{ relocation: d }, { id: d }],
        stage: (d) => [{ pipelineStage: d }, { id: d }],
        pipelineStage: (d) => [{ pipelineStage: d }, { id: d }],
        createdAt: (d) => [{ createdAt: d }, { id: d }],
      },
      defaultOrder
    ) as Prisma.CandidateOrderByWithRelationInput[];
  }

  async getCandidates(params: CandidateFilterParams) {
    const where = this.buildWhereClause(params);
    return prisma.candidate.findMany({
      where,
      include: CANDIDATE_DEFAULT_INCLUDE,
      orderBy: this.getCandidateOrderBy(params.sortBy, params.sortDir),
    });
  }

  async getCandidatesPaginated(params: CandidateFilterParams) {
    const parsedSearch = parseBooleanSearchQuery(params.search, { exactOnly: params.exactOnly });
    const where = this.buildWhereClause(params, parsedSearch);
    const hasPagination = params.page !== undefined || params.limit !== undefined;
    const page = params.page ? Math.max(1, params.page) : 1;
    const limit = params.limit ? Math.max(1, Math.min(100, params.limit)) : 10;
    const include = CANDIDATE_DEFAULT_INCLUDE;

    if (params.sortBy === 'hourlyRate') {
      const rateDir = params.sortDir || 'desc';
      const rateCandidates = await prisma.candidate.findMany({
        where,
        select: {
          id: true,
          hourlyRateW2: true,
          hourlyRateC2c: true,
          hourlyRateDisplay: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });

      const extractNumericRate = (c: typeof rateCandidates[number]): number | null => {
        if (c.hourlyRateW2 !== null) return Number(c.hourlyRateW2);
        if (c.hourlyRateC2c !== null) return Number(c.hourlyRateC2c);
        if (c.hourlyRateDisplay && /\d/.test(c.hourlyRateDisplay)) {
          return parseRateNumber(c.hourlyRateDisplay, 0);
        }
        return null;
      };

      const sortedRows = sortRecordsByColumn(rateCandidates, 'hourlyRate', rateDir, {
        hourlyRate: extractNumericRate,
      });

      const total = sortedRows.length;
      const sliced = hasPagination
        ? sortedRows.slice((page - 1) * limit, page * limit)
        : sortedRows;
      const pageIds = sliced.map((r) => r.id);

      const fullRows =
        pageIds.length > 0
          ? await prisma.candidate.findMany({
              where: { id: { in: pageIds } },
              include,
            })
          : [];
      const rowById = new Map(fullRows.map((r) => [r.id, r]));
      const orderedData = pageIds.map((id) => rowById.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));

      return {
        data: orderedData,
        pagination: {
          page: hasPagination ? page : 1,
          limit: hasPagination ? limit : orderedData.length || 10,
          total,
          totalPages: hasPagination ? Math.max(1, Math.ceil(total / limit)) : 1,
        },
        meta: {
          corrections: parsedSearch.corrections,
        },
      };
    }

    const orderBy = this.getCandidateOrderBy(params.sortBy, params.sortDir);

    if (!hasPagination) {
      const data = await prisma.candidate.findMany({
        where,
        include,
        orderBy,
      });
      return {
        data,
        pagination: {
          page: 1,
          limit: data.length || 10,
          total: data.length,
          totalPages: 1
        },
        meta: {
          corrections: parsedSearch.corrections,
        },
      };
    }

    const [total, data] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      },
      meta: {
        corrections: parsedSearch.corrections,
      },
    };
  }

  /**
   * Filter-first deterministic search across ALL candidates (5,000+ scale) with canonical skill tags,
   * Boolean query support, typo auto-correction, hard constraints (availability, work auth, max rate),
   * and exact skill-coverage sorting BEFORE AI shortlist ranking.
   */
  async searchMatchedCandidates(params: CandidateMatchSearchParams) {
    const {
      tenantId,
      requirementId,
      skillsRequired: skillsRequiredOverride,
      search,
      exactOnly = false,
      workAuth,
      availabilityScope = 'non_billable',
      relocation,
      maxRate,
      rateMasked = false,
      matchMode: requestedMatchMode,
      sortBy: requestedSortBy = 'match',
      excludeAttached = true,
      excludeCandidateIds = [],
      page: rawPage = 1,
      limit: rawLimit = 50,
    } = params;

    const page = Math.max(1, Number(rawPage) || 1);
    const limit = Math.max(1, Math.min(100, Number(rawLimit) || 50));

    // Fast inline backfill for a small synchronous slice; drain any remaining legacy rows in the background without a hard cap
    try {
      const updated = await candidateIndexingService.backfillNormalizedSkills(tenantId, 250);
      if (updated === 250) {
        void candidateIndexingService.drainNormalizedSkillsBackfill(tenantId).catch(() => {});
      }
    } catch {
      // Non-blocking if running without live DB in unit tests
    }

    let effectiveSkillsCsv = skillsRequiredOverride ?? '';
    let attachedIds: string[] = [];

    if (requirementId) {
      const [reqRecord, subRows] = await Promise.all([
        skillsRequiredOverride === undefined
          ? prisma.requirement.findFirst({
              where: { id: requirementId, tenantId },
              select: { skillsRequired: true },
            })
          : Promise.resolve(null),
        excludeAttached
          ? prisma.submission.findMany({
              where: { requirementId, tenantId },
              select: { candidateId: true },
            })
          : Promise.resolve([]),
      ]);
      if (reqRecord && skillsRequiredOverride === undefined) {
        effectiveSkillsCsv = reqRecord.skillsRequired || '';
      }
      attachedIds = subRows.map((s) => s.candidateId);
    }

    const cleanExcludeIds = Array.from(
      new Set(
        [...attachedIds, ...(excludeCandidateIds || [])]
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    ).slice(0, 12000);

    const parsedSearch = parseBooleanSearchQuery(search, { exactOnly });
    const corrections: SkillTypoCorrection[] = [...parsedSearch.corrections];
    const seenCorrectionKeys = new Set(
      corrections.map((c) => `${c.from.toLowerCase()}->${c.canonical}`)
    );

    const reqSkillsMeta: Array<{ raw: string; canonical: string; display: string }> = [];
    const seenReqSlugs = new Set<string>();
    for (const rawSkill of splitSkillItems(effectiveSkillsCsv).slice(0, 20)) {
      const norm = normalizeSkillWithTypoFallback(rawSkill, {
        allowTypoCorrection: !exactOnly,
      });
      const slug = norm.canonical || canonicalizeSkillExact(rawSkill);
      if (!slug || seenReqSlugs.has(slug)) continue;
      seenReqSlugs.add(slug);
      reqSkillsMeta.push({
        raw: rawSkill,
        canonical: slug,
        display: norm.display || rawSkill,
      });
      if (norm.matchedViaTypo) {
        const key = `${rawSkill.toLowerCase()}->${norm.canonical}`;
        if (!seenCorrectionKeys.has(key)) {
          seenCorrectionKeys.add(key);
          corrections.push({
            from: rawSkill,
            canonical: norm.canonical,
            display: norm.display,
            distance: damerauLevenshtein(rawSkill, norm.display),
          });
        }
      }
    }

    const effectiveMatchMode: SkillMatchFilterMode =
      reqSkillsMeta.length === 0
        ? 'all'
        : requestedMatchMode === 'strict' || requestedMatchMode === 'overlap' || requestedMatchMode === 'all'
          ? requestedMatchMode
          : 'overlap';

    const poolConditions: Prisma.Sql[] = [
      Prisma.sql`c."tenantId" = ${tenantId}`,
      Prisma.sql`c."pipelineStage" <> 'ARCHIVED'::"CandidatePipelineStage"`,
    ];
    if (cleanExcludeIds.length > 0) {
      poolConditions.push(Prisma.sql`NOT (c."id" = ANY(${cleanExcludeIds}::text[]))`);
    }

    const filterConditions: Prisma.Sql[] = [...poolConditions];

    if (availabilityScope === 'bench') {
      filterConditions.push(
        Prisma.sql`c."pipelineStage" = 'AVAILABLE_BENCH'::"CandidatePipelineStage"`
      );
    } else if (availabilityScope === 'non_billable') {
      filterConditions.push(
        Prisma.sql`c."pipelineStage" <> 'BILLABLE'::"CandidatePipelineStage"`
      );
    }

    const cleanWorkAuth = String(workAuth || '').trim();
    if (cleanWorkAuth && cleanWorkAuth !== 'All' && cleanWorkAuth !== 'ALL') {
      filterConditions.push(Prisma.sql`c."workAuth" ILIKE ${`%${cleanWorkAuth}%`}`);
    }

    const cleanRelocation = String(relocation || '').trim();
    if (cleanRelocation && cleanRelocation !== 'All' && cleanRelocation !== 'ALL') {
      filterConditions.push(Prisma.sql`c."relocation" ILIKE ${`${cleanRelocation}%`}`);
    }

    if (!rateMasked && typeof maxRate === 'number' && Number.isFinite(maxRate) && maxRate > 0) {
      filterConditions.push(
        Prisma.sql`(COALESCE(c."hourlyRateW2", c."hourlyRateC2c") IS NOT NULL AND COALESCE(c."hourlyRateW2", c."hourlyRateC2c") <= ${maxRate})`
      );
    }

    const booleanSearchSql = compileBooleanAstToSql(parsedSearch.ast);
    if (booleanSearchSql) {
      filterConditions.push(booleanSearchSql);
    }

    const buildSkillSqlCondition = (skill: { raw: string; canonical: string; display: string }): Prisma.Sql => {
      const hasKnownCanonical = isKnownCanonicalSkill(skill.canonical);
      const ginContainsSql = Prisma.sql`c."normalizedSkills" @> ARRAY[${skill.canonical}]::text[]`;

      if (hasKnownCanonical) {
        // Known skills are pre-extracted into GIN-indexed `normalizedSkills` (sub-5ms at 20k rows).
        // Only fall back to FTS/trigram for rows that have not been backfilled yet.
        return Prisma.sql`(
          ${ginContainsSql}
          OR (
            cardinality(c."normalizedSkills") = 0
            AND (
              c."skillset" ILIKE ${`%${skill.display}%`}
              OR c."currentTitle" ILIKE ${`%${skill.display}%`}
              OR to_tsvector('english', COALESCE(c."fullName", '') || ' ' || COALESCE(c."currentTitle", '') || ' ' || COALESCE(c."skillset", '') || ' ' || COALESCE(c."rawSnippet", ''))
                 @@ plainto_tsquery('english', ${skill.display})
            )
          )
        )`;
      }

      // Custom/unlisted skills use GIN-indexed full-text + trigram skillset lookup (zero full-table regex scans)
      const ftsQuery = skill.raw.trim();
      return Prisma.sql`(
        ${ginContainsSql}
        OR c."skillset" ILIKE ${`%${ftsQuery}%`}
        OR c."currentTitle" ILIKE ${`%${ftsQuery}%`}
        OR to_tsvector('english', COALESCE(c."fullName", '') || ' ' || COALESCE(c."currentTitle", '') || ' ' || COALESCE(c."skillset", '') || ' ' || COALESCE(c."rawSnippet", ''))
           @@ plainto_tsquery('english', ${ftsQuery})
      )`;
    };

    const skillSqlExprs = reqSkillsMeta.map(buildSkillSqlCondition);
    const reqCanonicalSlugs = reqSkillsMeta.map((s) => s.canonical);
    const allKnownCanonical = reqSkillsMeta.every((s) => isKnownCanonicalSkill(s.canonical));

    const matchedCountExpr =
      skillSqlExprs.length > 0
        ? Prisma.sql`(${Prisma.join(
            skillSqlExprs.map((expr) => Prisma.sql`CASE WHEN ${expr} THEN 1 ELSE 0 END`),
            ' + '
          )})`
        : Prisma.sql`0`;

    const strictAllSql =
      skillSqlExprs.length > 0
        ? allKnownCanonical
          ? Prisma.sql`(c."normalizedSkills" @> ${reqCanonicalSlugs}::text[] OR (cardinality(c."normalizedSkills") = 0 AND (${Prisma.join(skillSqlExprs, ' AND ')})))`
          : Prisma.sql`(${Prisma.join(skillSqlExprs, ' AND ')})`
        : Prisma.sql`TRUE`;

    const overlapAnySql =
      skillSqlExprs.length > 0
        ? allKnownCanonical
          ? Prisma.sql`(c."normalizedSkills" && ${reqCanonicalSlugs}::text[] OR (cardinality(c."normalizedSkills") = 0 AND (${Prisma.join(skillSqlExprs, ' OR ')})))`
          : Prisma.sql`(${Prisma.join(skillSqlExprs, ' OR ')})`
        : Prisma.sql`TRUE`;

    const activeConditions = [...filterConditions];
    if (effectiveMatchMode === 'strict' && skillSqlExprs.length > 0) {
      activeConditions.push(strictAllSql);
    } else if (effectiveMatchMode === 'overlap' && skillSqlExprs.length > 0) {
      activeConditions.push(overlapAnySql);
    }

    const wherePoolSql = Prisma.join(poolConditions, ' AND ');
    const whereBaseFilteredSql = Prisma.join(filterConditions, ' AND ');
    const whereActiveSql = Prisma.join(activeConditions, ' AND ');

    const effectiveSortBy: CandidateMatchSortBy =
      requestedSortBy === 'bench' ||
      requestedSortBy === 'recent' ||
      (requestedSortBy === 'rate_asc' && !rateMasked)
        ? requestedSortBy
        : 'match';

    const orderBySql =
      effectiveSortBy === 'bench'
        ? Prisma.sql`
            (c."pipelineStage" = 'AVAILABLE_BENCH'::"CandidatePipelineStage") DESC,
            "matchedCount" DESC,
            c."updatedAt" DESC,
            c."id" DESC
          `
        : effectiveSortBy === 'rate_asc'
          ? Prisma.sql`
              COALESCE(c."hourlyRateW2", c."hourlyRateC2c") ASC NULLS LAST,
              "matchedCount" DESC,
              (c."pipelineStage" = 'AVAILABLE_BENCH'::"CandidatePipelineStage") DESC,
              c."id" DESC
            `
          : effectiveSortBy === 'recent'
            ? Prisma.sql`
                c."updatedAt" DESC,
                "matchedCount" DESC,
                c."id" DESC
              `
            : Prisma.sql`
                "matchedCount" DESC,
                (c."pipelineStage" = 'AVAILABLE_BENCH'::"CandidatePipelineStage") DESC,
                c."updatedAt" DESC,
                c."id" DESC
              `;

    const [poolCountRows, filteredStatsRows, pageIdRows] = await Promise.all([
      prisma.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*)::bigint AS total
        FROM "Candidate" c
        WHERE ${wherePoolSql}
      `,
      prisma.$queryRaw<Array<{ totalMatched: bigint | number; exactAllCount: bigint | number }>>`
        SELECT
          COUNT(*)::bigint AS "totalMatched",
          COUNT(*) FILTER (WHERE ${strictAllSql})::bigint AS "exactAllCount"
        FROM "Candidate" c
        WHERE ${effectiveMatchMode === 'all' ? whereBaseFilteredSql : whereActiveSql}
      `,
      prisma.$queryRaw<Array<{ id: string; matchedCount: number }>>`
        SELECT
          c."id",
          ${matchedCountExpr}::int AS "matchedCount"
        FROM "Candidate" c
        WHERE ${whereActiveSql}
        ORDER BY ${orderBySql}
        LIMIT ${limit}
        OFFSET ${(page - 1) * limit}
      `,
    ]);

    const totalPool = Number(poolCountRows[0]?.total ?? 0);
    const totalMatched = Number(filteredStatsRows[0]?.totalMatched ?? 0);
    const exactAllCount =
      reqSkillsMeta.length > 0 ? Number(filteredStatsRows[0]?.exactAllCount ?? 0) : totalMatched;

    const pageIds = pageIdRows.map((r) => r.id);
    const fullRows =
      pageIds.length > 0
        ? await prisma.candidate.findMany({
            where: { id: { in: pageIds } },
            include: CANDIDATE_DEFAULT_INCLUDE,
          })
        : [];
    const rowById = new Map(fullRows.map((r) => [r.id, r]));
    const orderedData = pageIds
      .map((id) => {
        const row = rowById.get(id);
        if (!row) return null;
        const overlap = evaluateNormalizedSkillOverlap({
          requiredSkillsCsv: effectiveSkillsCsv,
          candidateSkillset: row.skillset,
          candidateNormalizedSkills: (row as any).normalizedSkills,
          candidateTitle: row.currentTitle,
          candidateRawSnippet: row.rawSnippet,
        });
        return {
          ...row,
          matchSummary: {
            score: overlap.score,
            matched: overlap.matched,
            missing: overlap.missing,
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    return {
      data: orderedData,
      pagination: {
        page,
        limit,
        total: totalMatched,
        totalPages: Math.max(1, Math.ceil(totalMatched / limit)),
      },
      meta: {
        totalPool,
        totalMatched,
        exactAllCount,
        corrections,
        matchMode: effectiveMatchMode,
        availabilityScope,
      },
    };
  }

  async getCandidateById(id: string, tenantId?: string) {
    const where: Prisma.CandidateWhereUniqueInput = { id };
    const cand = await prisma.candidate.findUnique({
      where,
      include: {
        assignedRecruiter: true,
        vendor: {
          select: { id: true, name: true, msaSigned: true, coiExpiryDate: true },
        },
        submissions: { include: { requirement: true } },
        placements: true
      }
    });

    if (cand && tenantId && cand.tenantId !== tenantId) {
      return null;
    }
    return cand;
  }

  async createCandidate(
    raw: any,
    tenantId: string = 'squadpipe-agency',
    recruiterId?: string,
    cvFile?: UploadedCvFile
  ) {
    const rateDisplay = raw.hourlyRateDisplay || raw.hourlyRate || '$90/hr (W2)';
    const rateDigits = Math.round(parseRateNumber(rateDisplay, 90)) || 90;
    const isC2C = String(rateDisplay).toUpperCase().includes('C2C');

    const mappedStage = stageMap[raw.pipelineStage] || CandidatePipelineStage.AVAILABLE_BENCH;

    let storedCv: StoredCvMetadata | null = null;
    if (cvFile) {
      storedCv = await cvStorageService.uploadCv(cvFile, tenantId);
    }

    const resumeFileName =
      storedCv?.originalFileName ||
      raw.resumeFileName ||
      raw.resumeName ||
      `${(raw.fullName || 'Candidate').replace(/\s+/g, '_')}_Resume.pdf`;
    const resumeFormat = storedCv?.resumeFormat || raw.resumeFormat || 'PDF';
    const resumeFileUrl = storedCv?.storageUri || raw.resumeFileUrl || null;
    const customFields = parseCustomFields(raw.customFields);

    let resolvedRecruiterId: string | null = raw.assignedRecruiterId || recruiterId || null;
    if (resolvedRecruiterId) {
      const existingUser = await prisma.user.findFirst({
        where: { id: resolvedRecruiterId, tenantId },
        select: { id: true },
      });
      if (!existingUser) resolvedRecruiterId = null;
    }
    const recruiterName = raw.assignedRecruiter || raw.recruiter;
    if (!resolvedRecruiterId && recruiterName && typeof recruiterName === 'string' && recruiterName.trim()) {
      const matchedUser = await prisma.user.findFirst({
        where: { tenantId, fullName: { equals: recruiterName.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (matchedUser) resolvedRecruiterId = matchedUser.id;
    }

    const resolvedVendorId = await this.resolveTenantVendorId(tenantId, raw);

    const createTitle = raw.currentTitle?.trim() || 'Software Engineer';
    const createSkills = raw.skillset?.trim() || 'General Engineering';
    const createSnippet = raw.rawSnippet || null;

    const now = new Date();
    const { general: tenantGeneral } = await getTenantSettings(tenantId).catch(() => ({
      general: { candidateRetentionDays: 365 } as any,
    }));
    const consentGranted = resolveConsentConfirmation(raw.privacyConsent ?? raw.consentGranted);
    const rawBasis = String(raw.lawfulBasis || '').trim().toUpperCase();
    const resolvedLawfulBasis =
      rawBasis && Object.values(CandidateLawfulBasis).includes(rawBasis as CandidateLawfulBasis)
        ? (rawBasis as CandidateLawfulBasis)
        : consentGranted
          ? CandidateLawfulBasis.CONSENT
          : CandidateLawfulBasis.LEGITIMATE_INTEREST;
    const rawConsentStatus = String(raw.consentStatus || '').trim().toUpperCase();
    const resolvedConsentStatus =
      rawConsentStatus && Object.values(ConsentStatus).includes(rawConsentStatus as ConsentStatus)
        ? (rawConsentStatus as ConsentStatus)
        : consentGranted
          ? ConsentStatus.GRANTED
          : ConsentStatus.PENDING;
    const retentionExpiresAt = computeRetentionExpiresAt(
      now,
      tenantGeneral?.candidateRetentionDays
    );

    try {
      const created = await prisma.candidate.create({
        data: {
          tenantId,
          fullName: raw.fullName?.trim() || 'Anonymous Candidate',
          email: raw.email?.trim()?.toLowerCase() || `cand_${Date.now()}@domain.com`,
          phone: raw.phone?.trim() || null,
          currentTitle: createTitle,
          workAuth: raw.workAuth?.trim() || 'US Citizen',
          education: raw.education?.trim() || "Master's Degree",
          skillset: createSkills,
          normalizedSkills: extractNormalizedSkills({
            skillset: createSkills,
            currentTitle: createTitle,
            rawSnippet: createSnippet,
          }),
          hourlyRateDisplay: rateDisplay,
          hourlyRateW2: isC2C ? null : rateDigits,
          hourlyRateC2c: isC2C ? rateDigits : null,
          relocation: raw.relocation || 'Yes',
          resumeFileName,
          resumeFormat,
          resumeFileUrl,
          rawSnippet: createSnippet,
          pipelineStage: mappedStage,
          lawfulBasis: resolvedLawfulBasis,
          consentStatus: resolvedConsentStatus,
          consentCapturedAt: resolvedConsentStatus === ConsentStatus.GRANTED ? now : null,
          privacyNoticeVersion:
            String(raw.privacyNoticeVersion || '').trim() ||
            (resolvedConsentStatus === ConsentStatus.GRANTED ? CURRENT_PRIVACY_NOTICE_VERSION : null),
          intakeSource: String(raw.intakeSource || 'MANUAL').trim().toUpperCase() || 'MANUAL',
          retentionExpiresAt,
          ...(customFields !== undefined ? { customFields } : {}),
          assignedRecruiterId: resolvedRecruiterId,
          ...(resolvedVendorId ? { vendorId: resolvedVendorId } : {}),
        },
        include: CANDIDATE_DEFAULT_INCLUDE,
      });
      candidateIndexingService.scheduleCandidateSync(created.id, tenantId);
      return created;
    } catch (error: any) {
      if (storedCv?.storageUri) {
        await cvStorageService.deleteCv(storedCv.storageUri);
      }
      if (error?.code === 'P2002') {
        const dupErr: any = new Error('A consultant with this email already exists in this workspace.');
        dupErr.statusCode = 409;
        throw dupErr;
      }
      throw error;
    }
  }

  async updateCandidate(
    id: string,
    raw: any,
    tenantId?: string,
    cvFile?: UploadedCvFile
  ) {
    const existing = await prisma.candidate.findUnique({ where: { id } });
    if (!existing || (tenantId && existing.tenantId !== tenantId)) {
      const notFoundErr: any = new Error('Candidate not found or unauthorized');
      notFoundErr.statusCode = 404;
      throw notFoundErr;
    }

    const data: Prisma.CandidateUpdateInput = {};
    if (raw.fullName !== undefined) data.fullName = String(raw.fullName).trim();
    if (raw.email !== undefined) data.email = String(raw.email).trim().toLowerCase();
    if (raw.phone !== undefined) data.phone = raw.phone;
    if (raw.currentTitle !== undefined) data.currentTitle = String(raw.currentTitle).trim();
    if (raw.workAuth !== undefined) data.workAuth = String(raw.workAuth).trim();
    if (raw.education !== undefined) data.education = raw.education;
    if (raw.skillset !== undefined) data.skillset = String(raw.skillset).trim();
    if (raw.relocation !== undefined) data.relocation = String(raw.relocation).trim();
    if (raw.rawSnippet !== undefined) data.rawSnippet = raw.rawSnippet || null;
    if (raw.resumeFileName !== undefined || raw.resumeName !== undefined) {
      data.resumeFileName = raw.resumeFileName ?? raw.resumeName ?? null;
    }
    if (raw.resumeFormat !== undefined) {
      data.resumeFormat = raw.resumeFormat || 'PDF';
    }
    if (raw.resumeFileUrl !== undefined) {
      data.resumeFileUrl = raw.resumeFileUrl || null;
    }
    const parsedCustomFields = parseCustomFields(raw.customFields);
    if (parsedCustomFields !== undefined) {
      data.customFields = parsedCustomFields;
    }
    if (raw.pipelineStage !== undefined) {
      data.pipelineStage = stageMap[raw.pipelineStage] || raw.pipelineStage;
    }
    if (raw.hourlyRate !== undefined || raw.hourlyRateDisplay !== undefined) {
      const rateDisplay = String(raw.hourlyRateDisplay || raw.hourlyRate || '');
      data.hourlyRateDisplay = rateDisplay;
      const rateDigits = Math.round(parseRateNumber(rateDisplay, 90)) || 90;
      const isC2C = rateDisplay.toUpperCase().includes('C2C');
      data.hourlyRateW2 = isC2C ? null : rateDigits;
      data.hourlyRateC2c = isC2C ? rateDigits : null;
    }

    if (raw.skillset !== undefined || raw.currentTitle !== undefined || raw.rawSnippet !== undefined) {
      data.normalizedSkills = extractNormalizedSkills({
        skillset: raw.skillset !== undefined ? String(raw.skillset).trim() : existing.skillset,
        currentTitle: raw.currentTitle !== undefined ? String(raw.currentTitle).trim() : existing.currentTitle,
        rawSnippet: raw.rawSnippet !== undefined ? (raw.rawSnippet || null) : existing.rawSnippet,
      });
    }

    const resolvedVendorId = await this.resolveTenantVendorId(existing.tenantId, raw);
    if (resolvedVendorId !== undefined) {
      data.vendor = resolvedVendorId
        ? { connect: { id: resolvedVendorId } }
        : { disconnect: true };
    }

    let storedCv: StoredCvMetadata | null = null;
    if (cvFile) {
      storedCv = await cvStorageService.uploadCv(cvFile, existing.tenantId);
      data.resumeFileUrl = storedCv.storageUri;
      data.resumeFileName = storedCv.originalFileName;
      data.resumeFormat = storedCv.resumeFormat;
    }

    try {
      const updated = await prisma.candidate.update({
        where: { id },
        data,
        include: CANDIDATE_DEFAULT_INCLUDE,
      });

      if (storedCv && existing.resumeFileUrl && existing.resumeFileUrl !== storedCv.storageUri) {
        await cvStorageService.deleteCv(existing.resumeFileUrl);
      }

      candidateIndexingService.scheduleCandidateSync(updated.id, updated.tenantId);
      return updated;
    } catch (error: any) {
      if (storedCv?.storageUri) {
        await cvStorageService.deleteCv(storedCv.storageUri);
      }
      if (error?.code === 'P2002') {
        const dupErr: any = new Error('A consultant with this email already exists in this workspace.');
        dupErr.statusCode = 409;
        throw dupErr;
      }
      throw error;
    }
  }

  /**
   * Attaches or replaces the original stored CV for an existing candidate.
   */
  async uploadCandidateCv(id: string, cvFile: UploadedCvFile, tenantId?: string) {
    return this.updateCandidate(id, {}, tenantId, cvFile);
  }

  /**
   * Downloads a candidate's original stored CV file, enforcing tenant isolation.
   */
  async downloadCandidateCv(id: string, tenantId?: string) {
    const candidate = await this.getCandidateById(id, tenantId);
    if (!candidate) {
      const notFoundErr: any = new Error('Candidate not found or unauthorized');
      notFoundErr.statusCode = 404;
      throw notFoundErr;
    }
    if (!candidate.resumeFileUrl || !parseCvStorageUri(candidate.resumeFileUrl)) {
      const missingCvErr: any = new Error('No original CV file is stored for this consultant');
      missingCvErr.statusCode = 404;
      throw missingCvErr;
    }
    return cvStorageService.downloadCv(
      candidate.resumeFileUrl,
      candidate.resumeFileName || undefined
    );
  }

  async deleteCandidate(
    id: string,
    tenantId?: string,
    actor?: {
      userId?: string;
      email?: string;
      role?: string;
      ipAddress?: string;
      userAgent?: string;
      reason?: string;
      allowActivePlacements?: boolean;
    }
  ) {
    return complianceService.executeVerifiedCandidateErasure({
      candidateId: id,
      tenantId,
      requestedById: actor?.userId,
      requestedByEmail: actor?.email,
      requestedByRole: actor?.role,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
      reason: actor?.reason || 'CANDIDATE_DELETED',
      allowActivePlacements: actor?.allowActivePlacements,
    });
  }
}

export const candidateService = new CandidateService();

