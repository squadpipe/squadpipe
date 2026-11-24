-- Move legacy Enterprise (unlimited) tier to custom-only visibility and rename Free -> Free Trial.
UPDATE "SubscriptionPlan"
SET "isCustom" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'enterprise';

UPDATE "SubscriptionPlan"
SET "name" = 'Free Trial',
    "description" = 'Default workspace trial plan with 100 total SquadAI credits.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'free';
