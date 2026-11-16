import nodemailer from 'nodemailer';
import { prisma } from './prisma.config';

export interface GeneralSettings {
  agencyName: string;
  legalEntityName: string;
  website: string;
  supportEmail: string;
  supportPhone: string;
  headquarters: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  defaultPaymentTerms: string;
  standardMonthlyHours: number;
  maskRatesByDefault: boolean;
  requirePoForPlacement: boolean;
}

export interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  encryption: 'STARTTLS' | 'SSL' | 'NONE';
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
}

export function isSmtpConfigured(smtp?: Partial<SmtpSettings> | null): boolean {
  if (!smtp) return false;
  return Boolean(
    smtp.enabled &&
      smtp.host?.trim() &&
      smtp.username?.trim() &&
      smtp.password?.trim() &&
      smtp.fromEmail?.trim()
  );
}

export interface TenantSettingsBundle {
  general: GeneralSettings;
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  agencyName: '',
  legalEntityName: '',
  website: '',
  supportEmail: '',
  supportPhone: '',
  headquarters: '',
  timezone: '',
  dateFormat: 'MM/DD/YYYY',
  currency: 'USD ($)',
  defaultPaymentTerms: 'Net 30 Days',
  standardMonthlyHours: 160,
  maskRatesByDefault: true,
  requirePoForPlacement: false,
};

const settingsMemoryCache = new Map<string, TenantSettingsBundle>();
let tableInitialized = false;

async function ensureTenantSettingsTable() {
  if (tableInitialized) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tenant_settings (
      tenant_id TEXT PRIMARY KEY,
      general_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE tenant_settings DROP COLUMN IF EXISTS smtp_config
  `);
  tableInitialized = true;
}

async function resolveTenantBrandDefaults(
  tenantId: string,
  general: GeneralSettings
): Promise<TenantSettingsBundle> {
  let resolvedAgencyName = (general.agencyName || '').trim();
  if (!resolvedAgencyName) {
    try {
      const owner = await prisma.user.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: { agencyName: true },
      });
      resolvedAgencyName = owner?.agencyName?.trim() || 'SquadPipe Staffing';
    } catch {
      resolvedAgencyName = 'SquadPipe Staffing';
    }
  }

  return {
    general: {
      ...general,
      agencyName: resolvedAgencyName,
    },
  };
}

export async function getTenantSettings(tenantId = 'squadpipe-agency'): Promise<TenantSettingsBundle> {
  const key = tenantId || 'squadpipe-agency';
  try {
    await ensureTenantSettingsTable();
    const rows = await prisma.$queryRawUnsafe<
      Array<{ general_config: Partial<GeneralSettings> }>
    >(
      `SELECT general_config FROM tenant_settings WHERE tenant_id = $1 LIMIT 1`,
      key
    );

    if (rows && rows.length > 0) {
      const bundle = await resolveTenantBrandDefaults(key, {
        ...DEFAULT_GENERAL_SETTINGS,
        ...(rows[0].general_config || {}),
      });
      settingsMemoryCache.set(key, bundle);
      return bundle;
    }

    const initialBundle = await resolveTenantBrandDefaults(key, { ...DEFAULT_GENERAL_SETTINGS });
    await prisma.$executeRawUnsafe(
      `INSERT INTO tenant_settings (tenant_id, general_config, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (tenant_id) DO NOTHING`,
      key,
      JSON.stringify(initialBundle.general)
    );
    settingsMemoryCache.set(key, initialBundle);
    return initialBundle;
  } catch (err) {
    console.warn('getTenantSettings fallback to cache:', err);
    return (
      settingsMemoryCache.get(key) || {
        general: { ...DEFAULT_GENERAL_SETTINGS },
      }
    );
  }
}

export async function saveGeneralSettings(
  tenantId: string,
  partial: Partial<GeneralSettings>
): Promise<GeneralSettings> {
  const current = await getTenantSettings(tenantId);
  const nextGeneral: GeneralSettings = {
    ...current.general,
    ...partial,
    standardMonthlyHours: Number(partial.standardMonthlyHours ?? current.general.standardMonthlyHours) || 160,
    maskRatesByDefault:
      partial.maskRatesByDefault !== undefined
        ? Boolean(partial.maskRatesByDefault)
        : current.general.maskRatesByDefault,
    requirePoForPlacement:
      partial.requirePoForPlacement !== undefined
        ? Boolean(partial.requirePoForPlacement)
        : current.general.requirePoForPlacement,
  };
  const key = tenantId || 'squadpipe-agency';
  await ensureTenantSettingsTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO tenant_settings (tenant_id, general_config, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET general_config = $2::jsonb, updated_at = NOW()`,
    key,
    JSON.stringify(nextGeneral)
  );
  if (nextGeneral.agencyName?.trim()) {
    try {
      await prisma.user.updateMany({
        where: { tenantId: key },
        data: { agencyName: nextGeneral.agencyName.trim() },
      });
    } catch {
      // Ignore if DB user sync is not available in unit/mock contexts
    }
  }
  settingsMemoryCache.set(key, { general: nextGeneral });
  return nextGeneral;
}

export const createDynamicSmtpTransporter = (smtp: SmtpSettings) => {
  const secure = smtp.encryption === 'SSL' || Number(smtp.port) === 465;
  return nodemailer.createTransport({
    host: smtp.host.trim(),
    port: Number(smtp.port) || (secure ? 465 : 587),
    secure,
    ...(smtp.encryption === 'NONE' ? { ignoreTLS: true } : {}),
    auth: {
      user: smtp.username.trim(),
      pass: smtp.password,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
};
