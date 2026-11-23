import { CandidatePipelineStage, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.config';
import { embeddingService } from './embedding.service';
import { buildCandidateChunks } from './resumeChunker';
import { getVectorStore } from './vectorStore.router';
import { extractNormalizedSkills } from '../../utils/skillMatcher';

const INDEX_CANDIDATE_SELECT = {
  id: true,
  tenantId: true,
  currentTitle: true,
  skillset: true,
  workAuth: true,
  education: true,
  relocation: true,
  rawSnippet: true,
  pipelineStage: true,
} as const;

export class CandidateIndexingService {
  private readonly pendingSyncByTenant = new Map<string, Set<string>>();
  private drainPromise: Promise<void> | null = null;

  /**
   * Builds multi-page CV chunks (and optional vector embeddings) for a single candidate.
   */
  async syncCandidate(
    candidateId: string,
    tenantId: string,
    options: { generateEmbeddings?: boolean } = {}
  ): Promise<{ chunksStored: number; embeddingsGenerated: number }> {
    const store = getVectorStore();
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, tenantId },
      select: INDEX_CANDIDATE_SELECT,
    });

    if (!candidate || candidate.pipelineStage === CandidatePipelineStage.ARCHIVED) {
      await store.deleteCandidateChunks(tenantId, candidateId);
      return { chunksStored: 0, embeddingsGenerated: 0 };
    }

    const chunks = buildCandidateChunks(candidate);
    if (chunks.length === 0) {
      await store.deleteCandidateChunks(tenantId, candidateId);
      return { chunksStored: 0, embeddingsGenerated: 0 };
    }

    const shouldEmbed = options.generateEmbeddings ?? true;
    let vectors: Array<number[] | null> = [];
    let embeddingModel: string | null = null;
    let embeddingsGenerated = 0;

    if (shouldEmbed) {
      // Check if existing chunks already match contentHash with embeddings
      const existingRows = await prisma.candidateChunk.findMany({
        where: { tenantId, candidateId },
        select: { chunkIndex: true, contentHash: true, embeddingModel: true },
      });
      const existingHashMap = new Map(existingRows.map((r) => [r.chunkIndex, r]));
      const needsEmbedding =
        existingRows.length !== chunks.length ||
        chunks.some((c) => {
          const prev = existingHashMap.get(c.chunkIndex);
          return !prev || prev.contentHash !== c.contentHash || !prev.embeddingModel;
        });

      if (needsEmbedding) {
        const embedded = await embeddingService.embedTexts(
          chunks.map((c) => c.chunkText),
          { tenantId }
        );
        if (embedded && embedded.vectors.length === chunks.length) {
          vectors = embedded.vectors;
          embeddingModel = embedded.model;
          embeddingsGenerated = vectors.length;
        }
      }
    }

    await store.upsertCandidateChunks({
      tenantId,
      candidateId,
      chunks,
      vectors,
      embeddingModel,
    });

    return { chunksStored: chunks.length, embeddingsGenerated };
  }

  /**
   * Queues candidate chunking & throttled batch embeddings without flooding DB or API pools during bulk imports.
   */
  scheduleCandidateSync(candidateId: string, tenantId: string) {
    const cleanCandId = String(candidateId || '').trim();
    const cleanTenantId = String(tenantId || '').trim();
    if (!cleanCandId || !cleanTenantId) return;

    let set = this.pendingSyncByTenant.get(cleanTenantId);
    if (!set) {
      set = new Set<string>();
      this.pendingSyncByTenant.set(cleanTenantId, set);
    }
    set.add(cleanCandId);

    if (!this.drainPromise) {
      this.drainPromise = new Promise<void>((resolve) => {
        setImmediate(() => {
          this.drainQueuedSyncs()
            .catch((err) => {
              console.warn('[VectorIndex] Background queue error:', err?.message || err);
            })
            .finally(() => {
              this.drainPromise = null;
              if (this.pendingSyncByTenant.size > 0) {
                this.drainPromise = this.drainQueuedSyncs().finally(() => {
                  this.drainPromise = null;
                });
              }
              resolve();
            });
        });
      });
    }
  }

  private async drainQueuedSyncs(): Promise<void> {
    const tenantsNeedingEmbeds = new Set<string>();

    while (this.pendingSyncByTenant.size > 0) {
      const firstEntry = this.pendingSyncByTenant.entries().next().value as
        | [string, Set<string>]
        | undefined;
      if (!firstEntry) break;
      const [tenantId, idSet] = firstEntry;
      this.pendingSyncByTenant.delete(tenantId);

      const ids = Array.from(idSet);
      for (const candidateId of ids) {
        try {
          await this.syncCandidate(candidateId, tenantId, { generateEmbeddings: false });
          tenantsNeedingEmbeds.add(tenantId);
        } catch (err: any) {
          console.warn('[VectorIndex] Chunk sync skipped:', err?.message || err);
        }
      }
    }

    // Drain unembedded chunks in bounded 32-chunk API batches so bulk CSV imports embed smoothly
    for (const tenantId of tenantsNeedingEmbeds) {
      try {
        await this.ensureTenantIndexedForSearch(tenantId, {
          maxChunkSync: 0,
          maxEmbedChunks: 160,
        });
      } catch (err: any) {
        console.warn('[VectorIndex] Embedding backfill paused:', err?.message || err);
      }
    }
  }

  /**
   * Periodic background catch-up across all tenants so large 10k+ pools stay chunked & embedded.
   */
  async runBackgroundBackfillTick(options?: {
    maxChunkSync?: number;
    maxEmbedChunks?: number;
  }): Promise<void> {
    const maxChunkSync = options?.maxChunkSync ?? 400;
    const maxEmbedChunks = options?.maxEmbedChunks ?? 96;
    const tenants = await prisma.candidate.findMany({
      distinct: ['tenantId'],
      select: { tenantId: true },
    });
    for (const row of tenants) {
      await this.ensureTenantIndexedForSearch(row.tenantId, {
        maxChunkSync,
        maxEmbedChunks,
      });
    }
  }

  async deleteCandidate(tenantId: string, candidateId: string): Promise<void> {
    const store = getVectorStore();
    await store.deleteCandidateChunks(tenantId, candidateId);
  }

  private activeNormalizedDrains = new Set<string>();

  /**
   * Populates canonical `normalizedSkills` on a keyset batch of legacy/bulk-imported candidate rows
   * so GIN `@>` matching across any pool size works without scanning raw resume text.
   */
  private async backfillNormalizedSkillsBatch(
    tenantId: string,
    maxRows: number,
    afterId?: string
  ): Promise<{ fetched: number; updated: number; lastId?: string }> {
    const cursorFilter = afterId ? Prisma.sql`AND c."id" > ${afterId}` : Prisma.empty;
    const missing = await prisma.$queryRaw<
      Array<{
        id: string;
        currentTitle: string;
        skillset: string;
        rawSnippet: string | null;
      }>
    >`
      SELECT c."id", c."currentTitle", c."skillset", c."rawSnippet"
      FROM "Candidate" c
      WHERE c."tenantId" = ${tenantId}
        AND cardinality(c."normalizedSkills") = 0
        AND (
          COALESCE(c."skillset", '') <> ''
          OR COALESCE(c."currentTitle", '') <> ''
          OR COALESCE(c."rawSnippet", '') <> ''
        )
        ${cursorFilter}
      ORDER BY c."id" ASC
      LIMIT ${Math.max(1, maxRows)}
    `;

    if (missing.length === 0) return { fetched: 0, updated: 0 };

    let updated = 0;
    const CHUNK = 500;
    for (let i = 0; i < missing.length; i += CHUNK) {
      const slice = missing.slice(i, i + CHUNK);
      const payload = slice.map((cand) => ({
        id: cand.id,
        skills: extractNormalizedSkills({
          skillset: cand.skillset,
          currentTitle: cand.currentTitle,
          rawSnippet: cand.rawSnippet,
        }),
      }));
      await prisma.$executeRaw`
        UPDATE "Candidate" AS c
        SET "normalizedSkills" = COALESCE(v.skills, ARRAY[]::text[])
        FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS v(id text, skills text[])
        WHERE c."id" = v.id
          AND c."tenantId" = ${tenantId}
      `;
      updated += slice.length;
    }
    return {
      fetched: missing.length,
      updated,
      lastId: missing[missing.length - 1].id,
    };
  }

  async backfillNormalizedSkills(tenantId: string, maxRows = 2000): Promise<number> {
    const res = await this.backfillNormalizedSkillsBatch(tenantId, maxRows);
    return res.updated;
  }

  /**
   * Drains all remaining un-normalized candidate rows in a tenant asynchronously with no row cap.
   */
  async drainNormalizedSkillsBackfill(tenantId: string): Promise<number> {
    if (this.activeNormalizedDrains.has(tenantId)) return 0;
    this.activeNormalizedDrains.add(tenantId);
    let totalUpdated = 0;
    let cursorId: string | undefined;
    try {
      while (true) {
        const batch = await this.backfillNormalizedSkillsBatch(tenantId, 1000, cursorId);
        totalUpdated += batch.updated;
        if (batch.fetched < 1000 || !batch.lastId) break;
        cursorId = batch.lastId;
      }
      return totalUpdated;
    } finally {
      this.activeNormalizedDrains.delete(tenantId);
    }
  }

  /**
   * Ensures unindexed active consultants in a tenant have FTS chunks ready immediately
   * (and embeds a responsive inline batch when an embedding provider is configured).
   */
  async ensureTenantIndexedForSearch(
    tenantId: string,
    options: { maxChunkSync?: number; maxEmbedChunks?: number } = {}
  ): Promise<void> {
    const { maxChunkSync = 500, maxEmbedChunks = 48 } = options;
    const store = getVectorStore();

    await this.backfillNormalizedSkills(tenantId, Math.max(maxChunkSync, 1000)).catch(() => 0);

    const missingCandidates = await prisma.$queryRaw<
      Array<{
        id: string;
        currentTitle: string;
        skillset: string;
        workAuth: string;
        education: string | null;
        relocation: string;
        rawSnippet: string | null;
      }>
    >`
      SELECT c."id", c."currentTitle", c."skillset", c."workAuth", c."education", c."relocation", c."rawSnippet"
      FROM "Candidate" c
      LEFT JOIN "CandidateChunk" cc
        ON cc."candidateId" = c."id" AND cc."tenantId" = ${tenantId}
      WHERE c."tenantId" = ${tenantId}
        AND c."pipelineStage" <> 'ARCHIVED'::"CandidatePipelineStage"
        AND cc."id" IS NULL
      LIMIT ${maxChunkSync}
    `;

    for (const cand of missingCandidates) {
      const chunks = buildCandidateChunks(cand);
      if (chunks.length > 0) {
        await store.upsertCandidateChunks({
          tenantId,
          candidateId: cand.id,
          chunks,
        });
      }
    }

    const embedEnabled = await embeddingService.isConfiguredForTenant(tenantId);
    if (!embedEnabled || maxEmbedChunks <= 0) return;

    const unembeddedChunks = await prisma.$queryRaw<
      Array<{
        id: string;
        candidateId: string;
        chunkIndex: number;
        sectionType: string;
        chunkText: string;
        contentHash: string;
      }>
    >`
      SELECT cc."id", cc."candidateId", cc."chunkIndex", cc."sectionType", cc."chunkText", cc."contentHash"
      FROM "CandidateChunk" cc
      INNER JOIN "Candidate" c ON c."id" = cc."candidateId"
      WHERE cc."tenantId" = ${tenantId}
        AND c."pipelineStage" <> 'ARCHIVED'::"CandidatePipelineStage"
        AND cc."embedding" IS NULL
      ORDER BY c."updatedAt" DESC, cc."chunkIndex" ASC
      LIMIT ${maxEmbedChunks}
    `;

    if (unembeddedChunks.length === 0) return;

    const EMBED_BATCH_SIZE = 32;
    for (let i = 0; i < unembeddedChunks.length; i += EMBED_BATCH_SIZE) {
      const batch = unembeddedChunks.slice(i, i + EMBED_BATCH_SIZE);
      const embedded = await embeddingService.embedTexts(
        batch.map((u) => u.chunkText),
        { tenantId }
      );
      if (!embedded) break;
      await this.writeChunkEmbeddings(batch, embedded.vectors, embedded.model);
    }
  }

  private async writeChunkEmbeddings(
    chunkRows: Array<{ id: string }>,
    vectors: number[][],
    embeddingModel: string
  ) {
    const { toPgVectorLiteral } = await import('./embedding.service');
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < chunkRows.length; i++) {
        const vec = vectors[i];
        if (!vec) continue;
        const vecLiteral = toPgVectorLiteral(vec);
        await tx.$executeRaw`
          UPDATE "CandidateChunk"
          SET "embedding" = ${vecLiteral}::halfvec,
              "embeddingModel" = ${embeddingModel},
              "updatedAt" = NOW()
          WHERE "id" = ${chunkRows[i].id}
        `;
      }
    });
  }

  /**
   * Explicit tenant backfill for all active consultants (chunks + batch embeddings).
   */
  async reindexTenant(
    tenantId: string,
    options: { forceReembed?: boolean; batchSize?: number } = {}
  ) {
    const { forceReembed = false, batchSize = 32 } = options;
    const store = getVectorStore();

    const candidates = await prisma.candidate.findMany({
      where: {
        tenantId,
        pipelineStage: { not: CandidatePipelineStage.ARCHIVED },
      },
      select: INDEX_CANDIDATE_SELECT,
    });

    let chunksUpserted = 0;
    for (const cand of candidates) {
      const chunks = buildCandidateChunks(cand);
      await store.upsertCandidateChunks({
        tenantId,
        candidateId: cand.id,
        chunks,
      });
      chunksUpserted += chunks.length;
    }

    let embeddingsGenerated = 0;
    const embedEnabled = await embeddingService.isConfiguredForTenant(tenantId);

    if (embedEnabled) {
      if (forceReembed) {
        await prisma.$executeRaw`
          UPDATE "CandidateChunk"
          SET "embedding" = NULL, "embeddingModel" = NULL
          WHERE "tenantId" = ${tenantId}
        `;
      }

      while (true) {
        const batch = await prisma.$queryRaw<
          Array<{ id: string; chunkText: string }>
        >`
          SELECT cc."id", cc."chunkText"
          FROM "CandidateChunk" cc
          INNER JOIN "Candidate" c ON c."id" = cc."candidateId"
          WHERE cc."tenantId" = ${tenantId}
            AND c."pipelineStage" <> 'ARCHIVED'::"CandidatePipelineStage"
            AND cc."embedding" IS NULL
          LIMIT ${batchSize}
        `;
        if (batch.length === 0) break;

        const embedded = await embeddingService.embedTexts(
          batch.map((b) => b.chunkText),
          { tenantId }
        );
        if (!embedded) break;

        await this.writeChunkEmbeddings(batch, embedded.vectors, embedded.model);
        embeddingsGenerated += embedded.vectors.length;
      }
    }

    const stats = await store.getTenantIndexStats(tenantId);
    return {
      candidatesProcessed: candidates.length,
      chunksUpserted,
      embeddingsGenerated,
      embeddingsConfigured: embedEnabled,
      stats,
    };
  }
}

export const candidateIndexingService = new CandidateIndexingService();
