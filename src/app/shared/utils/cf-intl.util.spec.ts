import { cfFormatDate, cfFormatMoney, cfLocaleForCurrency, cfParseDate } from './cf-intl.util';
describe('cf-intl.util', () => {
  describe('cfFormatMoney', () => {
    it('formats INR with Indian grouping and two decimals', () => {
      expect(cfFormatMoney(1234567.5, 'INR')).toBe('₹12,34,567.50');
    });

    it('formats USD with whole units when asked for 0 fraction digits', () => {
      expect(cfFormatMoney(1234567.5, 'USD', 0)).toBe('$1,234,568');
    });

    it('formats numeric strings as exact decimals', () => {
      expect(cfFormatMoney('1234567.005', 'INR')).toBe('₹12,34,567.01');
      expect(cfFormatMoney('0.1', 'USD')).toBe('$0.10');
    });

    it('formats negative amounts', () => {
      expect(cfFormatMoney('-250', 'USD')).toBe('-$250.00');
    });

    it('does not depend on currency code casing', () => {
      expect(cfFormatMoney(10, 'inr')).toBe(cfFormatMoney(10, 'INR'));
    });

    it('returns empty for missing or non-numeric amounts', () => {
      expect(cfFormatMoney(null, 'INR')).toBe('');
      expect(cfFormatMoney(undefined, 'INR')).toBe('');
      expect(cfFormatMoney('', 'INR')).toBe('');
      expect(cfFormatMoney('12abc', 'INR')).toBe('');
      expect(cfFormatMoney(Number.NaN, 'INR')).toBe('');
      expect(cfFormatMoney(Number.POSITIVE_INFINITY, 'INR')).toBe('');
    });

    it('returns empty without a currency code', () => {
      expect(cfFormatMoney(10, '')).toBe('');
    });

    it('falls back to code-prefixed plain number for an invalid currency code', () => {
      expect(cfFormatMoney(1234, 'NOT-A-CODE')).toBe('NOT-A-CODE 1,234.00');
    });

    it('maps currencies to deterministic locales', () => {
      expect(cfLocaleForCurrency('INR')).toBe('en-IN');
      expect(cfLocaleForCurrency('usd')).toBe('en-US');
      expect(cfLocaleForCurrency('JPY')).toBe('en-US');
    });
  });

  describe('dates', () => {
    it('keeps date-only values on their calendar day in any timezone', () => {
      const parsed = cfParseDate('2026-09-25');
      expect([parsed?.getFullYear(), parsed?.getMonth(), parsed?.getDate()]).toEqual([2026, 8, 25]);
      expect(cfFormatDate('2026-09-25')).toBe('25 Sep 2026');
      expect(cfFormatDate('2026-01-01')).toBe('1 Jan 2026');
    });

    it('rejects impossible calendar dates', () => {
      expect(cfParseDate('2026-02-30')).toBeNull();
      expect(cfFormatDate('2026-02-30')).toBe('');
    });

    it('formats instants using local wall time without changing the instant', () => {
      const instant = '2026-09-30 09:59:00';
      expect(cfFormatDate(instant, 'date')).toBe('30 Sep 2026');
      expect(cfFormatDate(instant, 'datetime')).toBe('30 Sep 2026, 9:59 AM');
      expect(cfFormatDate(instant, 'time')).toBe('9:59 AM');
    });

    it('parses Laravel/SQL timestamps and microsecond fractions', () => {
      const expected = new Date(2026, 8, 25, 10, 15, 0).getTime();
      expect(cfParseDate('2026-09-25 10:15:00')?.getTime()).toBe(expected);
      expect(cfParseDate('2026-09-25 10:15')?.getTime()).toBe(expected);
      expect(cfParseDate('2026-09-25T04:30:00.123456Z')?.getTime()).toBe(Date.UTC(2026, 8, 25, 4, 30, 0, 123));
      expect(cfParseDate('2026-09-25 10:00:00+0530')?.getTime()).toBe(Date.UTC(2026, 8, 25, 4, 30));
      expect(cfParseDate('2026-09-25 25:00:00')).toBeNull();
    });

    it('keeps years below 100 and leap days on their calendar day', () => {
      expect(cfParseDate('0099-01-01')?.getFullYear()).toBe(99);
      expect(cfParseDate('2024-02-29')?.getDate()).toBe(29);
      expect(cfParseDate('2026-02-29')).toBeNull();
    });

    it('accepts Date objects and returns empty for missing or invalid input', () => {
      expect(cfFormatDate(new Date(2026, 0, 5))).toBe('5 Jan 2026');
      expect(cfFormatDate(null)).toBe('');
      expect(cfFormatDate('')).toBe('');
      expect(cfFormatDate('not a date')).toBe('');
      expect(cfFormatDate(new Date('invalid'))).toBe('');
    });

    it('does not use locale for month names or date order', () => {
      expect(cfFormatDate('2026-09-25', 'date', 'not_a_locale!')).toBe('25 Sep 2026');
      expect(cfFormatDate('2026-09-25', 'date', 'en-IN')).toBe('25 Sep 2026');
    });

    it('aliases datetimeDayFirst to the standard datetime format', () => {
      expect(cfFormatDate('2026-09-30 09:59:00', 'datetimeDayFirst')).toBe('30 Sep 2026, 9:59 AM');
      expect(cfFormatDate('2026-09-30 21:59:00', 'datetime')).toBe('30 Sep 2026, 9:59 PM');
    });

    it('formats weekday and month-year labels from the same source of truth', () => {
      expect(cfFormatDate('2026-09-30', 'weekdayDate')).toBe('Wednesday, 30 Sep 2026');
      expect(cfFormatDate('2026-09-30', 'monthYear')).toBe('Sep 2026');
    });
  });
});
