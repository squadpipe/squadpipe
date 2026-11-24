-- Common SaaS Subscription Plans, Tenant Subscriptions (defaulting to Free on signup),
-- Custom Plan overrides, Purchased AI Credits top-up wallet, and creditSource attribution.

ALTER TABLE "AiUsageLog"
  ADD COLUMN IF NOT EXISTS "creditSource" TEXT NOT NULL DEFAULT 'plan';

CREATE INDEX IF NOT EXISTS "AiUsageLog_tenantId_creditSource_createdAt_idx"
  ON "AiUsageLog"("tenantId", "creditSource", "createdAt");

CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "monthlyAiCredits" INTEGER NOT NULL DEFAULT 100,
  "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
  "allowByoKey" BOOLEAN NOT NULL DEFAULT false,
  "actionCenterAgentEnabled" BOOLEAN NOT NULL DEFAULT false,
  "isCustom" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_code_key"
  ON "SubscriptionPlan"("code");

CREATE INDEX IF NOT EXISTS "SubscriptionPlan_active_sortOrder_idx"
  ON "SubscriptionPlan"("active", "sortOrder");

CREATE TABLE IF NOT EXISTS "TenantSubscription" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
  "customPlanName" TEXT,
  "customMonthlyCredits" INTEGER,
  "customAllowByoKey" BOOLEAN,
  "customActionCenterAgent" BOOLEAN,
  "purchasedCreditsBalance" INTEGER NOT NULL DEFAULT 0,
  "purchasedCreditsTotal" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantSubscription_tenantId_key"
  ON "TenantSubscription"("tenantId");

CREATE INDEX IF NOT EXISTS "TenantSubscription_planId_idx"
  ON "TenantSubscription"("planId");

CREATE TABLE IF NOT EXISTS "AiCreditPurchase" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "userId" TEXT,
  "creditsAdded" INTEGER NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'PURCHASE',
  "referenceId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiCreditPurchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiCreditPurchase_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AiCreditPurchase_tenantId_createdAt_idx"
  ON "AiCreditPurchase"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiCreditPurchase_subscriptionId_idx"
  ON "AiCreditPurchase"("subscriptionId");

-- Seed common SaaS plans (0 monthlyAiCredits = Unlimited)
INSERT INTO "SubscriptionPlan" (
  "id", "code", "name", "description", "monthlyAiCredits", "aiEnabled", "allowByoKey", "actionCenterAgentEnabled", "isCustom", "active", "sortOrder"
) VALUES
  ('plan_free', 'free', 'Free', 'Default workspace plan with 100 monthly SquadAI credits.', 100, true, false, false, false, true, 1),
  ('plan_starter', 'starter', 'Starter', 'For small staffing teams with 1,000 monthly SquadAI credits and Action Center AI.', 1000, true, false, true, false, true, 2),
  ('plan_growth', 'growth', 'Growth', 'For scaling recruiting teams with 5,000 monthly SquadAI credits.', 5000, true, false, true, false, true, 3),
  ('plan_enterprise', 'enterprise', 'Enterprise', 'Unlimited monthly SquadAI credits with optional Bring-Your-Own-Key support.', 0, true, true, true, false, true, 4),
  ('plan_custom', 'custom', 'Custom Plan', 'Custom enterprise plan with bespoke monthly SquadAI credits and capabilities.', 0, true, true, true, true, true, 5)
ON CONFLICT ("code") DO NOTHING;

-- Attach all existing tenants to their legacy entitlement plan or default Free plan
INSERT INTO "TenantSubscription" (
  "id",
  "tenantId",
  "planId",
  "aiEnabled",
  "customPlanName",
  "customMonthlyCredits",
  "customAllowByoKey",
  "customActionCenterAgent"
)
SELECT
  gen_random_uuid()::text,
  t."tenant_id",
  COALESCE(
    (
      SELECT sp."id"
      FROM "SubscriptionPlan" sp
      WHERE sp."code" = LOWER(COALESCE(ts."ai_config"->'platformEntitlement'->>'planTier', ''))
      LIMIT 1
    ),
    (
      SELECT sp."id"
      FROM "SubscriptionPlan" sp
      WHERE sp."code" = CASE
        WHEN (ts."ai_config"->'platformEntitlement'->>'monthlyActionLimit') ~ '^\d+$'
        THEN 'custom'
        ELSE 'free'
      END
      LIMIT 1
    ),
    (SELECT sp."id" FROM "SubscriptionPlan" sp WHERE sp."code" = 'free' LIMIT 1)
  ),
  CASE
    WHEN (ts."ai_config"->'platformEntitlement'->>'aiEnabled') = 'false' THEN false
    ELSE true
  END,
  CASE
    WHEN LOWER(TRIM(COALESCE(ts."ai_config"->'platformEntitlement'->>'planTier', ''))) IN ('', 'default', 'free', 'starter', 'growth', 'enterprise', 'custom')
    THEN NULL
    ELSE NULLIF(TRIM(COALESCE(ts."ai_config"->'platformEntitlement'->>'planTier', '')), '')
  END,
  CASE
    WHEN (ts."ai_config"->'platformEntitlement'->>'monthlyActionLimit') ~ '^\d+$'
    THEN (ts."ai_config"->'platformEntitlement'->>'monthlyActionLimit')::INTEGER
    ELSE NULL
  END,
  CASE
    WHEN (ts."ai_config"->'platformEntitlement'->>'allowByoKey') = 'true' THEN true
    WHEN (ts."ai_config"->'platformEntitlement'->>'allowByoKey') = 'false' THEN false
    ELSE NULL
  END,
  CASE
    WHEN (ts."ai_config"->'platformEntitlement'->>'actionCenterAgentEnabled') = 'true' THEN true
    WHEN (ts."ai_config"->'platformEntitlement'->>'actionCenterAgentEnabled') = 'false' THEN false
    ELSE NULL
  END
FROM (
  SELECT DISTINCT "tenant_id" FROM "tenant_settings"
  UNION
  SELECT DISTINCT "tenantId" AS "tenant_id" FROM "User"
) t
LEFT JOIN "tenant_settings" ts ON ts."tenant_id" = t."tenant_id"
ON CONFLICT ("tenantId") DO NOTHING;
