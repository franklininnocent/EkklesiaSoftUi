import { toDateInputValue } from './to-date-input-value';

describe('toDateInputValue', () => {
  it('returns empty string for nullish values', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue(undefined)).toBe('');
    expect(toDateInputValue('')).toBe('');
  });

  it('strips ISO datetime to YYYY-MM-DD', () => {
    expect(toDateInputValue('2026-01-01T00:00:00.000000Z')).toBe('2026-01-01');
  });

  it('returns date-only strings unchanged', () => {
    expect(toDateInputValue('2026-12-31')).toBe('2026-12-31');
  });
});
