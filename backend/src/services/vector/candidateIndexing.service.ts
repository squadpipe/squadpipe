import { CandidatePipelineStage } from '@prisma/client';
import { prisma } from '../../config/prisma.config';
import { embeddingService } from './embedding.service';
import { buildCandidateChunks } from './resumeChunker';
import { getVectorStore } from './vectorStore.router';

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
   * Fires background candidate chunking + embedding sync without blocking HTTP writes.
   */
  scheduleCandidateSync(candidateId: string, tenantId: string) {
    setImmediate(() => {
      this.syncCandidate(candidateId, tenantId, { generateEmbeddings: true }).catch((err) => {
        console.warn('[VectorIndex] Background sync skipped:', err?.message || err);
      });
    });
  }

  async deleteCandidate(tenantId: string, candidateId: string): Promise<void> {
    const store = getVectorStore();
    await store.deleteCandidateChunks(tenantId, candidateId);
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

    const embedded = await embeddingService.embedTexts(
      unembeddedChunks.map((u) => u.chunkText),
      { tenantId }
    );
    if (!embedded) return;

    await this.writeChunkEmbeddings(unembeddedChunks, embedded.vectors, embedded.model);
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
