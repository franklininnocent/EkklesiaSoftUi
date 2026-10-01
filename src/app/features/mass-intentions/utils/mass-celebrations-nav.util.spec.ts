import {
  defaultWeekSundayForMonth,
  listViewQueryParams,
  monthKeyFromWeekSunday,
  weekViewQueryParams,
} from './mass-celebrations-nav.util';
import { massWeekBoundsContaining } from './mass-week.util';

describe('mass-celebrations-nav.util', () => {
  const emptyFilters = { search: null, status: null, celebrated_on: null, needs_tick: null };

  it('maps week sunday to month key', () => {
    expect(monthKeyFromWeekSunday('2026-10-04')).toBe('2026-10');
  });

  it('omits month query param for the current calendar month', () => {
    const month = new Date().toISOString().slice(0, 7);
    expect(listViewQueryParams(month, emptyFilters).month).toBeNull();
    expect(listViewQueryParams('2026-01', emptyFilters).month).toBe('2026-01');
  });

  it('omits week query param for the current mass week', () => {
    const sunday = massWeekBoundsContaining().sunday;
    expect(weekViewQueryParams(sunday, emptyFilters).week).toBeNull();
    expect(weekViewQueryParams('2020-01-05', emptyFilters).week).toBe('2020-01-05');
  });

  it('picks a week in the selected month when leaving list view', () => {
    const week = defaultWeekSundayForMonth('2026-10');
    expect(week).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(monthKeyFromWeekSunday(week)).toBe('2026-10');
  });
});
