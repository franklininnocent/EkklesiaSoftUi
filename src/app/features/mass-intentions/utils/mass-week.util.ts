/** Catholic parish office week: Sunday (0) through Saturday (6). */

import { cfFormatDate, cfFormatDayMonth } from '@shared/utils/cf-intl.util';

export interface MassWeekBounds {
  /** Sunday of this display week (YYYY-MM-DD). */
  sunday: string;
  /** Saturday end (YYYY-MM-DD). */
  saturday: string;
}

export const MASS_WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Sunday–Saturday bounds containing `anchor` (local calendar). */
export function massWeekBoundsContaining(anchor: Date = new Date()): MassWeekBounds {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return { sunday: isoDateLocal(sunday), saturday: isoDateLocal(saturday) };
}

export function shiftMassWeek(sundayIso: string, weeks: number): MassWeekBounds {
  const parts = sundayIso.split('-').map(Number);
  const sunday = new Date(parts[0], parts[1] - 1, parts[2]);
  sunday.setDate(sunday.getDate() + weeks * 7);
  return massWeekBoundsContaining(sunday);
}

export function addDaysIso(iso: string, days: number): string {
  const parts = iso.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + days);
  return isoDateLocal(d);
}

export function massWeekDayDates(sundayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(sundayIso, i));
}

export interface MassCalendarMonthBounds {
  /** First day of month (YYYY-MM-DD). */
  from: string;
  /** Last day of month (YYYY-MM-DD). */
  to: string;
  /** `YYYY-MM` */
  monthKey: string;
  /** e.g. October 2026 */
  label: string;
}

/** Calendar month bounds; `monthKey` is `YYYY-MM` or omitted for the current month. */
export function massCalendarMonthBounds(monthKey?: string | null): MassCalendarMonthBounds {
  let year: number;
  let monthIndex: number;
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    const [y, m] = monthKey.split('-').map(Number);
    year = y;
    monthIndex = m - 1;
  } else {
    const now = new Date();
    year = now.getFullYear();
    monthIndex = now.getMonth();
  }
  const from = isoDateLocal(new Date(year, monthIndex, 1));
  const to = isoDateLocal(new Date(year, monthIndex + 1, 0));
  const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const label = cfFormatDate(new Date(year, monthIndex, 15), 'monthYear');
  return { from, to, monthKey: key, label };
}

export function currentCalendarMonthKey(): string {
  return massCalendarMonthBounds().monthKey;
}

export function shiftCalendarMonth(monthKey: string, months: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMassWeekRangeLabel(bounds: MassWeekBounds): string {
  const sun = parseIso(bounds.sunday);
  const sat = parseIso(bounds.saturday);
  const sameYear = sun.getFullYear() === sat.getFullYear();
  const sunStr = sameYear ? cfFormatDayMonth(sun) : cfFormatDate(sun);
  const satStr = cfFormatDate(sat);
  return `${sunStr} – ${satStr}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
