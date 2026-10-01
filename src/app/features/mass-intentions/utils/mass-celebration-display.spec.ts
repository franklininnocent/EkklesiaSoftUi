import { formatMassCelebrationTime, formatMassDayTime } from './mass-celebration-display';

describe('formatMassDayTime', () => {
  it('orders day, date, then time with AM/PM', () => {
    expect(formatMassDayTime('2026-10-04', '06:00:00')).toBe('Sunday, 4 Oct 2026, 6:00 AM');
  });

  it('orders day then date when time is omitted', () => {
    expect(formatMassDayTime('2026-10-04', null)).toBe('Sunday, 4 Oct 2026');
  });
});

describe('formatMassCelebrationTime', () => {
  it('returns 12-hour time with AM/PM', () => {
    expect(formatMassCelebrationTime('06:00:00')).toMatch(/6:00\s*AM/i);
    expect(formatMassCelebrationTime('18:30:00')).toMatch(/6:30\s*PM/i);
  });
});
