import { MassCelebrationSummary } from '../services/mass-intentions-api.service';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * UTC epoch ms for a Mass start in the parish IANA timezone (ordering only).
 */
export function massCelebrationStartMs(
  celebratedOn: string,
  celebratedAt: string | null | undefined,
  timeZone: string
): number {
  if (!ISO_DATE.test(celebratedOn)) {
    return 0;
  }
  const [year, month, day] = celebratedOn.split('-').map(Number);
  const timeMatch = (celebratedAt ?? '').trim().match(TIME_OF_DAY);
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  const second = timeMatch && timeMatch[3] ? Number(timeMatch[3]) : 0;

  const temporal = (globalThis as { Temporal?: { ZonedDateTime: { from: (s: string) => { epochMilliseconds: number } } } })
    .Temporal;
  if (temporal) {
    try {
      const timePart = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
      return temporal.ZonedDateTime.from(`${celebratedOn}T${timePart}[${timeZone}]`).epochMilliseconds;
    } catch {
      // fall through
    }
  }

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = timeZoneOffsetMs(timeZone, new Date(utcGuess));
  return utcGuess - offset;
}

function timeZoneOffsetMs(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type === 'literal') {
      continue;
    }
    values[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    values['year'] ?? 0,
    (values['month'] ?? 1) - 1,
    values['day'] ?? 1,
    values['hour'] ?? 0,
    values['minute'] ?? 0,
    values['second'] ?? 0
  );
  return asUtc - date.getTime();
}

/**
 * Upcoming Masses first (ascending), then past Masses (descending). Pins next Mass to row 1.
 */
export function orderMassCelebrationsForList(
  items: MassCelebrationSummary[],
  parishNowIso: string | null,
  timeZone: string,
  nextUpcomingCelebrationId: string | null
): MassCelebrationSummary[] {
  if (items.length <= 1) {
    return items;
  }

  const parishNowMs = parishNowIso ? Date.parse(parishNowIso) : Date.now();
  const withStart = items.map((row) => ({
    row,
    startMs: massCelebrationStartMs(row.celebrated_on, row.celebrated_at, timeZone),
  }));

  const upcoming = withStart
    .filter((entry) => entry.startMs > parishNowMs)
    .sort((a, b) => a.startMs - b.startMs || a.row.id.localeCompare(b.row.id))
    .map((entry) => entry.row);

  const past = withStart
    .filter((entry) => entry.startMs <= parishNowMs)
    .sort((a, b) => b.startMs - a.startMs || a.row.id.localeCompare(b.row.id))
    .map((entry) => entry.row);

  const ordered = [...upcoming, ...past];

  if (!nextUpcomingCelebrationId || ordered.length < 2) {
    return ordered;
  }

  const index = ordered.findIndex((row) => row.id === nextUpcomingCelebrationId);
  if (index <= 0) {
    return ordered;
  }

  const nextRow = ordered[index];
  return [nextRow, ...ordered.slice(0, index), ...ordered.slice(index + 1)];
}
