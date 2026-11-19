-- Enable pgvector extension (supported natively by pgvector/pgvector:pg16 locally and AWS RDS PostgreSQL 16.5+)
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "CandidateChunk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'squadpipe-agency',
    "candidateId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "sectionType" TEXT NOT NULL DEFAULT 'RESUME',
    "chunkText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" halfvec(768),
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateChunk_pkey" PRIMARY KEY ("id")
);

-- Indexes for multi-tenant isolation, Full-Text Search (FTS), and HNSW semantic vector search
CREATE UNIQUE INDEX "CandidateChunk_candidateId_chunkIndex_key" ON "CandidateChunk"("candidateId", "chunkIndex");
CREATE INDEX "CandidateChunk_tenantId_idx" ON "CandidateChunk"("tenantId");
CREATE INDEX "CandidateChunk_tenantId_candidateId_idx" ON "CandidateChunk"("tenantId", "candidateId");
CREATE INDEX "CandidateChunk_chunkText_fts_idx" ON "CandidateChunk" USING GIN (to_tsvector('english', "chunkText"));
CREATE INDEX "CandidateChunk_embedding_hnsw_idx" ON "CandidateChunk" USING hnsw ("embedding" halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);

-- AddForeignKey
ALTER TABLE "CandidateChunk" ADD CONSTRAINT "CandidateChunk_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
