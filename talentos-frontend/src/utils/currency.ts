import { useEffect, useState } from 'react';
import { apiClient } from '../config/api.config';
import { setWorkspaceBrand } from './workspaceBrand';

export const CURRENCY_OPTIONS = [
  'USD ($)',
  'CAD ($)',
  'GBP (£)',
  'EUR (€)',
  'INR (₹)',
  'AUD (A$)',
  'SGD (S$)',
] as const;

const STORAGE_KEY = 'talentos_currency';
const DEFAULT_CURRENCY = 'USD ($)';

let currentCurrency: string = (() => {
  try {
    return (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY)) || DEFAULT_CURRENCY;
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
    const general = res.data?.data?.general;
    if (general) {
      setWorkspaceBrand(general);
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

