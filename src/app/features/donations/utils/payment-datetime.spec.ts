import { formatPaymentDateTime } from './payment-datetime';

describe('formatPaymentDateTime', () => {
  it('formats a local datetime without timezone', () => {
    expect(formatPaymentDateTime('2026-09-24T16:00:00')).toBe('24 Sep 2026, 04:00 PM');
  });

  it('formats another local datetime', () => {
    expect(formatPaymentDateTime('2026-09-23T09:05:00')).toBe('23 Sep 2026, 09:05 AM');
  });

  it('formats date-only values without inventing a clock', () => {
    expect(formatPaymentDateTime('2026-09-22')).toBe('22 Sep 2026');
  });

  it('returns an em dash for blank or invalid values', () => {
    expect(formatPaymentDateTime('')).toBe('—');
    expect(formatPaymentDateTime('not-a-date')).toBe('—');
  });

  it('formats UTC instants in local time', () => {
    const value = '2026-09-24T10:30:00.000000Z';
    const parsed = new Date(value);
    const expected = formatPaymentDateTime(
      `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}T${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}:00`
    );

    expect(formatPaymentDateTime(value)).toBe(expected);
  });
});
