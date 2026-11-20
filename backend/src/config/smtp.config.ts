import nodemailer from 'nodemailer';
import { prisma } from './prisma.config';

export type FormFieldWidth = 'half' | 'full';

export interface ApplicationFormCustomField {
  key: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'DROPDOWN';
  required: boolean;
  width?: FormFieldWidth;
  options?: string[];
}

export interface ApplicationFormTemplate {
  id: string;
  name: string;
  description: string;
  heading: string;
  subheading: string;
  isDefault: boolean;
  includeCurrentTitle: boolean;
  requireCurrentTitle: boolean;
  includeExpectedRate: boolean;
  requireExpectedRate: boolean;
  includeVendorName: boolean;
  requireVendorName: boolean;
  includeNoticePeriod: boolean;
  requireNoticePeriod: boolean;
  includeLinkedinUrl: boolean;
  requireLinkedinUrl: boolean;
  fieldWidths?: Record<string, FormFieldWidth>;
  customFieldKeys: string[];
  customFields?: ApplicationFormCustomField[];
  updatedAt: string;
}

export const DEFAULT_APPLICATION_FORMS: ApplicationFormTemplate[] = [
  {
    id: 'form-standard-default',
    name: 'Standard Candidate & Partner Form',
    description: 'Balanced application form for both direct candidates and partner staffing vendors.',
    heading: 'Submit Candidate Profile & Resume',
    subheading:
      'Candidates applying directly or partner agencies submitting consultants can attach a resume below.',
    isDefault: true,
    includeCurrentTitle: true,
    requireCurrentTitle: false,
    includeExpectedRate: true,
    requireExpectedRate: false,
    includeVendorName: true,
    requireVendorName: false,
    includeNoticePeriod: true,
    requireNoticePeriod: false,
    includeLinkedinUrl: false,
    requireLinkedinUrl: false,
    customFieldKeys: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'form-direct-candidate',
    name: 'Direct Candidate Quick Apply',
    description: 'Streamlined candidate-only form (hides vendor agency & C2C fields).',
    heading: 'Apply Directly for This Position',
    subheading:
      'Upload your resume and share your contact information, work authorization, and availability.',
    isDefault: false,
    includeCurrentTitle: true,
    requireCurrentTitle: true,
    includeExpectedRate: true,
    requireExpectedRate: false,
    includeVendorName: false,
    requireVendorName: false,
    includeNoticePeriod: true,
    requireNoticePeriod: true,
    includeLinkedinUrl: true,
    requireLinkedinUrl: false,
    customFieldKeys: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'form-c2c-partner',
    name: 'Partner / C2C Vendor Submittal',
    description: 'Dedicated submittal form for partner agencies with required vendor & rate fields.',
    heading: 'Partner Vendor Consultant Submittal',
    subheading:
      'Submit your bench consultant with C2C hourly rate, work authorization, availability, and resume.',
    isDefault: false,
    includeCurrentTitle: true,
    requireCurrentTitle: true,
    includeExpectedRate: true,
    requireExpectedRate: true,
    includeVendorName: true,
    requireVendorName: true,
    includeNoticePeriod: true,
    requireNoticePeriod: true,
    includeLinkedinUrl: false,
    requireLinkedinUrl: false,
    customFieldKeys: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

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
  applicationForms?: ApplicationFormTemplate[];
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
      ai_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS ai_config JSONB NOT NULL DEFAULT '{}'::jsonb
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

export function normalizeApplicationForms(
  rawForms?: ApplicationFormTemplate[] | null
): ApplicationFormTemplate[] {
  const source =
    Array.isArray(rawForms) && rawForms.length > 0
      ? rawForms
      : DEFAULT_APPLICATION_FORMS;

  const normalized: ApplicationFormTemplate[] = source.map((item, idx) => ({
    id: String(item.id || `form-${idx + 1}`).trim(),
    name: String(item.name || 'Application Form').trim(),
    description: String(item.description || '').trim(),
    heading: String(item.heading || 'Submit Candidate Profile & Resume').trim(),
    subheading: String(
      item.subheading ||
        'Candidates applying directly or partner agencies submitting consultants can attach a resume below.'
    ).trim(),
    isDefault: Boolean(item.isDefault),
    includeCurrentTitle: item.includeCurrentTitle !== false,
    requireCurrentTitle: Boolean(item.includeCurrentTitle !== false && item.requireCurrentTitle),
    includeExpectedRate: item.includeExpectedRate !== false,
    requireExpectedRate: Boolean(item.includeExpectedRate !== false && item.requireExpectedRate),
    includeVendorName: Boolean(item.includeVendorName),
    requireVendorName: Boolean(item.includeVendorName && item.requireVendorName),
    includeNoticePeriod: Boolean(item.includeNoticePeriod),
    requireNoticePeriod: Boolean(item.includeNoticePeriod && item.requireNoticePeriod),
    includeLinkedinUrl: Boolean(item.includeLinkedinUrl),
    requireLinkedinUrl: Boolean(item.includeLinkedinUrl && item.requireLinkedinUrl),
    fieldWidths: (() => {
      const widths: Record<string, FormFieldWidth> = {};
      if (item.fieldWidths && typeof item.fieldWidths === 'object') {
        for (const [k, v] of Object.entries(item.fieldWidths)) {
          const cleanKey = String(k || '').trim();
          if (!cleanKey) continue;
          widths[cleanKey] = String(v).toLowerCase() === 'full' ? 'full' : 'half';
        }
      }
      if (!widths.vendorName) widths.vendorName = 'full';
      return widths;
    })(),
    customFieldKeys: Array.isArray(item.customFieldKeys)
      ? item.customFieldKeys.map((k) => String(k).trim()).filter(Boolean)
      : [],
    customFields: Array.isArray(item.customFields)
      ? item.customFields
          .map((cf: any, cfIdx: number) => {
            const name = String(cf?.name || cf?.label || '').trim();
            if (!name) return null;
            const rawKey =
              String(cf?.key || '')
                .trim()
                .replace(/[^a-zA-Z0-9_]/g, '_') ||
              `cf_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${cfIdx + 1}`;
            const rawType = String(cf?.type || 'TEXT').toUpperCase();
            const type: ApplicationFormCustomField['type'] =
              rawType === 'NUMBER' ||
              rawType === 'DATE' ||
              rawType === 'BOOLEAN' ||
              rawType === 'DROPDOWN'
                ? rawType
                : 'TEXT';
            const width: FormFieldWidth =
              String(cf?.width || '').toLowerCase() === 'full' ? 'full' : 'half';
            const normalizedField: ApplicationFormCustomField = {
              key: rawKey,
              name,
              type,
              required: Boolean(cf?.required),
              width,
              ...(Array.isArray(cf?.options)
                ? { options: cf.options.map((o: any) => String(o).trim()).filter(Boolean) }
                : {}),
            };
            return normalizedField;
          })
          .filter((cf): cf is ApplicationFormCustomField => Boolean(cf))
      : [],
    updatedAt: item.updatedAt || new Date().toISOString(),
  }));

  const defaultIndex = normalized.findIndex((f) => f.isDefault);
  const chosenDefaultIdx = defaultIndex >= 0 ? defaultIndex : 0;
  return normalized.map((f, idx) => ({
    ...f,
    isDefault: idx === chosenDefaultIdx,
  }));
}

export async function getApplicationForms(
  tenantId = 'squadpipe-agency'
): Promise<ApplicationFormTemplate[]> {
  const { general } = await getTenantSettings(tenantId);
  return normalizeApplicationForms(general.applicationForms);
}

export async function saveApplicationForms(
  tenantId: string,
  forms: ApplicationFormTemplate[]
): Promise<ApplicationFormTemplate[]> {
  const normalized = normalizeApplicationForms(forms);
  await saveGeneralSettings(tenantId, { applicationForms: normalized });
  return normalized;
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
