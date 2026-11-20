-- Search and 10k-scale indexing performance indexes for Candidate (FTS + Trigram ILIKE + Bench Paging)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Dedicated GIN Full-Text index on Candidate skills + title (avoids sequential scans on profile FTS branch)
CREATE INDEX IF NOT EXISTS "Candidate_profile_fts_idx"
ON "Candidate" USING GIN (to_tsvector('english', COALESCE("skillset", '') || ' ' || COALESCE("currentTitle", '')));

-- Trigram GIN indexes to accelerate ILIKE '%...%' workspace and drawer text filters at 10k+ scale
CREATE INDEX IF NOT EXISTS "Candidate_fullName_trgm_idx"
ON "Candidate" USING GIN ("fullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Candidate_currentTitle_trgm_idx"
ON "Candidate" USING GIN ("currentTitle" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Candidate_skillset_trgm_idx"
ON "Candidate" USING GIN ("skillset" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Candidate_email_trgm_idx"
ON "Candidate" USING GIN ("email" gin_trgm_ops);

-- Composite tenant + pipeline stage + updatedAt index for filtered bench counts and fallback ordering
CREATE INDEX IF NOT EXISTS "Candidate_tenantId_pipelineStage_updatedAt_idx"
ON "Candidate"("tenantId", "pipelineStage", "updatedAt" DESC);
