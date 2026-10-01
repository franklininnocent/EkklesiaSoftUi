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
export type CfDateStyle = 'date' | 'datetime' | 'datetimeDayFirst' | 'time' | 'weekdayDate' | 'monthYear';

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
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/;

const numberFormats = new Map<string, Intl.NumberFormat>();
const ENGLISH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const ENGLISH_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

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

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** `9:59 AM` — 12-hour clock, no seconds. Uses the Date's local wall time. */
export function cfFormatClock(date: Date): string {
  let hour = date.getHours();
  const minute = pad2(date.getMinutes());
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) {
    hour = 12;
  }
  return `${hour}:${minute} ${period}`;
}

/** `30 Sep 2026` — English three-letter month, unpadded day. */
export function cfFormatDateOnly(date: Date): string {
  return `${date.getDate()} ${ENGLISH_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** `30 Sep 2026, 9:59 AM` */
export function cfFormatDateTime(date: Date): string {
  return `${cfFormatDateOnly(date)}, ${cfFormatClock(date)}`;
}

/** `30 Sep` for same-year ranges and celebration chips. */
export function cfFormatDayMonth(date: Date): string {
  return `${date.getDate()} ${ENGLISH_MONTHS[date.getMonth()]}`;
}
export function cfFormatMonthYear(date: Date): string {
  return `${ENGLISH_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function cfEnglishWeekdayLong(date: Date): string {
  return ENGLISH_WEEKDAYS[date.getDay()];
}

export function cfEnglishWeekdayShort(date: Date): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()] ?? '';
}

export function cfEnglishMonthShort(date: Date): string {
  return ENGLISH_MONTHS[date.getMonth()];
}

/** `Wednesday, 30 Sep 2026` */
export function cfFormatWeekdayDate(date: Date): string {
  return `${ENGLISH_WEEKDAYS[date.getDay()]}, ${cfFormatDateOnly(date)}`;
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
    const date = new Date(2000, Number(m) - 1, Number(d));
    date.setFullYear(Number(y));
    return date.getMonth() === Number(m) - 1 ? date : null;
  }
  // SQL-style `YYYY-MM-DD HH:mm:ss` and microsecond fractions are not portable Date.parse input.
  const dateTime = trimmed.match(DATE_TIME);
  const iso = dateTime
    ? `${dateTime[1]}T${dateTime[2]}${dateTime[3] ? `.${dateTime[3].slice(0, 3).padEnd(3, '0')}` : ''}${(dateTime[4] ?? '').replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')}`
    : trimmed;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * User-facing date display. Month names are always English `Jan`–`Dec` (`Sep`, never `Sept`).
 * The `locale` argument is ignored so tenants never see browser-locale date order.
 * Timezone conversion is not applied: instants use the Date's local wall clock.
 */
export function cfFormatDate(
  value: string | Date | null | undefined,
  style: CfDateStyle = 'date',
  locale: string = CF_DEFAULT_DATE_LOCALE,
): string {
  void locale;
  const date = cfParseDate(value);
  if (!date) {
    return '';
  }
  switch (style) {
    case 'datetime':
    case 'datetimeDayFirst':
      return cfFormatDateTime(date);
    case 'time':
      return cfFormatClock(date);
    case 'weekdayDate':
      return cfFormatWeekdayDate(date);
    case 'monthYear':
      return cfFormatMonthYear(date);
    case 'date':
    default:
      return cfFormatDateOnly(date);
  }
}
