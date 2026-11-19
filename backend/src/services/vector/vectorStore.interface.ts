import type { CandidateChunkDraft } from './resumeChunker';

export interface HybridSearchQuery {
  tenantId: string;
  queryText: string;
  queryVector?: number[] | null;
  skillTokens: string[];
  searchFilter?: string;
  workAuthFilter?: string;
  candidateIdsFilter?: string[];
  limit?: number;
}

export interface HybridCandidateMatch {
  candidateId: string;
  hybridScore: number;
  vectorScore: number;
  textScore: number;
  matchedChunks: string[];
}

export interface TenantVectorIndexStats {
  provider: string;
  totalCandidates: number;
  indexedCandidates: number;
  totalChunks: number;
  embeddedChunks: number;
}

/**
 * Storage-agnostic vector retrieval interface so pgvector can be swapped to Qdrant/Pinecone
 * without modifying matching logic or API endpoints.
 */
export interface VectorStoreAdapter {
  readonly providerName: string;

  upsertCandidateChunks(params: {
    tenantId: string;
    candidateId: string;
    chunks: CandidateChunkDraft[];
    vectors?: Array<number[] | null>;
    embeddingModel?: string | null;
  }): Promise<void>;

  deleteCandidateChunks(tenantId: string, candidateId: string): Promise<void>;

  hybridSearchCandidates(params: HybridSearchQuery): Promise<{
    matches: HybridCandidateMatch[];
    retrievalMethod: 'pgvector_hybrid' | 'pg_fts';
    totalTenantPool: number;
  }>;

  getTenantIndexStats(tenantId: string): Promise<TenantVectorIndexStats>;
}
