import {
  currentCalendarMonthKey,
  massCalendarMonthBounds,
  massWeekBoundsContaining,
  shiftCalendarMonth,
  shiftMassWeek,
} from './mass-week.util';

export type MassCelebrationsCalendarView = 'list' | 'week';

const FILTER_QUERY_KEYS = ['search', 'status', 'celebrated_on', 'needs_tick'] as const;

export function monthKeyFromIsoDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function monthKeyFromWeekSunday(weekSunday: string): string {
  return monthKeyFromIsoDate(weekSunday);
}

/** Week to open when switching from list view to week view. */
export function defaultWeekSundayForMonth(monthKey: string): string {
  const currentMonth = currentCalendarMonthKey();
  if (monthKey === currentMonth) {
    return massWeekBoundsContaining().sunday;
  }
  const bounds = massCalendarMonthBounds(monthKey);
  const parts = bounds.from.split('-').map(Number);
  const midMonth = new Date(parts[0], parts[1] - 1, 15);
  return massWeekBoundsContaining(midMonth).sunday;
}

export function isCurrentCalendarMonth(monthKey: string): boolean {
  return monthKey === currentCalendarMonthKey();
}

export function isCurrentMassWeek(weekSunday: string): boolean {
  return weekSunday === massWeekBoundsContaining().sunday;
}

export function preservedMassCelebrationFilters(
  params: { get: (key: string) => string | null }
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const key of FILTER_QUERY_KEYS) {
    const value = params.get(key);
    out[key] = value === null || value === '' ? null : value;
  }
  return out;
}

export function listViewQueryParams(
  monthKey: string,
  filters: Record<string, string | null>
): Record<string, string | null> {
  return {
    ...filters,
    month: isCurrentCalendarMonth(monthKey) ? null : monthKey,
    week: null,
    page: null,
    schedule_denied: null,
  };
}

export function weekViewQueryParams(
  weekSunday: string,
  filters: Record<string, string | null>
): Record<string, string | null> {
  return {
    ...filters,
    week: isCurrentMassWeek(weekSunday) ? null : weekSunday,
    month: null,
    page: null,
    schedule_denied: null,
  };
}

export function shiftListMonth(monthKey: string, delta: number): string {
  return shiftCalendarMonth(monthKey, delta);
}

export function shiftWeekSunday(weekSunday: string, deltaWeeks: number): string {
  return shiftMassWeek(weekSunday, deltaWeeks).sunday;
}
