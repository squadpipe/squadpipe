import type { VectorStoreAdapter } from './vectorStore.interface';
import { pgVectorStoreAdapter } from './pgvectorStore.adapter';

/**
 * Resolves the active vector retrieval backend from VECTOR_PROVIDER (defaults to pgvector).
 * Designed so external engines (e.g. Qdrant / Turbopuffer) plug in here without changing callers.
 */
export function getVectorStore(env: NodeJS.ProcessEnv = process.env): VectorStoreAdapter {
  const provider = String(env.VECTOR_PROVIDER || 'pgvector').trim().toLowerCase();
  switch (provider) {
    case 'pgvector':
    default:
      return pgVectorStoreAdapter;
  }
}
