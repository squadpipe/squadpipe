import nodemailer from 'nodemailer';
import { prisma } from './prisma.config';
import { decryptSecret, encryptSecret } from '../utils/cryptoSecret';

export const MASKED_SECRET_PLACEHOLDER = '••••••••';

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

export interface RedactedSmtpSettings extends SmtpSettings {
  hasPassword: boolean;
  configured: boolean;
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

export function redactSmtpSettings(smtp: SmtpSettings): RedactedSmtpSettings {
  const hasPassword = Boolean(smtp.password && smtp.password.trim().length > 0);
  return {
    ...smtp,
    password: hasPassword ? MASKED_SECRET_PLACEHOLDER : '',
    hasPassword,
    configured: isSmtpConfigured(smtp),
  };
}

function safeDecryptSmtpPassword(rawPassword: unknown): string {
  if (typeof rawPassword !== 'string' || !rawPassword) return '';
  if (rawPassword === MASKED_SECRET_PLACEHOLDER) return '';
  try {
    return decryptSecret(rawPassword);
  } catch (err) {
    console.warn('Unable to decrypt stored SMTP password (key may have rotated):', err);
    return '';
  }
}

export interface TenantSettingsBundle {
  general: GeneralSettings;
  smtp: SmtpSettings;
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

export const DEFAULT_SMTP_SETTINGS: SmtpSettings = {
  enabled: true,
  host: '',
  port: 587,
  encryption: 'STARTTLS',
  username: '',
  password: '',
  fromName: '',
  fromEmail: '',
  replyToEmail: '',
};

const settingsMemoryCache = new Map<string, TenantSettingsBundle>();
let tableInitialized = false;

async function ensureTenantSettingsTable() {
  if (tableInitialized) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tenant_settings (
      tenant_id TEXT PRIMARY KEY,
      general_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      smtp_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableInitialized = true;
}

async function resolveTenantBrandDefaults(
  tenantId: string,
  general: GeneralSettings,
  smtp: SmtpSettings
): Promise<TenantSettingsBundle> {
  let resolvedAgencyName = (general.agencyName || '').trim();
  if (!resolvedAgencyName) {
    try {
      const owner = await prisma.user.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: { agencyName: true },
      });
      resolvedAgencyName = owner?.agencyName?.trim() || 'TalentOS Staffing';
    } catch {
      resolvedAgencyName = 'TalentOS Staffing';
    }
  }

  const resolvedFromName =
    smtp.fromName?.trim() && smtp.fromName.trim() !== 'TalentOS Recruitment Desk'
      ? smtp.fromName.trim()
      : `${resolvedAgencyName} Recruitment Desk`;

  return {
    general: {
      ...general,
      agencyName: resolvedAgencyName,
    },
    smtp: {
      ...smtp,
      fromName: resolvedFromName,
    },
  };
}

export async function getTenantSettings(tenantId = 'talentos-agency'): Promise<TenantSettingsBundle> {
  const key = tenantId || 'talentos-agency';
  try {
    await ensureTenantSettingsTable();
    const rows = await prisma.$queryRawUnsafe<
      Array<{ general_config: Partial<GeneralSettings>; smtp_config: Partial<SmtpSettings> }>
    >(
      `SELECT general_config, smtp_config FROM tenant_settings WHERE tenant_id = $1 LIMIT 1`,
      key
    );

    if (rows && rows.length > 0) {
      const rawSmtp = rows[0].smtp_config || {};
      const bundle = await resolveTenantBrandDefaults(
        key,
        { ...DEFAULT_GENERAL_SETTINGS, ...(rows[0].general_config || {}) },
        {
          ...DEFAULT_SMTP_SETTINGS,
          ...rawSmtp,
          password: safeDecryptSmtpPassword(rawSmtp.password),
        }
      );
      settingsMemoryCache.set(key, bundle);
      return bundle;
    }

    const initialBundle = await resolveTenantBrandDefaults(
      key,
      { ...DEFAULT_GENERAL_SETTINGS },
      { ...DEFAULT_SMTP_SETTINGS }
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO tenant_settings (tenant_id, general_config, smtp_config, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, NOW())
       ON CONFLICT (tenant_id) DO NOTHING`,
      key,
      JSON.stringify(initialBundle.general),
      JSON.stringify(initialBundle.smtp)
    );
    settingsMemoryCache.set(key, initialBundle);
    return initialBundle;
  } catch (err) {
    console.warn('getTenantSettings fallback to cache:', err);
    return (
      settingsMemoryCache.get(key) || {
        general: { ...DEFAULT_GENERAL_SETTINGS },
        smtp: { ...DEFAULT_SMTP_SETTINGS },
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
  const persistedSmtp: SmtpSettings = {
    ...current.smtp,
    password: encryptSecret(current.smtp.password),
  };
  const key = tenantId || 'talentos-agency';
  await ensureTenantSettingsTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO tenant_settings (tenant_id, general_config, smtp_config, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET general_config = $2::jsonb, updated_at = NOW()`,
    key,
    JSON.stringify(nextGeneral),
    JSON.stringify(persistedSmtp)
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
  settingsMemoryCache.set(key, { general: nextGeneral, smtp: current.smtp });
  return nextGeneral;
}

export async function saveSmtpSettings(
  tenantId: string,
  partial: Partial<SmtpSettings>
): Promise<SmtpSettings> {
  const current = await getTenantSettings(tenantId);
  const encryption =
    partial.encryption === 'SSL' || partial.encryption === 'NONE' || partial.encryption === 'STARTTLS'
      ? partial.encryption
      : current.smtp.encryption;
  const incomingPassword = partial.password;
  const resolvedPassword =
    incomingPassword === undefined || incomingPassword === MASKED_SECRET_PLACEHOLDER
      ? current.smtp.password
      : incomingPassword;

  const nextSmtp: SmtpSettings = {
    ...current.smtp,
    ...partial,
    password: resolvedPassword,
    port: Number(partial.port ?? current.smtp.port) || (encryption === 'SSL' ? 465 : 587),
    encryption,
    enabled: partial.enabled !== undefined ? Boolean(partial.enabled) : current.smtp.enabled,
  };
  const persistedSmtp: SmtpSettings = {
    ...nextSmtp,
    password: encryptSecret(nextSmtp.password),
  };
  const key = tenantId || 'talentos-agency';
  await ensureTenantSettingsTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO tenant_settings (tenant_id, general_config, smtp_config, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET smtp_config = $3::jsonb, updated_at = NOW()`,
    key,
    JSON.stringify(current.general),
    JSON.stringify(persistedSmtp)
  );
  settingsMemoryCache.set(key, { general: current.general, smtp: nextSmtp });
  return nextSmtp;
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

export const verifySmtpConnection = async (tenantId = 'talentos-agency'): Promise<boolean> => {
  try {
    const { smtp } = await getTenantSettings(tenantId);
    if (!smtp.enabled || !smtp.host || !smtp.username || !smtp.password) {
      console.log('SMTP waiting for user configuration in Email Setup (SMTP).');
      return false;
    }
    const transporter = createDynamicSmtpTransporter(smtp);
    await transporter.verify();
    console.log('User-configured SMTP connection verified successfully.');
    return true;
  } catch (error) {
    console.warn('User-configured SMTP verification failed:', error);
    return false;
  }
};
