import 'dotenv/config';
import { prisma } from '../config/prisma.config';
import { aiUsageService } from '../services/ai/aiUsage.service';

interface CliOptions {
  list: boolean;
  target: string;
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
  node dist/scripts/setTenantPlan.js --list
  node dist/scripts/setTenantPlan.js <tenantId_or_userEmail> [planCode] [options]

Examples:
  node dist/scripts/setTenantPlan.js --list
  node dist/scripts/setTenantPlan.js tenant_mwv9x9nl_4e4de916 growth
  node dist/scripts/setTenantPlan.js founder@agency.com growth
  node dist/scripts/setTenantPlan.js founder@agency.com custom --credits 10000 --name "Custom 10k" --byo true
  node dist/scripts/setTenantPlan.js founder@agency.com --add-credits 1000 --notes "Promo pack"

Options:
  --list               List all workspaces with admin email, tenantId, and active plan
  --credits <n>        Monthly plan credits (for custom plans; 0 = unlimited)
  --name <label>       Display name for custom plan
  --byo <true|false>   Override Bring-Your-Own-Key permission
  --agent <true|false> Override Action Center AI permission
  --add-credits <n>    Grant extra add-on credits to workspace wallet
  --notes <text>       Notes recorded on add-on credit grant
  --force              Create/update subscription even if no users exist yet for tenantId`);
}

function parseArgs(argv: string[]): CliOptions {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const positional: string[] = [];
  const opts: Partial<CliOptions> = { force: false, list: false };

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
      case '--list':
        opts.list = true;
        break;
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

  const target = (positional[0] || '').trim();
  if (!opts.list && !target) {
    throw new Error('tenantId or user email is required (or pass --list).');
  }

  return {
    list: Boolean(opts.list),
    target,
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

async function listAllWorkspaces(): Promise<void> {
  const [subscriptions, users] = await Promise.all([
    prisma.tenantSubscription.findMany({
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      select: { tenantId: true, email: true, agencyName: true, role: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const byTenant = new Map<string, { emails: string[]; agencyName: string | null }>();
  for (const u of users) {
    const entry = byTenant.get(u.tenantId) || { emails: [], agencyName: null };
    entry.emails.push(u.email);
    if (!entry.agencyName && u.agencyName) entry.agencyName = u.agencyName;
    byTenant.set(u.tenantId, entry);
  }

  const allTenantIds = Array.from(
    new Set([...subscriptions.map((s) => s.tenantId), ...byTenant.keys()])
  );
  const subByTenant = new Map(subscriptions.map((s) => [s.tenantId, s]));

  const rows = allTenantIds.map((tenantId) => {
    const sub = subByTenant.get(tenantId);
    const meta = byTenant.get(tenantId);
    const planCode = sub?.plan?.code || 'free';
    const planName = sub?.customPlanName || sub?.plan?.name || 'Free Trial';
    const monthlyCredits =
      sub?.customMonthlyCredits !== null && sub?.customMonthlyCredits !== undefined
        ? sub.customMonthlyCredits
        : sub?.plan?.monthlyAiCredits ?? 100;
    return {
      tenantId,
      agencyName: meta?.agencyName || null,
      users: meta?.emails || [],
      planCode,
      planName,
      monthlyCredits,
      purchasedCreditsBalance: sub?.purchasedCreditsBalance ?? 0,
    };
  });

  console.log(JSON.stringify(rows, null, 2));
}

async function resolveTenantId(target: string, force: boolean): Promise<string> {
  if (target.includes('@')) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: target.trim(), mode: 'insensitive' } },
      select: { tenantId: true, email: true },
    });
    if (!user) {
      throw new Error(`No user found with email "${target}".`);
    }
    return user.tenantId;
  }

  if (!force) {
    const [userCount, settingsRow, subRow] = await Promise.all([
      prisma.user.count({ where: { tenantId: target } }),
      prisma.tenantSettings.findUnique({ where: { tenantId: target }, select: { tenantId: true } }),
      prisma.tenantSubscription.findUnique({ where: { tenantId: target }, select: { id: true } }),
    ]);
    if (userCount === 0 && !settingsRow && !subRow) {
      throw new Error(
        `No workspace records found for "${target}". Double-check the ID/email or pass --force.`
      );
    }
  }
  return target;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.list) {
    await listAllWorkspaces();
    return;
  }

  const tenantId = await resolveTenantId(opts.target, opts.force);

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

      await aiUsageService.savePlatformAiEntitlement(tenantId, {
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
      await aiUsageService.addPurchasedAiCredits(tenantId, {
        credits: opts.addCredits,
        source: 'PLATFORM_GRANT',
        notes: opts.notes || 'Server CLI credit grant',
      });
    }
  }

  const summary = await aiUsageService.getMonthlyUsageSummary(tenantId);
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
