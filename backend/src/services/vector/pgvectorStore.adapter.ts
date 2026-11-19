import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.config';
import { toPgVectorLiteral } from './embedding.service';
import type {
  HybridCandidateMatch,
  HybridSearchQuery,
  TenantVectorIndexStats,
  VectorStoreAdapter,
} from './vectorStore.interface';

export interface FtsChunkHit {
  candidateId: string;
  chunkIndex: number;
  chunkText: string;
  score: number;
}

export interface VectorChunkHit {
  candidateId: string;
  chunkIndex: number;
  chunkText: string;
  similarity: number;
}

/**
 * Extracts pure alphanumeric tokens joined with OR (`|`) so `to_tsquery('english', ...)`
 * never throws on punctuation like `C#`, `.NET`, `CI/CD`, or `S/4HANA`.
 */
export function buildSafeTsQuery(skillTokens: string[], fallbackText: string): string {
  const words = new Set<string>();
  const source = skillTokens.length > 0 ? skillTokens.join(' ') : fallbackText;

  for (const part of String(source || '').split(/[^a-zA-Z0-9]+/)) {
    const clean = part.trim().toLowerCase();
    if (clean.length >= 2 && clean.length <= 40) {
      words.add(clean);
      if (words.size >= 24) break;
    }
  }

  return Array.from(words).join(' | ');
}

/**
 * Combines PostgreSQL Full-Text Search chunk hits and pgvector cosine hits using
 * Reciprocal Rank Fusion (RRF), preserving each candidate's top relevant CV excerpts.
 */
export function mergeHybridCandidateRanks(params: {
  ftsHits: FtsChunkHit[];
  vectorHits: VectorChunkHit[];
  limit: number;
}): HybridCandidateMatch[] {
  const { ftsHits, vectorHits, limit } = params;
  const RRF_K = 50;

  interface Acc {
    bestFtsRank?: number;
    bestVecRank?: number;
    bestTextScore: number;
    bestVecScore: number;
    chunks: Array<{ text: string; score: number }>;
  }

  const byCandidate = new Map<string, Acc>();
  const getAcc = (candId: string): Acc => {
    let acc = byCandidate.get(candId);
    if (!acc) {
      acc = { bestTextScore: 0, bestVecScore: 0, chunks: [] };
      byCandidate.set(candId, acc);
    }
    return acc;
  };

  // Deduplicate candidate ranks (first hit per candidate = highest score/rank in each list)
  let ftsCandRank = 0;
  const seenFtsCand = new Set<string>();
  for (const hit of ftsHits) {
    const acc = getAcc(hit.candidateId);
    if (!seenFtsCand.has(hit.candidateId)) {
      seenFtsCand.add(hit.candidateId);
      ftsCandRank += 1;
      acc.bestFtsRank = ftsCandRank;
      acc.bestTextScore = Math.max(acc.bestTextScore, Number(hit.score) || 0);
    }
    if (hit.chunkText) {
      acc.chunks.push({ text: hit.chunkText, score: Number(hit.score) || 0.1 });
    }
  }

  let vecCandRank = 0;
  const seenVecCand = new Set<string>();
  for (const hit of vectorHits) {
    const acc = getAcc(hit.candidateId);
    if (!seenVecCand.has(hit.candidateId)) {
      seenVecCand.add(hit.candidateId);
      vecCandRank += 1;
      acc.bestVecRank = vecCandRank;
      acc.bestVecScore = Math.max(acc.bestVecScore, Number(hit.similarity) || 0);
    }
    if (hit.chunkText) {
      acc.chunks.push({ text: hit.chunkText, score: (Number(hit.similarity) || 0) + 0.5 });
    }
  }

  const results: HybridCandidateMatch[] = [];
  for (const [candidateId, acc] of byCandidate.entries()) {
    const ftsRrf = acc.bestFtsRank ? 1 / (RRF_K + acc.bestFtsRank) : 0;
    const vecRrf = acc.bestVecRank ? 1.4 / (RRF_K + acc.bestVecRank) : 0;
    const hybridScore = Number((ftsRrf + vecRrf).toFixed(6));

    const uniqueChunks: string[] = [];
    const seenTexts = new Set<string>();
    const sortedChunks = [...acc.chunks].sort((a, b) => b.score - a.score);
    for (const item of sortedChunks) {
      const normalizedKey = item.text.slice(0, 120);
      if (!seenTexts.has(normalizedKey)) {
        seenTexts.add(normalizedKey);
        uniqueChunks.push(item.text);
        if (uniqueChunks.length >= 3) break;
      }
    }

    results.push({
      candidateId,
      hybridScore,
      vectorScore: acc.bestVecScore,
      textScore: acc.bestTextScore,
      matchedChunks: uniqueChunks,
    });
  }

  results.sort((a, b) => b.hybridScore - a.hybridScore || b.vectorScore - a.vectorScore);
  return results.slice(0, Math.max(1, limit));
}

export class PgVectorStoreAdapter implements VectorStoreAdapter {
  readonly providerName = 'pgvector';

  async upsertCandidateChunks(params: {
    tenantId: string;
    candidateId: string;
    chunks: Array<{
      chunkIndex: number;
      sectionType: string;
      chunkText: string;
      contentHash: string;
    }>;
    vectors?: Array<number[] | null>;
    embeddingModel?: string | null;
  }): Promise<void> {
    const { tenantId, candidateId, chunks, vectors = [], embeddingModel = null } = params;

    await prisma.$transaction(async (tx) => {
      if (chunks.length === 0) {
        await tx.$executeRaw`
          DELETE FROM "CandidateChunk"
          WHERE "tenantId" = ${tenantId} AND "candidateId" = ${candidateId}
        `;
        return;
      }

      await tx.$executeRaw`
        DELETE FROM "CandidateChunk"
        WHERE "tenantId" = ${tenantId}
          AND "candidateId" = ${candidateId}
          AND "chunkIndex" >= ${chunks.length}
      `;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const rawVec = vectors[i] || null;
        const vecLiteral = rawVec ? toPgVectorLiteral(rawVec) : null;
        const rowId = crypto.randomUUID();

        if (vecLiteral) {
          await tx.$executeRaw`
            INSERT INTO "CandidateChunk" (
              "id", "tenantId", "candidateId", "chunkIndex", "sectionType",
              "chunkText", "contentHash", "embedding", "embeddingModel",
              "createdAt", "updatedAt"
            ) VALUES (
              ${rowId}, ${tenantId}, ${candidateId}, ${chunk.chunkIndex}, ${chunk.sectionType},
              ${chunk.chunkText}, ${chunk.contentHash}, ${vecLiteral}::halfvec, ${embeddingModel},
              NOW(), NOW()
            )
            ON CONFLICT ("candidateId", "chunkIndex") DO UPDATE SET
              "sectionType" = EXCLUDED."sectionType",
              "chunkText" = EXCLUDED."chunkText",
              "contentHash" = EXCLUDED."contentHash",
              "embedding" = EXCLUDED."embedding",
              "embeddingModel" = EXCLUDED."embeddingModel",
              "updatedAt" = NOW()
          `;
        } else {
          await tx.$executeRaw`
            INSERT INTO "CandidateChunk" (
              "id", "tenantId", "candidateId", "chunkIndex", "sectionType",
              "chunkText", "contentHash", "embedding", "embeddingModel",
              "createdAt", "updatedAt"
            ) VALUES (
              ${rowId}, ${tenantId}, ${candidateId}, ${chunk.chunkIndex}, ${chunk.sectionType},
              ${chunk.chunkText}, ${chunk.contentHash}, NULL::halfvec, NULL,
              NOW(), NOW()
            )
            ON CONFLICT ("candidateId", "chunkIndex") DO UPDATE SET
              "sectionType" = EXCLUDED."sectionType",
              "chunkText" = EXCLUDED."chunkText",
              "embedding" = CASE
                WHEN "CandidateChunk"."contentHash" = EXCLUDED."contentHash"
                THEN "CandidateChunk"."embedding"
                ELSE NULL::halfvec
              END,
              "embeddingModel" = CASE
                WHEN "CandidateChunk"."contentHash" = EXCLUDED."contentHash"
                THEN "CandidateChunk"."embeddingModel"
                ELSE NULL
              END,
              "contentHash" = EXCLUDED."contentHash",
              "updatedAt" = NOW()
          `;
        }
      }
    });
  }

  async deleteCandidateChunks(tenantId: string, candidateId: string): Promise<void> {
    await prisma.$executeRaw`
      DELETE FROM "CandidateChunk"
      WHERE "tenantId" = ${tenantId} AND "candidateId" = ${candidateId}
    `;
  }

  async hybridSearchCandidates(params: HybridSearchQuery): Promise<{
    matches: HybridCandidateMatch[];
    retrievalMethod: 'pgvector_hybrid' | 'pg_fts';
    totalTenantPool: number;
  }> {
    const {
      tenantId,
      queryText,
      queryVector,
      skillTokens,
      searchFilter,
      workAuthFilter,
      candidateIdsFilter,
      limit = 50,
    } = params;

    const cleanSearch = String(searchFilter || '').trim();
    const cleanWorkAuth = String(workAuthFilter || '').trim();
    const tsQueryStr = buildSafeTsQuery(skillTokens, queryText);

    const candidateConditions: Prisma.Sql[] = [
      Prisma.sql`c."tenantId" = ${tenantId}`,
      Prisma.sql`c."pipelineStage" <> 'ARCHIVED'::"CandidatePipelineStage"`,
    ];

    if (cleanWorkAuth && cleanWorkAuth !== 'All') {
      const authPattern = `%${cleanWorkAuth}%`;
      candidateConditions.push(Prisma.sql`c."workAuth" ILIKE ${authPattern}`);
    }

    if (cleanSearch) {
      const sPattern = `%${cleanSearch}%`;
      candidateConditions.push(Prisma.sql`(
        c."fullName" ILIKE ${sPattern} OR
        c."skillset" ILIKE ${sPattern} OR
        c."currentTitle" ILIKE ${sPattern} OR
        COALESCE(c."rawSnippet", '') ILIKE ${sPattern}
      )`);
    }

    if (Array.isArray(candidateIdsFilter) && candidateIdsFilter.length > 0) {
      candidateConditions.push(
        Prisma.sql`c."id" IN (${Prisma.join(candidateIdsFilter)})`
      );
    }

    const whereCandidateSql = Prisma.join(candidateConditions, ' AND ');

    const countRows = await prisma.$queryRaw<Array<{ total: bigint | number }>>`
      SELECT COUNT(*)::bigint AS total
      FROM "Candidate" c
      WHERE ${whereCandidateSql}
    `;
    const totalTenantPool = Number(countRows[0]?.total ?? 0);
    if (totalTenantPool === 0) {
      return { matches: [], retrievalMethod: 'pg_fts', totalTenantPool: 0 };
    }

    // Branch 1: Full-Text Search over ALL chunked multi-page resumes in the tenant
    let ftsHits: FtsChunkHit[] = [];
    if (tsQueryStr) {
      ftsHits = await prisma.$queryRaw<FtsChunkHit[]>`
        SELECT
          cc."candidateId" AS "candidateId",
          cc."chunkIndex" AS "chunkIndex",
          cc."chunkText" AS "chunkText",
          (
            ts_rank_cd(to_tsvector('english', cc."chunkText"), to_tsquery('english', ${tsQueryStr})) +
            ts_rank_cd(
              to_tsvector('english', COALESCE(c."skillset", '') || ' ' || COALESCE(c."currentTitle", '')),
              to_tsquery('english', ${tsQueryStr})
            ) * 1.35
          )::double precision AS score
        FROM "CandidateChunk" cc
        INNER JOIN "Candidate" c ON c."id" = cc."candidateId"
        WHERE ${whereCandidateSql}
          AND cc."tenantId" = ${tenantId}
          AND (
            to_tsvector('english', cc."chunkText") @@ to_tsquery('english', ${tsQueryStr})
            OR to_tsvector('english', COALESCE(c."skillset", '') || ' ' || COALESCE(c."currentTitle", '')) @@ to_tsquery('english', ${tsQueryStr})
          )
        ORDER BY score DESC
        LIMIT 240
      `;
    }

    // Branch 2: Semantic pgvector ANN similarity across ALL embedded chunks in the tenant
    let vectorHits: VectorChunkHit[] = [];
    let usedVectorSearch = false;
    if (queryVector) {
      const vecLiteral = toPgVectorLiteral(queryVector);
      vectorHits = await prisma.$transaction(async (tx) => {
        // Safely enable pgvector 0.8+ HNSW iterative scan for selective tenant filtering
        await tx.$executeRawUnsafe(`SAVEPOINT sp_iter_scan`);
        try {
          await tx.$executeRawUnsafe(`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`);
          await tx.$executeRawUnsafe(`RELEASE SAVEPOINT sp_iter_scan`);
        } catch {
          await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT sp_iter_scan`);
        }

        return tx.$queryRaw<VectorChunkHit[]>`
          SELECT
            cc."candidateId" AS "candidateId",
            cc."chunkIndex" AS "chunkIndex",
            cc."chunkText" AS "chunkText",
            GREATEST(0, 1 - (cc."embedding" <=> ${vecLiteral}::halfvec))::double precision AS similarity
          FROM "CandidateChunk" cc
          INNER JOIN "Candidate" c ON c."id" = cc."candidateId"
          WHERE ${whereCandidateSql}
            AND cc."tenantId" = ${tenantId}
            AND cc."embedding" IS NOT NULL
          ORDER BY cc."embedding" <=> ${vecLiteral}::halfvec ASC
          LIMIT 240
        `;
      });
      usedVectorSearch = vectorHits.length > 0;
    }

    let matches = mergeHybridCandidateRanks({ ftsHits, vectorHits, limit });

    // If neither FTS tokens nor vector embeddings matched, return most relevant active bench profiles up to limit
    if (matches.length === 0) {
      const fallbackRows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT c."id"
        FROM "Candidate" c
        WHERE ${whereCandidateSql}
        ORDER BY c."updatedAt" DESC
        LIMIT ${Math.max(1, limit)}
      `;
      matches = fallbackRows.map((row, idx) => ({
        candidateId: row.id,
        hybridScore: Number((1 / (100 + idx + 1)).toFixed(6)),
        vectorScore: 0,
        textScore: 0,
        matchedChunks: [],
      }));
    }

    return {
      matches,
      retrievalMethod: usedVectorSearch ? 'pgvector_hybrid' : 'pg_fts',
      totalTenantPool,
    };
  }

  async getTenantIndexStats(tenantId: string): Promise<TenantVectorIndexStats> {
    const [candCountRows, chunkStatsRows] = await Promise.all([
      prisma.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*)::bigint AS total
        FROM "Candidate"
        WHERE "tenantId" = ${tenantId}
          AND "pipelineStage" <> 'ARCHIVED'::"CandidatePipelineStage"
      `,
      prisma.$queryRaw<
        Array<{
          indexed_candidates: bigint | number;
          total_chunks: bigint | number;
          embedded_chunks: bigint | number;
        }>
      >`
        SELECT
          COUNT(DISTINCT cc."candidateId")::bigint AS indexed_candidates,
          COUNT(*)::bigint AS total_chunks,
          COUNT(cc."embedding")::bigint AS embedded_chunks
        FROM "CandidateChunk" cc
        INNER JOIN "Candidate" c ON c."id" = cc."candidateId"
        WHERE cc."tenantId" = ${tenantId}
          AND c."pipelineStage" <> 'ARCHIVED'::"CandidatePipelineStage"
      `,
    ]);

    return {
      provider: this.providerName,
      totalCandidates: Number(candCountRows[0]?.total ?? 0),
      indexedCandidates: Number(chunkStatsRows[0]?.indexed_candidates ?? 0),
      totalChunks: Number(chunkStatsRows[0]?.total_chunks ?? 0),
      embeddedChunks: Number(chunkStatsRows[0]?.embedded_chunks ?? 0),
    };
  }
}

export const pgVectorStoreAdapter = new PgVectorStoreAdapter();
