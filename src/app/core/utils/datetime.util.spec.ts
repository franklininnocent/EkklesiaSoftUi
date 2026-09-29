import {
  combineDateTime,
  dateTimeToMs,
  formatDateTimeDisplay,
  minDateFromDateTime,
  minTimeForDate,
  splitDateTime,
} from './datetime.util';

describe('datetime.util', () => {
  describe('splitDateTime', () => {
    it('splits datetime-local values', () => {
      expect(splitDateTime('2026-09-10T10:00')).toEqual({
        date: '2026-09-10',
        time: '10:00',
      });
    });

    it('splits ISO values with seconds', () => {
      expect(splitDateTime('2026-09-10T10:00:00Z')).toEqual({
        date: '2026-09-10',
        time: '10:00',
      });
    });

    it('returns empty parts for blank values', () => {
      expect(splitDateTime('')).toEqual({ date: '', time: '' });
      expect(splitDateTime(null)).toEqual({ date: '', time: '' });
    });
  });

  describe('combineDateTime', () => {
    it('combines date and time', () => {
      expect(combineDateTime('2026-09-10', '10:00')).toBe('2026-09-10T10:00');
    });

    it('returns empty when incomplete', () => {
      expect(combineDateTime('2026-09-10', '')).toBe('');
      expect(combineDateTime('', '10:00')).toBe('');
    });
  });

  describe('dateTimeToMs', () => {
    it('parses combined values', () => {
      const ms = dateTimeToMs('2026-09-10T10:00');
      expect(ms).toBe(new Date('2026-09-10T10:00').getTime());
    });
  });

  describe('minDateFromDateTime', () => {
    it('returns the date portion', () => {
      expect(minDateFromDateTime('2026-09-10T10:00')).toBe('2026-09-10');
    });
  });

  describe('minTimeForDate', () => {
    it('returns min time when dates match', () => {
      expect(minTimeForDate('2026-09-10', '2026-09-10T10:00')).toBe('10:00');
    });

    it('returns null when dates differ', () => {
      expect(minTimeForDate('2026-09-11', '2026-09-10T10:00')).toBeNull();
    });
  });

  describe('formatDateTimeDisplay', () => {
    it('formats a readable label', () => {
      expect(formatDateTimeDisplay('2026-09-10T10:00')).toContain('2026');
    });
  });
});
