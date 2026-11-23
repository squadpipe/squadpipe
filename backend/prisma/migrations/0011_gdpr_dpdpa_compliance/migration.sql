-- GDPR & India DPDPA compliance schema:
-- 1) Candidate consent, lawful basis, provenance & retention fields
-- 2) 365-day SecurityAuditLog for access, role, rate-mask, export & erasure accountability
-- 3) ErasureOutbox for verified CV/vector deletion retries & post-restore erasure ledger

DO $$ BEGIN
  CREATE TYPE "CandidateLawfulBasis" AS ENUM ('CONSENT', 'LEGITIMATE_INTEREST', 'CONTRACT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'WITHDRAWN', 'PENDING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ErasureTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Candidate"
  ADD COLUMN IF NOT EXISTS "lawfulBasis" "CandidateLawfulBasis" NOT NULL DEFAULT 'LEGITIMATE_INTEREST',
  ADD COLUMN IF NOT EXISTS "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "consentCapturedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "consentWithdrawnAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "privacyNoticeVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "intakeSource" TEXT DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "retentionExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "erasureNoticeSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Candidate_tenantId_retentionExpiresAt_idx"
  ON "Candidate"("tenantId", "retentionExpiresAt");

CREATE INDEX IF NOT EXISTS "Candidate_tenantId_consentStatus_idx"
  ON "Candidate"("tenantId", "consentStatus");

CREATE TABLE IF NOT EXISTS "SecurityAuditLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'squadpipe-agency',
  "actorUserId" TEXT,
  "actorEmail" TEXT,
  "actorRole" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SecurityAuditLog_tenantId_createdAt_idx"
  ON "SecurityAuditLog"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "SecurityAuditLog_tenantId_action_idx"
  ON "SecurityAuditLog"("tenantId", "action");

CREATE INDEX IF NOT EXISTS "SecurityAuditLog_targetType_targetId_idx"
  ON "SecurityAuditLog"("targetType", "targetId");

CREATE TABLE IF NOT EXISTS "ErasureOutbox" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'squadpipe-agency',
  "candidateId" TEXT NOT NULL,
  "subjectHash" TEXT NOT NULL,
  "storageUri" TEXT,
  "vectorDeleted" BOOLEAN NOT NULL DEFAULT false,
  "storageDeleted" BOOLEAN NOT NULL DEFAULT false,
  "status" "ErasureTaskStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "requestedById" TEXT,
  "reason" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ErasureOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ErasureOutbox_status_updatedAt_idx"
  ON "ErasureOutbox"("status", "updatedAt");

CREATE INDEX IF NOT EXISTS "ErasureOutbox_tenantId_createdAt_idx"
  ON "ErasureOutbox"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "ErasureOutbox_subjectHash_idx"
  ON "ErasureOutbox"("subjectHash");
