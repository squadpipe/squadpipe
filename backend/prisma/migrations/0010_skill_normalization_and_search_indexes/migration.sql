-- Canonical normalized skill array + full-pool GIN search indexes on Candidate for 5,000+ resume scale
ALTER TABLE "Candidate"
ADD COLUMN IF NOT EXISTS "normalizedSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Exact array containment (@>) GIN index for canonical skill matching (sub-2ms across thousands of candidates)
CREATE INDEX IF NOT EXISTS "Candidate_normalizedSkills_gin_idx"
ON "Candidate" USING GIN ("normalizedSkills");

-- Full-text GIN index directly on Candidate profile + resume snippet so newly imported resumes are immediately searchable
CREATE INDEX IF NOT EXISTS "Candidate_fulltext_search_gin_idx"
ON "Candidate" USING GIN (
  to_tsvector(
    'english',
    COALESCE("fullName", '') || ' ' || COALESCE("currentTitle", '') || ' ' || COALESCE("skillset", '') || ' ' || COALESCE("rawSnippet", '')
  )
);

-- Trigram GIN index on rawSnippet for fuzzy/substring ILIKE across full resumes
CREATE INDEX IF NOT EXISTS "Candidate_rawSnippet_trgm_idx"
ON "Candidate" USING GIN ("rawSnippet" gin_trgm_ops);
