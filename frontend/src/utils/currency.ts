import { useEffect, useState } from 'react';
import type { CustomSelectOption } from '../components/shared/CustomSelect';
import { apiClient } from '../config/api.config';
import { setAiCapabilities, setWorkspaceBrand, setWorkspacePolicies } from './workspaceBrand';

export interface CurrencyCatalogEntry {
  code: string;
  symbol: string;
  value: string;
  name: string;
  keywords: string;
}

export const CURRENCY_CATALOG: readonly CurrencyCatalogEntry[] = [
  // Core Staffing & Major Reserve Currencies
  { code: 'USD', symbol: '$', value: 'USD ($)', name: 'US Dollar', keywords: 'united states america us global' },
  { code: 'EUR', symbol: '€', value: 'EUR (€)', name: 'Euro', keywords: 'europe eu germany france netherlands ireland spain italy' },
  { code: 'GBP', symbol: '£', value: 'GBP (£)', name: 'British Pound Sterling', keywords: 'uk united kingdom england britain london' },
  { code: 'CAD', symbol: '$', value: 'CAD ($)', name: 'Canadian Dollar', keywords: 'canada toronto vancouver montreal' },
  { code: 'AUD', symbol: 'A$', value: 'AUD (A$)', name: 'Australian Dollar', keywords: 'australia sydney melbourne' },
  { code: 'INR', symbol: '₹', value: 'INR (₹)', name: 'Indian Rupee', keywords: 'india bengaluru hyderabad mumbai pune delhi' },
  { code: 'SGD', symbol: 'S$', value: 'SGD (S$)', name: 'Singapore Dollar', keywords: 'singapore apac' },
  { code: 'CHF', symbol: 'CHF', value: 'CHF (CHF)', name: 'Swiss Franc', keywords: 'switzerland zurich geneva' },
  { code: 'JPY', symbol: '¥', value: 'JPY (¥)', name: 'Japanese Yen', keywords: 'japan tokyo' },
  { code: 'NZD', symbol: 'NZ$', value: 'NZD (NZ$)', name: 'New Zealand Dollar', keywords: 'new zealand auckland wellington' },
  // Middle East
  { code: 'AED', symbol: 'AED', value: 'AED (AED)', name: 'UAE Dirham', keywords: 'united arab emirates dubai abu dhabi gulf' },
  { code: 'SAR', symbol: 'SAR', value: 'SAR (SAR)', name: 'Saudi Riyal', keywords: 'saudi arabia riyadh ksa' },
  { code: 'QAR', symbol: 'QAR', value: 'QAR (QAR)', name: 'Qatari Riyal', keywords: 'qatar doha' },
  { code: 'KWD', symbol: 'KWD', value: 'KWD (KWD)', name: 'Kuwaiti Dinar', keywords: 'kuwait' },
  { code: 'BHD', symbol: 'BHD', value: 'BHD (BHD)', name: 'Bahraini Dinar', keywords: 'bahrain manama' },
  { code: 'OMR', symbol: 'OMR', value: 'OMR (OMR)', name: 'Omani Rial', keywords: 'oman muscat' },
  { code: 'ILS', symbol: '₪', value: 'ILS (₪)', name: 'Israeli New Shekel', keywords: 'israel tel aviv jerusalem' },
  { code: 'TRY', symbol: '₺', value: 'TRY (₺)', name: 'Turkish Lira', keywords: 'turkey istanbul ankara' },
  // Europe (Non-Eurozone)
  { code: 'SEK', symbol: 'kr', value: 'SEK (kr)', name: 'Swedish Krona', keywords: 'sweden stockholm nordics' },
  { code: 'NOK', symbol: 'kr', value: 'NOK (kr)', name: 'Norwegian Krone', keywords: 'norway oslo nordics' },
  { code: 'DKK', symbol: 'kr', value: 'DKK (kr)', name: 'Danish Krone', keywords: 'denmark copenhagen nordics' },
  { code: 'PLN', symbol: 'zł', value: 'PLN (zł)', name: 'Polish Zloty', keywords: 'poland warsaw krakow' },
  { code: 'CZK', symbol: 'Kč', value: 'CZK (Kč)', name: 'Czech Koruna', keywords: 'czechia prague' },
  { code: 'HUF', symbol: 'Ft', value: 'HUF (Ft)', name: 'Hungarian Forint', keywords: 'hungary budapest' },
  { code: 'RON', symbol: 'lei', value: 'RON (lei)', name: 'Romanian Leu', keywords: 'romania bucharest' },
  { code: 'BGN', symbol: 'лв', value: 'BGN (лв)', name: 'Bulgarian Lev', keywords: 'bulgaria sofia' },
  { code: 'ISK', symbol: 'kr', value: 'ISK (kr)', name: 'Icelandic Króna', keywords: 'iceland reykjavik' },
  { code: 'UAH', symbol: '₴', value: 'UAH (₴)', name: 'Ukrainian Hryvnia', keywords: 'ukraine kyiv' },
  // Asia-Pacific
  { code: 'CNY', symbol: '¥', value: 'CNY (¥)', name: 'Chinese Yuan Renminbi', keywords: 'china beijing shanghai rmb' },
  { code: 'HKD', symbol: 'HK$', value: 'HKD (HK$)', name: 'Hong Kong Dollar', keywords: 'hong kong' },
  { code: 'TWD', symbol: 'NT$', value: 'TWD (NT$)', name: 'New Taiwan Dollar', keywords: 'taiwan taipei' },
  { code: 'KRW', symbol: '₩', value: 'KRW (₩)', name: 'South Korean Won', keywords: 'korea seoul' },
  { code: 'MYR', symbol: 'RM', value: 'MYR (RM)', name: 'Malaysian Ringgit', keywords: 'malaysia kuala lumpur' },
  { code: 'THB', symbol: '฿', value: 'THB (฿)', name: 'Thai Baht', keywords: 'thailand bangkok' },
  { code: 'IDR', symbol: 'Rp', value: 'IDR (Rp)', name: 'Indonesian Rupiah', keywords: 'indonesia jakarta' },
  { code: 'PHP', symbol: '₱', value: 'PHP (₱)', name: 'Philippine Peso', keywords: 'philippines manila cebu' },
  { code: 'VND', symbol: '₫', value: 'VND (₫)', name: 'Vietnamese Dong', keywords: 'vietnam hanoi ho chi minh' },
  { code: 'PKR', symbol: '₨', value: 'PKR (₨)', name: 'Pakistani Rupee', keywords: 'pakistan karachi lahore' },
  { code: 'BDT', symbol: '৳', value: 'BDT (৳)', name: 'Bangladeshi Taka', keywords: 'bangladesh dhaka' },
  { code: 'LKR', symbol: 'Rs', value: 'LKR (Rs)', name: 'Sri Lankan Rupee', keywords: 'sri lanka colombo' },
  // Latin America & Caribbean
  { code: 'MXN', symbol: 'MX$', value: 'MXN (MX$)', name: 'Mexican Peso', keywords: 'mexico latam' },
  { code: 'BRL', symbol: 'R$', value: 'BRL (R$)', name: 'Brazilian Real', keywords: 'brazil sao paulo latam' },
  { code: 'ARS', symbol: '$', value: 'ARS ($)', name: 'Argentine Peso', keywords: 'argentina buenos aires latam' },
  { code: 'CLP', symbol: '$', value: 'CLP ($)', name: 'Chilean Peso', keywords: 'chile santiago latam' },
  { code: 'COP', symbol: '$', value: 'COP ($)', name: 'Colombian Peso', keywords: 'colombia bogota latam' },
  { code: 'PEN', symbol: 'S/', value: 'PEN (S/)', name: 'Peruvian Sol', keywords: 'peru lima latam' },
  // Africa
  { code: 'ZAR', symbol: 'R', value: 'ZAR (R)', name: 'South African Rand', keywords: 'south africa johannesburg cape town' },
  { code: 'NGN', symbol: '₦', value: 'NGN (₦)', name: 'Nigerian Naira', keywords: 'nigeria lagos' },
  { code: 'KES', symbol: 'KSh', value: 'KES (KSh)', name: 'Kenyan Shilling', keywords: 'kenya nairobi' },
  { code: 'EGP', symbol: 'E£', value: 'EGP (E£)', name: 'Egyptian Pound', keywords: 'egypt cairo' },
  { code: 'MAD', symbol: 'MAD', value: 'MAD (MAD)', name: 'Moroccan Dirham', keywords: 'morocco casablanca' },
] as const;

export const CURRENCY_OPTIONS = CURRENCY_CATALOG.map((c) => c.value);

const CURRENCY_BY_VALUE = new Map<string, CurrencyCatalogEntry>(
  CURRENCY_CATALOG.map((entry) => [entry.value, entry])
);

const CURRENCY_BY_CODE = new Map<string, CurrencyCatalogEntry>(
  CURRENCY_CATALOG.map((entry) => [entry.code, entry])
);

export const CURRENCY_SELECT_OPTIONS: CustomSelectOption[] = CURRENCY_CATALOG.map((entry) => ({
  value: entry.value,
  label: `${entry.code} (${entry.symbol}) · ${entry.name}`,
  description: entry.keywords,
  keywords: `${entry.code} ${entry.symbol} ${entry.name} ${entry.keywords}`,
}));

/**
 * Returns searchable currency options, preserving any custom/legacy saved value if outside the standard catalog.
 */
export function getCurrencySelectOptions(currentValue?: string | null): CustomSelectOption[] {
  const trimmed = String(currentValue ?? '').trim();
  if (trimmed && !CURRENCY_BY_VALUE.has(trimmed)) {
    return [
      {
        value: trimmed,
        label: trimmed,
        description: 'Previously saved currency',
      },
      ...CURRENCY_SELECT_OPTIONS,
    ];
  }
  return CURRENCY_SELECT_OPTIONS;
}

const STORAGE_KEY = 'squadpipe_currency';
const LEGACY_STORAGE_KEY = 'talentos_currency';
const DEFAULT_CURRENCY = 'USD ($)';

let currentCurrency: string = (() => {
  try {
    if (typeof window === 'undefined') return DEFAULT_CURRENCY;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      window.localStorage.setItem(STORAGE_KEY, legacy);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return legacy;
    }
    return DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
})();

const listeners = new Set<(currency: string) => void>();

// Separate non-alphabetic currency symbols from alphabetic codes so plain English words (e.g. "HR 100") never false-match.
const SYMBOL_TOKENS = Array.from(
  new Set(
    CURRENCY_CATALOG.map((c) => c.symbol)
      .filter((s) => !/^[A-Za-z]+$/.test(s))
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  )
).sort((a, b) => b.length - a.length);

const WORD_CODE_TOKENS = Array.from(
  new Set(
    CURRENCY_CATALOG.flatMap((c) => [c.symbol, c.code])
      .filter((s) => /^[A-Za-z]+$/.test(s))
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  )
).sort((a, b) => b.length - a.length);

const CURRENCY_PREFIX_TEST_REGEX = new RegExp(
  `(?:(?:${SYMBOL_TOKENS.join('|')})|(?:^|[^A-Za-z])(?:${WORD_CODE_TOKENS.join('|')}))(?=\\s*\\d)`
);

const CURRENCY_PREFIX_REPLACE_REGEX = new RegExp(
  `(^|[^A-Za-z])(?:${WORD_CODE_TOKENS.join('|')})\\s*(?=\\d)|(?:${SYMBOL_TOKENS.join('|')})\\s*(?=\\d)`,
  'g'
);

export function hasCurrencySymbol(val?: string | null): boolean {
  if (!val) return false;
  return CURRENCY_PREFIX_TEST_REGEX.test(val);
}

export function extractCurrencySymbol(currencyStr?: string | null): string {
  if (!currencyStr) return '$';
  const match = String(currencyStr).match(/\(([^)]+)\)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  const upper = String(currencyStr).toUpperCase().trim();
  const direct = CURRENCY_BY_CODE.get(upper);
  if (direct) return direct.symbol;

  for (const entry of CURRENCY_CATALOG) {
    if (upper.includes(entry.code)) {
      return entry.symbol;
    }
  }
  return '$';
}

export function getCurrencyMeta(currencyStr?: string | null): {
  code: string;
  symbol: string;
  name: string;
  value: string;
} {
  const trimmed = String(currencyStr ?? '').trim() || DEFAULT_CURRENCY;
  const byVal = CURRENCY_BY_VALUE.get(trimmed);
  if (byVal) {
    return {
      code: byVal.code,
      symbol: byVal.symbol,
      name: byVal.name,
      value: byVal.value,
    };
  }
  const codeMatch = trimmed.toUpperCase().match(/\b([A-Z]{3})\b/);
  if (codeMatch && CURRENCY_BY_CODE.has(codeMatch[1])) {
    const entry = CURRENCY_BY_CODE.get(codeMatch[1])!;
    return {
      code: entry.code,
      symbol: entry.symbol,
      name: entry.name,
      value: trimmed,
    };
  }
  return {
    code: codeMatch?.[1] || 'USD',
    symbol: extractCurrencySymbol(trimmed),
    name: trimmed,
    value: trimmed,
  };
}

export function getWorkspaceCurrency(): string {
  return currentCurrency;
}

export function getCurrencySymbol(): string {
  return extractCurrencySymbol(currentCurrency);
}

export function setWorkspaceCurrency(currency: string): void {
  const next = (currency || '').trim() || DEFAULT_CURRENCY;
  if (next === currentCurrency) return;
  currentCurrency = next;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  } catch {
    // Ignore storage quota or SSR errors
  }
  listeners.forEach((listener) => listener(next));
}

export async function initWorkspaceCurrency(): Promise<string> {
  try {
    const res = await apiClient.get('/settings');
    const data = res.data?.data;
    if (data?.ai !== undefined) {
      setAiCapabilities(data.ai);
    }
    const general = data?.general;
    if (general) {
      setWorkspaceBrand(general);
      setWorkspacePolicies(general);
    }
    const currency = general?.currency;
    if (currency) {
      setWorkspaceCurrency(currency);
      return currency;
    }
  } catch {
    // Keep existing or default currency if settings endpoint is unavailable
  }
  return currentCurrency;
}

/**
 * Extracts the numeric hourly rate from strings such as "$115/hr (C2C)",
 * "$90/hr (W2)", or "$100/hr (1099)" without concatenating contract-type digits.
 */
export function parseRateNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : fallback;
  }
  const cleaned = String(val ?? '')
    .replace(/(?:W-?2|C-?2-?C|1099)/gi, ' ')
    .replace(/,/g, '')
    .trim();
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return fallback;
  const parsed = parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Infers placement contract type from a formatted candidate rate string.
 */
export function inferPlacementTypeFromRate(
  rate?: string | null
): 'W2 Hourly' | 'C2C Subcontractor' | '1099' | null {
  const upper = String(rate ?? '').toUpperCase();
  if (/\bC-?2-?C\b/.test(upper)) return 'C2C Subcontractor';
  if (/\b1099\b/.test(upper)) return '1099';
  if (/\bW-?2\b/.test(upper)) return 'W2 Hourly';
  return null;
}

export function formatRateDisplay(
  val: string | number | undefined | null,
  sym: string = getCurrencySymbol()
): string {
  if (val === undefined || val === null || val === '') return '';
  const prefix = /^[A-Z]{2,}$/.test(sym) ? `${sym} ` : sym;
  if (typeof val === 'number') {
    return `${prefix}${val}/hr`;
  }
  const str = String(val).trim();
  if (!str) return '';
  if (/^\d+(?:\.\d+)?$/.test(str)) {
    return `${prefix}${str}/hr`;
  }
  return str.replace(CURRENCY_PREFIX_REPLACE_REGEX, (_match, leading = '') => `${leading}${prefix}`);
}

export function useCurrency() {
  const [currency, setCurrencyState] = useState<string>(currentCurrency);

  useEffect(() => {
    const listener = (next: string) => setCurrencyState(next);
    listeners.add(listener);
    if (currentCurrency !== currency) {
      setCurrencyState(currentCurrency);
    }
    return () => {
      listeners.delete(listener);
    };
  }, [currency]);

  const symbol = extractCurrencySymbol(currency);
  const formatRate = (val: string | number | undefined | null) => formatRateDisplay(val, symbol);

  return {
    currency,
    symbol,
    setCurrency: setWorkspaceCurrency,
    formatRate,
  };
}
