/**
 * Deterministic money and date formatting for the Church Financial OS design system.
 *
 * - Locale never comes from the browser: money uses the locale of its currency, so the
 *   same amount renders identically for every user of a tenant.
 * - Amounts may be numeric strings (API decimals / MoneyMath output); they are formatted
 *   as exact decimals, never converted to a float first.
 * - Date-only `YYYY-MM-DD` values are calendar dates, never UTC instants, so they cannot
 *   shift to the previous day west of UTC.
 */

export type CfFractionDigits = 0 | 2;
export type CfDateStyle = 'date' | 'datetime' | 'time';

const CURRENCY_LOCALES: Readonly<Record<string, string>> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
};

const DEFAULT_MONEY_LOCALE = 'en-US';
export const CF_DEFAULT_DATE_LOCALE = 'en-US';

const NUMERIC_STRING = /^-?\d+(\.\d+)?$/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

const DATE_STYLE_OPTIONS: Readonly<Record<CfDateStyle, Intl.DateTimeFormatOptions>> = {
  date: { year: 'numeric', month: 'short', day: 'numeric' },
  datetime: { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  time: { hour: 'numeric', minute: '2-digit' },
};

export function cfLocaleForCurrency(currencyCode: string): string {
  return CURRENCY_LOCALES[currencyCode.toUpperCase()] ?? DEFAULT_MONEY_LOCALE;
}

function moneyFormat(currencyCode: string, fractionDigits: CfFractionDigits): Intl.NumberFormat {
  const currency = currencyCode.toUpperCase();
  const key = `${currency}|${fractionDigits}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(cfLocaleForCurrency(currency), {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    numberFormats.set(key, format);
  }
  return format;
}

function normalizeAmount(value: number | string | null | undefined): number | string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const trimmed = value.trim();
  return NUMERIC_STRING.test(trimmed) ? trimmed : null;
}

/**
 * Formats an amount in an explicit currency. Returns '' for missing or non-numeric input
 * so templates can render their own placeholder.
 */
export function cfFormatMoney(
  value: number | string | null | undefined,
  currencyCode: string,
  fractionDigits: CfFractionDigits = 2,
): string {
  const amount = normalizeAmount(value);
  if (amount === null || !currencyCode) {
    return '';
  }
  try {
    // Intl formats numeric strings as exact decimals (ES2023); the lib typing only lists number.
    return moneyFormat(currencyCode, fractionDigits).format(amount as number);
  } catch {
    const plain = new Intl.NumberFormat(DEFAULT_MONEY_LOCALE, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount as number);
    return `${currencyCode.toUpperCase()} ${plain}`;
  }
}

function dateFormat(locale: string, style: CfDateStyle): Intl.DateTimeFormat {
  const key = `${locale}|${style}`;
  let format = dateFormats.get(key);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat(locale, DATE_STYLE_OPTIONS[style]);
    } catch {
      format = new Intl.DateTimeFormat(CF_DEFAULT_DATE_LOCALE, DATE_STYLE_OPTIONS[style]);
    }
    dateFormats.set(key, format);
  }
  return format;
}

/** Parses API date values; `YYYY-MM-DD` becomes local midnight of that calendar day. */
export function cfParseDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const trimmed = value.trim();
  const dateOnly = trimmed.match(DATE_ONLY);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.getMonth() === Number(m) - 1 ? date : null;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function cfFormatDate(
  value: string | Date | null | undefined,
  style: CfDateStyle = 'date',
  locale: string = CF_DEFAULT_DATE_LOCALE,
): string {
  const date = cfParseDate(value);
  return date ? dateFormat(locale, style).format(date) : '';
}
