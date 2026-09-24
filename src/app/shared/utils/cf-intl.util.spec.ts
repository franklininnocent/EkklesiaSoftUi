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
      expect(cfFormatDate('2026-09-25')).toBe('Sep 25, 2026');
      expect(cfFormatDate('2026-01-01')).toBe('Jan 1, 2026');
    });

    it('rejects impossible calendar dates', () => {
      expect(cfParseDate('2026-02-30')).toBeNull();
      expect(cfFormatDate('2026-02-30')).toBe('');
    });

    it('formats instants in the viewer timezone', () => {
      const instant = '2026-09-25T03:30:00Z';
      const expected = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        .format(new Date(instant));
      expect(cfFormatDate(instant, 'date')).toBe(expected);
      expect(cfFormatDate(instant, 'time')).toMatch(/^\d{1,2}:\d{2}\s[AP]M$/);
    });

    it('accepts Date objects and returns empty for missing or invalid input', () => {
      expect(cfFormatDate(new Date(2026, 0, 5))).toBe('Jan 5, 2026');
      expect(cfFormatDate(null)).toBe('');
      expect(cfFormatDate('')).toBe('');
      expect(cfFormatDate('not a date')).toBe('');
      expect(cfFormatDate(new Date('invalid'))).toBe('');
    });

    it('falls back to the default locale for an invalid locale tag', () => {
      expect(cfFormatDate('2026-09-25', 'date', 'not_a_locale!')).toBe('Sep 25, 2026');
    });

    it('honours an explicit locale', () => {
      expect(cfFormatDate('2026-09-25', 'date', 'en-IN')).toBe('25 Sept 2026');
    });
  });
});
