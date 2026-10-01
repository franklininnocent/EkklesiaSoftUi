import {
  addDaysIso,
  massCalendarMonthBounds,
  massWeekBoundsContaining,
  massWeekDayDates,
  shiftCalendarMonth,
  shiftMassWeek,
} from './mass-week.util';

describe('mass-week.util', () => {
  it('bounds Sunday–Saturday for a Wednesday anchor', () => {
    const bounds = massWeekBoundsContaining(new Date(2026, 5, 3));
    expect(bounds.sunday).toBe('2026-05-31');
    expect(bounds.saturday).toBe('2026-06-06');
  });

  it('lists seven day dates from Sunday', () => {
    expect(massWeekDayDates('2026-06-07')).toEqual([
      '2026-06-07',
      '2026-06-08',
      '2026-06-09',
      '2026-06-10',
      '2026-06-11',
      '2026-06-12',
      '2026-06-13',
    ]);
  });

  it('shifts by whole weeks', () => {
    expect(shiftMassWeek('2026-06-07', 1).sunday).toBe('2026-06-14');
  });

  it('adds days on ISO strings', () => {
    expect(addDaysIso('2026-06-07', 2)).toBe('2026-06-09');
  });

  it('bounds a calendar month', () => {
    const oct = massCalendarMonthBounds('2026-10');
    expect(oct.from).toBe('2026-10-01');
    expect(oct.to).toBe('2026-10-31');
    expect(oct.monthKey).toBe('2026-10');
    expect(oct.label).toMatch(/October.*2026/);
  });

  it('shifts calendar months', () => {
    expect(shiftCalendarMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftCalendarMonth('2026-01', -1)).toBe('2025-12');
  });
});
