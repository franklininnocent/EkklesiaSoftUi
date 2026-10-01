import { cfFormatDate, cfFormatClock } from '@shared/utils/cf-intl.util';

const TIME_OF_DAY = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function parseCelebrationTime(celebratedAt: string): { hour: number; minute: number } | null {
  const match = celebratedAt.trim().match(TIME_OF_DAY);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

/** 12-hour clock with AM/PM (e.g. `6:00 AM`). */
export function formatMassCelebrationTime(
  celebratedAt: string | null | undefined,
  fallback = 'Mass'
): string {
  if (!celebratedAt) {
    return fallback;
  }
  const parsed = parseCelebrationTime(celebratedAt);
  if (!parsed) {
    return celebratedAt.length > 5 ? celebratedAt.slice(0, 5) : celebratedAt;
  }
  const clock = new Date(2000, 0, 1, parsed.hour, parsed.minute);
  return cfFormatClock(clock);
}

/** `Sunday, 4 Oct 2026, 6:00 AM` (weekday, date, optional time). */
export function formatMassDayTime(celebratedOn: string, celebratedAt?: string | null): string {
  const dateLabel = cfFormatDate(celebratedOn, 'weekdayDate') || celebratedOn;
  if (!celebratedAt) {
    return dateLabel;
  }
  const time = formatMassCelebrationTime(celebratedAt, '');
  return time ? `${dateLabel}, ${time}` : dateLabel;
}
