import 'dotenv/config';
import { prisma } from '../config/prisma.config';
import { aiUsageService } from '../services/ai/aiUsage.service';

interface CliOptions {
  tenantId: string;
  planCode?: string;
  credits?: number;
  name?: string;
  byo?: boolean;
  agent?: boolean;
  addCredits?: number;
  notes?: string;
  force: boolean;
}

function parseBoolFlag(raw: string, flag: string): boolean {
  const clean = raw.trim().toLowerCase();
  if (clean === 'true' || clean === '1' || clean === 'yes') return true;
  if (clean === 'false' || clean === '0' || clean === 'no') return false;
  throw new Error(`Invalid boolean for ${flag}: "${raw}". Expected true or false.`);
}

function parseNonNegativeInt(raw: string, flag: string): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
    throw new Error(`Invalid integer for ${flag}: "${raw}".`);
  }
  return num;
}

function printUsage(): void {
  console.log(`Usage:
  node dist/scripts/setTenantPlan.js <tenantId> [planCode] [options]

Examples:
  node dist/scripts/setTenantPlan.js tenant_mwv9x9nl_4e4de916
  node dist/scripts/setTenantPlan.js tenant_mwv9x9nl_4e4de916 growth
  node dist/scripts/setTenantPlan.js tenant_mwv9x9nl_4e4de916 custom --credits 10000 --name "Custom 10k" --byo true
  node dist/scripts/setTenantPlan.js tenant_mwv9x9nl_4e4de916 --add-credits 1000 --notes "Promo pack"

Options:
  --credits <n>      Monthly plan credits (for custom plans; 0 = unlimited)
  --name <label>     Display name for custom plan
  --byo <true|false> Override Bring-Your-Own-Key permission
  --agent <true|false> Override Action Center AI permission
  --add-credits <n>  Grant extra add-on credits to workspace wallet
  --notes <text>     Notes recorded on add-on credit grant
  --force            Create/update subscription even if no users exist yet for tenantId`);
}

function parseArgs(argv: string[]): CliOptions {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const positional: string[] = [];
  const opts: Partial<CliOptions> = { force: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const next = () => {
      if (i + 1 >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[++i];
    };

    switch (arg) {
      case '--credits':
        opts.credits = parseNonNegativeInt(next(), '--credits');
        break;
      case '--name':
        opts.name = next().trim();
        break;
      case '--byo':
        opts.byo = parseBoolFlag(next(), '--byo');
        break;
      case '--agent':
        opts.agent = parseBoolFlag(next(), '--agent');
        break;
      case '--add-credits':
        opts.addCredits = parseNonNegativeInt(next(), '--add-credits');
        break;
      case '--notes':
        opts.notes = next().trim();
        break;
      case '--force':
        opts.force = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  const tenantId = (positional[0] || '').trim();
  if (!tenantId) {
    throw new Error('tenantId is required.');
  }

  return {
    tenantId,
    planCode: positional[1]?.trim().toLowerCase() || undefined,
    credits: opts.credits,
    name: opts.name,
    byo: opts.byo,
    agent: opts.agent,
    addCredits: opts.addCredits,
    notes: opts.notes,
    force: Boolean(opts.force),
  };
}

async function assertTenantExists(tenantId: string, force: boolean): Promise<void> {
  if (force) return;
  const [userCount, settingsRow, subRow] = await Promise.all([
    prisma.user.count({ where: { tenantId } }),
    prisma.tenantSettings.findUnique({ where: { tenantId }, select: { tenantId: true } }),
    prisma.tenantSubscription.findUnique({ where: { tenantId }, select: { id: true } }),
  ]);
  if (userCount === 0 && !settingsRow && !subRow) {
    throw new Error(
      `No workspace records found for "${tenantId}". Double-check the Workspace ID or pass --force to provision anyway.`
    );
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  await assertTenantExists(opts.tenantId, opts.force);

  const isInspectOnly =
    !opts.planCode &&
    opts.credits === undefined &&
    opts.name === undefined &&
    opts.byo === undefined &&
    opts.agent === undefined &&
    opts.addCredits === undefined;

  if (!isInspectOnly) {
    const hasPlanChange =
      Boolean(opts.planCode) ||
      opts.credits !== undefined ||
      opts.name !== undefined ||
      opts.byo !== undefined ||
      opts.agent !== undefined;

    if (hasPlanChange) {
      const isPresetSwitch =
        Boolean(opts.planCode) && opts.planCode !== 'custom' && opts.planCode !== 'enterprise';

      await aiUsageService.savePlatformAiEntitlement(opts.tenantId, {
        ...(opts.planCode ? { planCode: opts.planCode } : {}),
        ...(opts.name !== undefined ? { customPlanName: opts.name } : {}),
        ...(opts.credits !== undefined ? { customMonthlyCredits: opts.credits } : {}),
        ...(opts.byo !== undefined
          ? { allowByoKey: opts.byo }
          : isPresetSwitch
            ? { allowByoKey: null }
            : {}),
        ...(opts.agent !== undefined
          ? { actionCenterAgentEnabled: opts.agent }
          : isPresetSwitch
            ? { actionCenterAgentEnabled: null }
            : {}),
      });
    }

    if (opts.addCredits !== undefined && opts.addCredits > 0) {
      await aiUsageService.addPurchasedAiCredits(opts.tenantId, {
        credits: opts.addCredits,
        source: 'PLATFORM_GRANT',
        notes: opts.notes || 'Server CLI credit grant',
      });
    }
  }

  const summary = await aiUsageService.getMonthlyUsageSummary(opts.tenantId);
  console.log(
    JSON.stringify(
      {
        tenantId: summary.tenantId,
        planCode: summary.plan.code,
        planName: summary.plan.name,
        isCustom: summary.plan.isCustom,
        monthlyPlanCredits: summary.planCreditLimit,
        creditsUsedThisMonth: summary.creditsUsed,
        planCreditsRemaining: summary.planCreditsRemaining,
        purchasedCreditsRemaining: summary.purchasedCreditsRemaining,
        totalCreditsRemaining: summary.totalCreditsRemaining,
        allowByoKey: summary.allowByoKey,
        availablePublicPlans: summary.availablePlans.map((p) => p.code),
      },
      null,
      2
    )
  );
}

main()
  .catch((err: any) => {
    console.error('Error:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
