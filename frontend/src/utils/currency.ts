import { useEffect, useState } from 'react';
import { apiClient } from '../config/api.config';
import { setAiCapabilities, setWorkspaceBrand, setWorkspacePolicies } from './workspaceBrand';

export const CURRENCY_OPTIONS = [
  'USD ($)',
  'CAD ($)',
  'GBP (£)',
  'EUR (€)',
  'INR (₹)',
  'AUD (A$)',
  'SGD (S$)',
] as const;

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

export function extractCurrencySymbol(currencyStr?: string | null): string {
  if (!currencyStr) return '$';
  const match = String(currencyStr).match(/\(([^)]+)\)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  const upper = String(currencyStr).toUpperCase();
  if (upper.includes('GBP')) return '£';
  if (upper.includes('EUR')) return '€';
  if (upper.includes('INR')) return '₹';
  if (upper.includes('AUD')) return 'A$';
  if (upper.includes('SGD')) return 'S$';
  return '$';
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
  if (typeof val === 'number') {
    return `${sym}${val}/hr`;
  }
  const str = String(val).trim();
  if (!str) return '';
  if (/^\d+(?:\.\d+)?$/.test(str)) {
    return `${sym}${str}/hr`;
  }
  return str.replace(/(?:A\$|S\$|[$£€₹])(?=\d)/g, sym);
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

