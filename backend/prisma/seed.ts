import 'dotenv/config';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_TAXONOMIES } from '../src/config/taxonomies.config';
import { DEFAULT_GENERAL_SETTINGS } from '../src/config/smtp.config';
import { DEFAULT_TENANT_RULES } from '../src/services/automationEngine.service';

const prisma = new PrismaClient();

async function seedBootstrapAdmin(tenantId: string, agencyName: string): Promise<string | undefined> {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || '';
  const adminName = (process.env.SEED_ADMIN_NAME || 'Workspace Administrator').trim();

  if (!adminEmail || !adminPassword) {
    return undefined;
  }

  if (adminPassword.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters long.');
  }

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const created = await prisma.user.create({
    data: {
      fullName: adminName,
      email: adminEmail,
      passwordHash,
      agencyName,
      tenantId,
      role: UserRole.ADMINISTRATOR,
      desk: 'Operations & Administration',
      rateMasked: false,
      status: UserStatus.ACTIVE,
      workload: '0 Requisitions • 0 Submissions',
    },
    select: { id: true },
  });

  console.log(`Created bootstrap administrator account for tenant "${tenantId}".`);
  return created.id;
}

async function seedMasterTaxonomies(tenantId: string): Promise<number> {
  const result = await prisma.masterTaxonomy.createMany({
    data: DEFAULT_TAXONOMIES.map((item) => ({
      tenantId,
      category: item.category,
      optionValue: item.optionValue,
      sortOrder: item.sortOrder,
      active: true,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

async function seedDefaultAutomationRules(tenantId: string, createdById?: string): Promise<number> {
  const existing = await prisma.automationRule.findMany({
    where: { tenantId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((r) => r.name));
  const missing = DEFAULT_TENANT_RULES.filter((rule) => !existingNames.has(rule.name));

  for (const template of missing) {
    await prisma.automationRule.create({
      data: {
        tenantId,
        name: template.name,
        category: template.category,
        triggerEvent: template.triggerEvent,
        icon: template.icon,
        color: template.color,
        threshold: template.threshold,
        whenText: template.whenText,
        thenSummary: template.thenSummary,
        actions: template.actions,
        createdById,
        active: true,
      },
    });
  }

  return missing.length;
}

async function ensureTenantSettings(tenantId: string, agencyName: string): Promise<void> {
  await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      generalConfig: {
        ...DEFAULT_GENERAL_SETTINGS,
        agencyName,
      },
    },
  });
}

async function main() {
  const tenantId = (process.env.SEED_TENANT_ID || 'squadpipe-agency').trim() || 'squadpipe-agency';
  const agencyName = (process.env.SEED_AGENCY_NAME || DEFAULT_GENERAL_SETTINGS.agencyName).trim();

  console.log(`Seeding essential bootstrap data for tenant "${tenantId}" (non-destructive)...`);

  const adminId = await seedBootstrapAdmin(tenantId, agencyName);
  await ensureTenantSettings(tenantId, agencyName);
  const taxonomyCount = await seedMasterTaxonomies(tenantId);
  const rulesCount = await seedDefaultAutomationRules(tenantId, adminId);

  console.log(
    `Bootstrap seed completed: ${taxonomyCount} new taxonomy option(s), ${rulesCount} new automation rule(s).`
  );
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
